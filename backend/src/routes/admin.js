// Panel de administración (/admin): todo exige la clave de administración (Authorization: Bearer <ADMIN_TOKEN>)
//   GET    /api/admin/estado                         estado de las fuentes, la base de datos y el correo
//   GET    /api/admin/difusion/resumen?desde=&dias=  resumen de la semana (lo que se puede difundir)
//   POST   /api/admin/difusion/render                { desde, dias, excluidos, intro, asunto } → WhatsApp y correo
//   GET    /api/admin/newsletter/suscriptores        resumen y lista
//   DELETE /api/admin/newsletter/suscriptores/:id    borrar (derecho de supresión)
//   GET    /api/admin/newsletter/envios(/:id)        números enviados y su progreso
//   POST   /api/admin/newsletter/prueba              { to, ...lo de render } → un correo de prueba
//   POST   /api/admin/newsletter/enviar              { confirmar: true, ...lo de render } → a todos los activos
const express = require('express')
const mongoose = require('mongoose')
const axios = require('axios')
const requireAdmin = require('../middleware/requireAdmin')
const digestSvc = require('../services/difusion/digest')
const render = require('../services/difusion/render')
const mailer = require('../services/difusion/mailer')
const subscriptions = require('../services/difusion/subscriptions')
const sender = require('../services/difusion/sender')
const { renderPoster } = require('../services/difusion/poster')
const { savePoster } = require('../services/difusion/posterStore')
const illustration = require('../services/difusion/illustration')
// El cartel con la ilustración de su semana (generada con IA) o, si no hay, la de serie
const poster = (digest) => renderPoster(digest, { illustration: illustration.existing(digest.desde) })

const router = express.Router()
router.use(requireAdmin)

// ¿La clave vale? (la pantalla de entrada del panel la comprueba antes de enseñar nada)
router.get('/sesion', (req, res) => res.json({ ok: true }))

const SELF = `http://127.0.0.1:${process.env.PORT || 4000}/api`
const dbReady = () => mongoose.connection.readyState === 1
const needDb = (res) => (dbReady() ? false : (res.status(503).json({ error: 'Base de datos no disponible' }), true))
const handler = (fn) => (req, res) => fn(req, res).catch(err => {
  console.error('❌ Admin:', err.message)
  res.status(500).json({ error: err.message })
})

// ---------- Estado ----------
const withTimeout = (p, ms = 25000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('Sin respuesta')), ms))])
async function check(nombre, fn) {
  const t0 = Date.now()
  try {
    return { nombre, ok: true, ...(await withTimeout(fn())), ms: Date.now() - t0 }
  } catch (err) {
    return { nombre, ok: false, error: err.message, ms: Date.now() - t0 }
  }
}

router.get('/estado', handler(async (req, res) => {
  const agendas = require('../services/agendas')
  const diputacion = require('../services/diputacionAgenda')
  const { cartelera } = require('../services/cinesService')
  const espectaculos = require('../services/espectaculos')
  const fuentes = await Promise.all([
    check('Espectáculos (Junta, Diputación, Turismo)', async () => ({ detalle: `${(await espectaculos.getShows()).length} espectáculos` })),
    check('Agenda de la Diputación (La Salina)', async () => ({ detalle: `${(await diputacion.getAgenda()).length} actividades` })),
    check('Turismo de Salamanca y Convention Bureau', async () => ({ detalle: `${(await agendas.culturalEvents()).length} eventos culturales` })),
    check('Ciencia (Salamanca Tech, Convention Bureau)', async () => ({ detalle: `${(await agendas.scienceEvents()).length} eventos` })),
    check('Noticias de ciencia (USAL)', async () => ({ detalle: `${(await agendas.scienceNews()).length} noticias` })),
    check('Prensa local (RSS + IA)', async () => {
      const s = require('../services/prensa').status()
      return { detalle: `${s.medios} periódicos, ${s.noticias} noticias (${s.conPueblo} de pueblos, ${s.descartadas} fuera), ${s.eventos} eventos; IA hoy: ${s.iaHoy}, pendientes: ${s.pendientesIA}` }
    }),
    check('Cines', async () => {
      const c = await cartelera()
      const conSesiones = c.cines.filter(x => x.peliculas?.length).length
      return { detalle: `${c.cines.length} cines, ${conSesiones} con sesiones`, actualizado: c.actualizado }
    }),
    check('El tiempo (estaciones)', async () => {
      const { data } = await axios.get(`${SELF}/v1/weather/status`, { timeout: 20000 })
      const tasks = data.tasks || []
      // Una tarea falla si lleva fallos seguidos (consecutiveFailures se pone a 0 al ir bien)
      const fallos = tasks.filter(t => (t.consecutiveFailures || 0) > 0)
      const ultimo = tasks.map(t => t.lastSuccessAt).filter(Boolean).sort().pop()
      return { detalle: `${tasks.length} tareas${fallos.length ? `, ${fallos.length} con error` : ', todas bien'}`, actualizado: ultimo || null, avisos: fallos.map(t => `${t._id}: ${t.lastError || 'error'}`) }
    })
  ])
  let newsletter = { ia: illustration.enabled(), correo: mailer.enabled(), responsable: Boolean(subscriptions.responsable()), canalWhatsapp: process.env.WHATSAPP_CHANNEL_URL || null }
  let carteles = null
  let aportaciones = null
  if (dbReady()) {
    const { Subscriber } = require('../models/newsletter')
    const FestivalPoster = require('../models/festivalPoster')
    const counts = await Subscriber.aggregate([{ $group: { _id: '$estado', n: { $sum: 1 } } }])
    newsletter = { ...newsletter, suscriptores: Object.fromEntries(counts.map(c => [c._id, c.n])) }
    carteles = { pendientes: await FestivalPoster.countDocuments({ status: 'pending' }) }
    aportaciones = { pendientes: await require('./aportaciones').service().count() }
  }
  res.json({ fecha: new Date().toISOString(), baseDeDatos: dbReady(), fuentes, newsletter, carteles, aportaciones })
}))

