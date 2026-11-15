// Newsletter, parte pública:
//   GET  /api/newsletter/info        ¿está activa?, quién trata los datos y enlace del canal de WhatsApp
//   POST /api/newsletter/suscribir   { email, acepto: true }  → correo de confirmación (doble opt-in)
//   GET  /api/newsletter/confirmar?t= página con botón; POST confirma
//   GET  /api/newsletter/baja?t=      página con botón; POST da de baja (también One-Click, RFC 8058)
// Confirmar y dar de baja van por POST porque algunos correos (Outlook, antivirus) abren los enlaces solos
// para revisarlos: con un GET darían de alta o de baja a la gente sin que lo sepa.
const express = require('express')
const mongoose = require('mongoose')
const { rateLimit } = require('../middleware/rateLimit')
const { createService, mongoRepo, active, responsable, CONSENT_TEXT } = require('../services/difusion/subscriptions')
const { publicUrl } = require('../services/difusion/digest')

const router = express.Router()
router.use(express.urlencoded({ extended: false, limit: '4kb' }))

let service = null
const svc = () => (service = service || createService(mongoRepo()))
const dbReady = () => mongoose.connection.readyState === 1

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
function page(res, { title, body, status = 200 }) {
  res.status(status).type('html').set('Cache-Control', 'no-store').send(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} · infoSalamanca</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f4f6;color:#1d2228;font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;padding:16px;box-sizing:border-box}
main{max-width:460px;background:#fff;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(0,0,0,.08)}h1{font-size:22px;margin:6px 0 10px}
.brand{color:#2e7d32;font-size:14px}button,a.btn{display:inline-block;margin-top:14px;padding:11px 22px;border:0;border-radius:999px;background:#2e7d32;color:#fff;font:inherit;font-weight:700;text-decoration:none;cursor:pointer}
.muted{color:#5f6b77;font-size:14px}@media(prefers-color-scheme:dark){body{background:#15181c;color:#e8eaed}main{background:#1f2329}.muted{color:#a0a9b3}}</style>
</head><body><main><div class="brand">info<b>Salamanca</b></div>${body}</main></body></html>`)
}
const backLink = `<a class="btn" href="${esc(publicUrl())}">Ir a infoSalamanca</a>`
const tokenOf = (req) => String(req.query.t || req.body?.t || '').replace(/[^a-f0-9]/gi, '').slice(0, 64)

router.get('/info', (req, res) => {
  res.json({
    activa: active() && dbReady(),
    responsable: responsable() || null,
    contacto: process.env.NEWSLETTER_CONTACTO || null,
    consentimiento: CONSENT_TEXT,
    canalWhatsapp: process.env.WHATSAPP_CHANNEL_URL || null
  })
})

// Cartel de un número de la newsletter (lo enlaza el correo). Nombre comprobado: no se sirve otra cosa
router.get('/cartel/:file', (req, res) => {
  const file = require('../services/difusion/posterStore').posterPath(req.params.file)
  if (!file || !require('fs').existsSync(file)) return res.status(404).end()
  res.set('Cache-Control', 'public, max-age=31536000, immutable').type('png').sendFile(file)
})

router.post('/suscribir', rateLimit({ perMinute: 5, perDay: 30 }), async (req, res) => {
  if (!dbReady()) return res.status(503).json({ ok: false, mensaje: 'La suscripción no está disponible ahora mismo.' })
  try {
    const r = await svc().suscribir(req.body?.email, { acepto: req.body?.acepto === true })
    res.status(r.status || 200).json({ ok: r.ok, mensaje: r.mensaje })
  } catch (err) {
    console.error('❌ Newsletter, suscripción:', err.message)
    res.status(500).json({ ok: false, mensaje: 'No hemos podido enviar el correo de confirmación. Prueba más tarde.' })
  }
})

router.get('/confirmar', (req, res) => {
  const t = tokenOf(req)
  page(res, {
    title: 'Confirmar suscripción',
    body: `<h1>Confirma tu suscripción</h1><p>Recibirás cada semana la agenda de la provincia: espectáculos, fiestas, ciencia y el tiempo.</p>
<form method="post" action="confirmar"><input type="hidden" name="t" value="${esc(t)}"><button type="submit">Confirmar suscripción</button></form>`
  })
})

router.post('/confirmar', rateLimit({ perMinute: 20, perDay: 200 }), async (req, res) => {
  if (!dbReady()) return page(res, { title: 'No disponible', status: 503, body: '<h1>No disponible</h1><p>Prueba de nuevo en un rato.</p>' })
  const r = await svc().confirmar(tokenOf(req)).catch(() => ({ ok: false }))
  if (!r.ok) return page(res, { title: 'Enlace no válido', status: 400, body: `<h1>Este enlace ya no sirve</h1><p class="muted">Puede que haya caducado (duran 7 días). Vuelve a suscribirte desde la web.</p>${backLink}` })
  page(res, { title: 'Suscripción confirmada', body: `<h1>¡Listo!</h1><p>Desde ahora recibirás la agenda semanal en <b>${esc(r.email)}</b>.</p><p class="muted">Cada correo trae un enlace para darte de baja cuando quieras.</p>${backLink}` })
})

router.get('/baja', (req, res) => {
  const t = tokenOf(req)
  page(res, {
    title: 'Darse de baja',
    body: `<h1>¿Dejar de recibir la agenda?</h1><p>No te volveremos a escribir.</p>
<form method="post" action="baja"><input type="hidden" name="t" value="${esc(t)}"><button type="submit">Darme de baja</button></form>`
  })
})

router.post('/baja', rateLimit({ perMinute: 20, perDay: 200 }), async (req, res) => {
  const oneClick = req.body?.['List-Unsubscribe'] === 'One-Click'
  if (!dbReady()) return oneClick ? res.status(503).end() : page(res, { title: 'No disponible', status: 503, body: '<h1>No disponible</h1><p>Prueba de nuevo en un rato.</p>' })
  const r = await svc().baja(tokenOf(req)).catch(() => ({ ok: false }))
  if (oneClick) return res.status(r.ok ? 200 : 400).end()
  if (!r.ok) return page(res, { title: 'Enlace no válido', status: 400, body: `<h1>Este enlace ya no sirve</h1><p class="muted">Si sigues recibiendo correos, responde a cualquiera de ellos y te damos de baja a mano.</p>${backLink}` })
  page(res, { title: 'Baja hecha', body: `<h1>Hecho</h1><p>Ya no recibirás la agenda por correo.</p><p class="muted">Si te arrepientes, puedes volver a suscribirte desde la web.</p>${backLink}` })
})

module.exports = router
