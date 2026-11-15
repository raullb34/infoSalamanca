// Envío de correo por SMTP (nodemailer). Lo hace nuestro servidor, sin proveedor de newsletter: hace falta un
// buzón desde el que enviar (Gmail con contraseña de aplicación, el del dominio…). Todo va en el .env:
//   SMTP_HOST, SMTP_PORT (587), SMTP_SECURE (true con 465), SMTP_USER, SMTP_PASS
//   MAIL_FROM          remitente visible, p. ej. "infoSalamanca <agenda@ejemplo.es>"
//   MAIL_REPLY_TO      opcional
// MAIL_TRANSPORT=json no envía nada: construye el mensaje y lo devuelve (pruebas).
const nodemailer = require('nodemailer')

let transport = null
let sent = [] // con MAIL_TRANSPORT=json, los mensajes "enviados" (para las pruebas)

const mode = () => (process.env.MAIL_TRANSPORT === 'json' ? 'json' : 'smtp')
const enabled = () => mode() === 'json' || Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM)

function getTransport() {
  if (transport) return transport
  transport = mode() === 'json'
    ? nodemailer.createTransport({ jsonTransport: true })
    : nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || '') === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      pool: true, // una sola conexión para todo un envío
      maxConnections: 1
    })
  return transport
}

async function send({ to, subject, html, text, headers = {} }) {
  if (!enabled()) throw new Error('Correo desactivado: falta configurar SMTP en el .env')
  const info = await getTransport().sendMail({
    from: process.env.MAIL_FROM || 'infoSalamanca <pruebas@example.invalid>',
    replyTo: process.env.MAIL_REPLY_TO || undefined,
    to, subject, html, text, headers
  })
  if (mode() === 'json') sent.push(JSON.parse(info.message))
  return info
}

// Comprueba la conexión y el usuario con el servidor SMTP (para el panel)
async function verify() {
  if (!enabled()) return { ok: false, error: 'Sin configurar' }
  if (mode() === 'json') return { ok: true, modo: 'pruebas' }
  try {
    await getTransport().verify()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

module.exports = { send, verify, enabled, _test: { sent: () => sent, reset: () => { sent = []; transport = null } } }