// ---------- Aportaciones de la gente ----------
// Lista por estado (pendiente, aplicada, descartada) y revisión: aplicada (ya se ha cambiado lo que decía) o
// descartada. Al revisarla se borra el correo, si lo dejaron.
router.get('/aportaciones', handler(async (req, res) => {
  if (needDb(res)) return
  res.json({ aportaciones: await require('./aportaciones').service().list(String(req.query.estado || 'pendiente')) })
}))
router.post('/aportaciones/:id', handler(async (req, res) => {
  if (needDb(res)) return
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Id no válido' })
  res.json(await require('./aportaciones').service().review(req.params.id, req.body || {}))
}))

// ---------- Difusión ----------
// El resumen tarda unos segundos (consulta las agendas): se guarda 10 minutos por semana pedida
const digestCache = new Map()
async function digestFor(desde, dias) {
  const key = `${desde || 'hoy'}|${dias || 7}`
  const hit = digestCache.get(key)
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.data
  const data = await digestSvc.buildDigest({ desde, dias })
  digestCache.set(key, { at: Date.now(), data })
  if (digestCache.size > 20) digestCache.delete(digestCache.keys().next().value)
  return data
}
const cleanText = (s, max) => String(s || '').replace(/\r/g, '').slice(0, max)
const opts = (b = {}) => ({
  desde: /^\d{4}-\d{2}-\d{2}$/.test(b.desde || '') ? b.desde : undefined,
  dias: Math.min(Math.max(Number(b.dias) || 7, 1), 31),
  excluidos: Array.isArray(b.excluidos) ? b.excluidos.map(String).slice(0, 500) : [],
  intro: cleanText(b.intro, 2000),
  asunto: cleanText(b.asunto, 150).trim()
})
async function build(b) {
  const o = opts(b)
  const digest = digestSvc.select(await digestFor(o.desde, o.dias), o.excluidos)
  return { o, digest }
}

router.get('/difusion/resumen', handler(async (req, res) => {
  const o = opts(req.query)
  if (req.query.recargar === '1') digestCache.clear()
  res.json(await digestFor(o.desde, o.dias))
}))

// El cartel de la semana en PNG (para descargarlo y publicarlo en el canal de WhatsApp)
router.post('/difusion/cartel', handler(async (req, res) => {
  const { digest } = await build(req.body)
  const png = await poster(digest)
  res.set('Content-Disposition', `inline; filename="agenda-${digest.desde}.png"`).type('png').send(png)
}))

// Ilustración de la semana con IA (unos 30 s; se guarda y la usan el cartel y la newsletter)
let generating = false
router.post('/difusion/ilustracion', handler(async (req, res) => {
  if (!illustration.enabled()) return res.status(503).json({ error: 'Falta OPENAI_API_KEY en el .env del servidor' })
  if (generating) return res.status(409).json({ error: 'Ya se está generando una ilustración' })
  generating = true
  try {
    const { digest } = await build(req.body)
    const r = await illustration.generate(digest)
    res.json({ ok: true, modelo: r.modelo, prompt: r.prompt })
  } finally { generating = false }
}))

