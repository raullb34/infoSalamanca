// Envío de un número de la newsletter a los suscriptores activos, de uno en uno y con pausa (los buzones SMTP
// normales limitan el ritmo: Gmail, unos 500 al día). Cada correo lleva su propio enlace de baja y las cabeceras
// List-Unsubscribe (con One-Click, RFC 8058) para que Gmail u Outlook muestren su botón de "Cancelar suscripción".
// El progreso se va guardando en el número (estado, enviados, fallidos) y el panel lo consulta.
const mailer = require('./mailer')
const render = require('./render')
const { links, responsable } = require('./subscriptions')

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
let running = false

const isRunning = () => running

// digest: el resumen ya filtrado; issue: { _id, asunto, intro }; issues: almacén de números; subs: de suscriptores
async function sendIssue({ digest, issue, issues, subs, delayMs = Number(process.env.MAIL_DELAY_MS || 1500) }) {
  if (running) throw new Error('Ya hay un envío en marcha')
  running = true
  let enviados = 0
  let fallidos = 0
  try {
    const recipients = await subs.active()
    await issues.update(issue._id, { total: recipients.length })
    for (const r of recipients) {
      const baja = links(r.token).baja
      const mail = render.email(digest, { intro: issue.intro, subject: issue.asunto, unsubscribeUrl: baja, responsable: responsable(), posterUrl: issue.posterUrl || null })
      try {
        await mailer.send({
          to: r.email, subject: mail.subject, html: mail.html, text: mail.text,
          headers: { 'List-Unsubscribe': `<${baja}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
        })
        enviados++
      } catch (err) {
        fallidos++
        console.warn('⚠️ Newsletter, envío fallido:', err.message)
      }
      if ((enviados + fallidos) % 10 === 0) await issues.update(issue._id, { enviados, fallidos })
      if (delayMs) await sleep(delayMs)
    }
    await issues.update(issue._id, { estado: 'enviado', enviados, fallidos, terminado: new Date() })
  } catch (err) {
    await issues.update(issue._id, { estado: 'error', enviados, fallidos, error: err.message, terminado: new Date() })
    throw err
  } finally {
    running = false
  }
  return { enviados, fallidos }
}

function mongoIssues() {
  const { NewsletterIssue } = require('../../models/newsletter')
  return {
    create: (doc) => NewsletterIssue.create(doc),
    update: (id, patch) => NewsletterIssue.updateOne({ _id: id }, { $set: patch }),
    list: () => NewsletterIssue.find({}, { html: 0, text: 0 }).sort({ creado: -1 }).limit(50).lean(),
    get: (id) => NewsletterIssue.findById(id).lean()
  }
}

function memoryIssues() {
  const rows = []
  let n = 0
  return {
    rows,
    create: async (doc) => { const r = { _id: String(++n), creado: new Date(), estado: 'enviando', ...doc }; rows.push(r); return r },
    update: async (id, patch) => { Object.assign(rows.find(r => r._id === id) || {}, patch) },
    list: async () => rows.slice().reverse(),
    get: async (id) => rows.find(r => r._id === id) || null
  }
}

module.exports = { sendIssue, isRunning, mongoIssues, memoryIssues }
