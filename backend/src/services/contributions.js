// Aportaciones de la gente: comprobación de lo que llega y cola de revisión (ver models/contribution.js).
// El almacén se pasa por parámetro (Mongo en el servidor, memoria en las pruebas).
const { TIPOS, RELACIONES } = require('../models/contribution')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MIN_TEXT = 10
const MAX_TEXT = 2000
const clean = (s, max) => String(s ?? '').replace(/\s+\n/g, '\n').trim().slice(0, max)

// Lo que manda el formulario → aportación válida, o el motivo para el usuario
function validate(body = {}) {
  const tipo = TIPOS.includes(body.tipo) ? body.tipo : 'otro'
  const mensaje = clean(body.mensaje, MAX_TEXT)
  const enlaceRaw = clean(body.enlace, 500)
  const email = clean(body.email, 254).toLowerCase()
  if (mensaje.length < MIN_TEXT && !enlaceRaw) return { error: 'Cuéntanos un poco más (al menos 10 letras) o pon un enlace.' }
  let enlace = null
  if (enlaceRaw) {
    try {
      const u = new URL(enlaceRaw)
      if (!/^https?:$/.test(u.protocol)) throw new Error()
      enlace = u.href
    } catch { return { error: 'El enlace no parece una dirección web (tiene que empezar por https://).' } }
  }
  if (email && !EMAIL_RE.test(email)) return { error: 'El correo no parece válido. Puedes dejarlo vacío.' }
  const ine = /^\d{5}$/.test(String(body.cod_ine || '')) ? String(body.cod_ine) : null
  return {
    value: {
      tipo,
      cod_ine: ine,
      municipio: ine ? clean(body.municipio, 120) || null : null,
      ref: clean(body.ref, 60) || null,
      ref_nombre: clean(body.ref_nombre, 160) || null,
      relacion: RELACIONES.includes(body.relacion) ? body.relacion : 'otro',
      mensaje: mensaje || '(solo el enlace)',
      enlace,
      email: email || null
    }
  }
}

function createService(repo, { proposePoster = async () => false } = {}) {
  const OK = { ok: true, mensaje: '¡Gracias! Lo revisamos antes de publicarlo.' }

  async function submit(body = {}) {
    // Campo trampa: la gente no lo ve ni lo rellena; los robots sí. Se les contesta igual, sin guardar nada.
    if (body.web) return OK
    const { value, error } = validate(body)
    if (error) return { ok: false, status: 400, mensaje: error }
    // El mismo texto del mismo pueblo dos veces (doble clic, reintento): una sola
    if (await repo.findRecent({ cod_ine: value.cod_ine, mensaje: value.mensaje })) return OK
    // Un cartel de fiestas: además va a la cola de carteles, donde se aprueba con su imagen
    if (value.tipo === 'fiesta' && value.enlace && value.cod_ine) {
      value.cartel = await proposePoster(value).catch(() => false)
    }
    await repo.create(value)
    return OK
  }

  const list = (estado = 'pendiente') => repo.list(['pendiente', 'aplicada', 'descartada'].includes(estado) ? estado : 'pendiente')

  // Revisada: aplicada (ya se ha cambiado lo que decía) o descartada. El correo ya no hace falta: se borra.
  async function review(id, { estado, nota } = {}) {
    if (!['aplicada', 'descartada', 'pendiente'].includes(estado)) throw new Error('Estado no válido')
    const patch = { estado, nota: nota ? clean(nota, 500) : undefined }
    if (estado !== 'pendiente') Object.assign(patch, { revisada: new Date(), email: null })
    const doc = await repo.update(id, patch)
    if (!doc) throw new Error('Aportación no encontrada')
    return doc
  }

  return { submit, list, review, count: () => repo.count('pendiente') }
}

function mongoRepo() {
  const { Contribution } = require('../models/contribution')
  return {
    findRecent: ({ cod_ine, mensaje }) => Contribution.findOne({ cod_ine, mensaje, creada: { $gte: new Date(Date.now() - 86400000) } }).lean(),
    create: (doc) => Contribution.create(doc),
    list: (estado) => Contribution.find({ estado }).sort({ creada: estado === 'pendiente' ? 1 : -1 }).limit(200).lean(),
    update: (id, patch) => Contribution.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean(),
    count: (estado) => Contribution.countDocuments({ estado })
  }
}

function memoryRepo() {
  const rows = []
  let n = 0
  return {
    rows,
    findRecent: async ({ cod_ine, mensaje }) => rows.find(r => r.cod_ine === cod_ine && r.mensaje === mensaje) || null,
    create: async (doc) => { const row = { _id: String(++n), estado: 'pendiente', creada: new Date(), ...doc }; rows.push(row); return row },
    list: async (estado) => rows.filter(r => r.estado === estado),
    update: async (id, patch) => { const r = rows.find(x => x._id === id); if (r) Object.assign(r, patch); return r || null },
    count: async (estado) => rows.filter(r => r.estado === estado).length
  }
}

module.exports = { createService, mongoRepo, memoryRepo, _test: { validate } }