router.post('/difusion/render', handler(async (req, res) => {
  const { o, digest } = await build(req.body)
  // En la vista previa, el panel cambia __CARTEL__ por la imagen que acaba de pedir
  const email = render.email(digest, { intro: o.intro, subject: o.asunto || undefined, unsubscribeUrl: `${digestSvc.publicUrl()}/api/newsletter/baja?t=EJEMPLO`, responsable: subscriptions.responsable(), posterUrl: req.body?.cartel === false ? null : '__CARTEL__' })
  res.json({ whatsapp: await whatsappText(digest, o.intro), email })
}))

// Texto del canal de WhatsApp con enlaces cortos (/api/l/…): WhatsApp parte los largos. Sin base de datos, los
// enlaces van completos.
async function whatsappText(digest, intro) {
  const d = dbReady() ? await require('./shortLinks').service().shortenDigest(digest).catch(() => digest) : digest
  return render.whatsapp(d, { intro })
}

// ---------- Newsletter ----------
router.get('/newsletter/suscriptores', handler(async (req, res) => {
  if (needDb(res)) return
  const lista = await subscriptions.mongoRepo().list()
  const resumen = lista.reduce((acc, s) => ({ ...acc, [s.estado]: (acc[s.estado] || 0) + 1 }), {})
  res.json({ resumen, lista })
}))

router.delete('/newsletter/suscriptores/:id', handler(async (req, res) => {
  if (needDb(res)) return
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Id no válido' })
  await subscriptions.mongoRepo().remove(req.params.id)
  res.json({ ok: true })
}))

router.get('/newsletter/envios', handler(async (req, res) => {
  if (needDb(res)) return
  res.json({ enCurso: sender.isRunning(), envios: await sender.mongoIssues().list() })
}))

router.get('/newsletter/envios/:id', handler(async (req, res) => {
  if (needDb(res)) return
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Id no válido' })
  const issue = await sender.mongoIssues().get(req.params.id)
  return issue ? res.json(issue) : res.status(404).json({ error: 'No existe' })
}))

router.get('/newsletter/smtp', handler(async (req, res) => res.json(await mailer.verify())))

router.post('/newsletter/prueba', handler(async (req, res) => {
  const to = String(req.body?.to || '').trim().toLowerCase()
  if (!subscriptions._test.validEmail(to)) return res.status(400).json({ error: 'Correo de destino no válido' })
  if (!mailer.enabled()) return res.status(503).json({ error: 'Falta configurar el SMTP en el .env del servidor' })
  const { o, digest } = await build(req.body)
  const poster = req.body?.cartel === false ? null : await savePoster(await poster(digest), `prueba-${Date.now()}`)
  const mail = render.email(digest, { intro: o.intro, subject: o.asunto || undefined, unsubscribeUrl: `${digestSvc.publicUrl()}/api/newsletter/baja`, responsable: subscriptions.responsable(), posterUrl: poster?.url })
  await mailer.send({ to, subject: `[Prueba] ${mail.subject}`, html: mail.html, text: mail.text })
  res.json({ ok: true })
}))

router.post('/newsletter/enviar', handler(async (req, res) => {
  if (needDb(res)) return
  if (req.body?.confirmar !== true) return res.status(400).json({ error: 'Falta confirmar el envío' })
  if (!subscriptions.active()) return res.status(503).json({ error: 'Falta configurar el SMTP o el responsable (NEWSLETTER_RESPONSABLE) en el .env' })
  if (sender.isRunning()) return res.status(409).json({ error: 'Ya hay un envío en marcha' })
  const { o, digest } = await build(req.body)
  const preview = render.email(digest, { intro: o.intro, subject: o.asunto || undefined, unsubscribeUrl: '#', responsable: subscriptions.responsable() })
  const issues = sender.mongoIssues()
  const issue = await issues.create({
    asunto: preview.subject, intro: o.intro, desde: digest.desde, hasta: digest.hasta, excluidos: o.excluidos,
    html: preview.html, text: preview.text, whatsapp: await whatsappText(digest, o.intro)
  })
  // El cartel del número, guardado con su id para que lo enlacen los correos
  const poster = req.body?.cartel === false ? null : await savePoster(await poster(digest), `agenda-${digest.desde}-${issue._id}`)
  if (poster) await issues.update(issue._id, { posterUrl: poster.url })
  // En segundo plano: el panel consulta el progreso en /newsletter/envios/:id
  sender.sendIssue({ digest, issue: { _id: issue._id, asunto: preview.subject, intro: o.intro, posterUrl: poster?.url }, issues, subs: subscriptions.mongoRepo() })
    .catch(err => console.error('❌ Newsletter, envío:', err.message))
  res.status(202).json({ ok: true, id: issue._id })
}))

module.exports = router
