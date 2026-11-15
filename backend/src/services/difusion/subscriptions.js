// Suscripción a la newsletter con doble confirmación:
//   1. suscribir(email): alta "pendiente" y correo con el enlace de confirmación (caduca a los 7 días)
//   2. confirmar(token): pasa a "activo"
//   3. baja(token): pasa a "baja" (un clic, también con List-Unsubscribe One-Click desde el cliente de correo)
// Las respuestas al público no dicen si un correo ya estaba suscrito (no se puede averiguar quién lo está).
// El almacén es intercambiable: Mongo en producción (mongoRepo) y memoria en las pruebas (memoryRepo).
const crypto = require('crypto')
const mailer = require('./mailer')
const { publicUrl } = require('./digest')

const CONSENT_TEXT = 'Acepto recibir por correo la agenda semanal de infoSalamanca. Puedo darme de baja en cualquier momento.'
const EMAIL_RE = /^[^\s@<>()[\],;:"]{1,64}@[^\s@<>()[\],;:"]{1,255}\.[a-z]{2,}$/i
const RESEND_AFTER = 10 * 60 * 1000 // no reenviar la confirmación más de una vez cada 10 minutos
const PENDING_TTL = 7 * 24 * 3600 * 1000

const newToken = () => crypto.randomBytes(24).toString('hex')
const normEmail = (e) => String(e || '').trim().toLowerCase()
const validEmail = (e) => EMAIL_RE.test(e) && e.length <= 254

const links = (token) => ({
  confirmar: `${publicUrl()}/api/newsletter/confirmar?t=${token}`,
  baja: `${publicUrl()}/api/newsletter/baja?t=${token}`
})

// Quién trata los datos (obligatorio informarlo): lo pone el .env, no el código
const responsable = () => process.env.NEWSLETTER_RESPONSABLE || ''
const active = () => mailer.enabled() && Boolean(responsable())

function confirmationEmail(token) {
  const { confirmar } = links(token)
  const font = "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
  return {
    subject: 'Confirma tu suscripción a la agenda de infoSalamanca',
    text: `Hola:\n\nPara recibir cada semana la agenda de infoSalamanca, confirma tu suscripción en este enlace:\n${confirmar}\n\nSi no lo has pedido tú, ignora este correo: sin confirmar no te escribiremos más y tu dirección se borra en 7 días.\n\n${responsable()}`,
    html: `<!doctype html><html lang="es"><body style="margin:0;background:#f3f4f6;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 10px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#fff;border-radius:14px;"><tr><td style="padding:26px;${font}color:#1d2228;font-size:15px;line-height:1.55;">
<div style="font-size:14px;color:#2e7d32;">info<b>Salamanca</b></div>
<h1 style="font-size:20px;margin:8px 0 12px;">Confirma tu suscripción</h1>
<p style="margin:0 0 18px;">Para recibir cada semana la agenda de la provincia (espectáculos, fiestas, ciencia y el tiempo), confirma que este correo es tuyo:</p>
<p style="margin:0 0 18px;"><a href="${confirmar}" style="display:inline-block;padding:11px 22px;border-radius:999px;background:#2e7d32;color:#fff;font-weight:700;text-decoration:none;">Confirmar suscripción</a></p>
<p style="margin:0;font-size:13px;color:#5f6b77;">Si no lo has pedido tú, ignora este correo: sin confirmar no te escribiremos más y tu dirección se borra en 7 días.</p>
${responsable() ? `<p style="margin:14px 0 0;font-size:12px;color:#5f6b77;">${responsable().replace(/</g, '&lt;')}</p>` : ''}
</td></tr></table></td></tr></table></body></html>`
  }
}

function createService(repo) {
  // Respuesta pública siempre igual, se haya hecho lo que se haya hecho
  const GENERIC = { ok: true, mensaje: 'Si la dirección es correcta, te hemos enviado un correo para confirmar la suscripción.' }

  async function suscribir(rawEmail, { acepto } = {}) {
    if (!active()) return { ok: false, status: 503, mensaje: 'La suscripción aún no está disponible.' }
    const email = normEmail(rawEmail)
    if (!validEmail(email)) return { ok: false, status: 400, mensaje: 'Revisa la dirección de correo.' }
    if (acepto !== true) return { ok: false, status: 400, mensaje: 'Tienes que aceptar recibir la agenda por correo.' }
    const now = new Date()
    const prev = await repo.findByEmail(email)
    if (prev?.estado === 'activo') return GENERIC
    if (prev?.estado === 'pendiente' && prev.ultimoCorreoConfirmacion && now - new Date(prev.ultimoCorreoConfirmacion) < RESEND_AFTER) return GENERIC
    const token = prev?.estado === 'pendiente' ? prev.token : newToken()
    const doc = {
      email, estado: 'pendiente', token,
      consentimiento: { texto: CONSENT_TEXT, fecha: now },
      ultimoCorreoConfirmacion: now,
      caduca: new Date(now.getTime() + PENDING_TTL),
      baja: null
    }
    if (prev) await repo.update(prev._id, doc)
    else await repo.create(doc)
    await mailer.send({ to: email, ...confirmationEmail(token) })
    return GENERIC
  }

  async function confirmar(token) {
    const sub = token && await repo.findByToken(String(token))
    if (!sub || sub.estado === 'baja') return { ok: false }
    if (sub.estado !== 'activo') await repo.update(sub._id, { estado: 'activo', confirmado: new Date(), caduca: null })
    return { ok: true, email: sub.email }
  }

  async function baja(token) {
    const sub = token && await repo.findByToken(String(token))
    if (!sub) return { ok: false }
    // Se cambia el token: el enlace viejo ya no sirve para volver a darse de alta por error
    if (sub.estado !== 'baja') await repo.update(sub._id, { estado: 'baja', baja: new Date(), caduca: null, token: newToken() })
    return { ok: true }
  }

  return { suscribir, confirmar, baja }
}

// ---------- Almacenes ----------
function mongoRepo() {
  const { Subscriber } = require('../../models/newsletter')
  return {
    findByEmail: (email) => Subscriber.findOne({ email }).lean(),
    findByToken: (token) => Subscriber.findOne({ token }).lean(),
    create: (doc) => Subscriber.create(doc),
    update: (id, patch) => Subscriber.updateOne({ _id: id }, { $set: patch }),
    active: () => Subscriber.find({ estado: 'activo' }, { email: 1, token: 1 }).lean(),
    list: () => Subscriber.find({}, { email: 1, estado: 1, creado: 1, confirmado: 1, baja: 1 }).sort({ creado: -1 }).lean(),
    remove: (id) => Subscriber.deleteOne({ _id: id })
  }
}

function memoryRepo() {
  const rows = []
  let n = 0
  const find = (pred) => rows.find(pred) || null
  return {
    rows,
    findByEmail: async (email) => find(r => r.email === email),
    findByToken: async (token) => find(r => r.token === token),
    create: async (doc) => { const r = { _id: String(++n), creado: new Date(), ...doc }; rows.push(r); return r },
    update: async (id, patch) => { Object.assign(find(r => r._id === id) || {}, patch) },
    active: async () => rows.filter(r => r.estado === 'activo'),
    list: async () => rows.slice(),
    remove: async (id) => { const i = rows.findIndex(r => r._id === id); if (i >= 0) rows.splice(i, 1) }
  }
}

module.exports = { createService, mongoRepo, memoryRepo, links, active, responsable, CONSENT_TEXT, _test: { validEmail, normEmail } }
