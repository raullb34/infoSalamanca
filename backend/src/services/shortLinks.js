// Enlaces cortos para el canal de WhatsApp: https://…/api/l/<código> → la página del evento.
// WhatsApp parte los enlaces largos (los de la Junta o la Universidad pasan de 100 caracteres) y a veces solo deja
// pulsable el primer trozo; con el enlace corto todos miden igual y se cuentan los clics.
// Solo se redirige a lo que se ha acortado aquí (no es una redirección abierta). Sin base de datos, el enlace se
// deja tal cual.
const crypto = require('crypto')

const ALPHABET = '0123456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ' // sin o, l, I ni O (se confunden con 0 y 1)
const LEN = 7

// Código fijo para cada dirección (la misma dirección da siempre el mismo código)
function codeFor(url, len = LEN) {
  const h = crypto.createHash('sha256').update(url).digest()
  let out = ''
  for (let i = 0; out.length < len; i++) out += ALPHABET[h[i] % ALPHABET.length]
  return out
}

const isWeb = (u) => /^https?:\/\//i.test(String(u || ''))

function createService(repo, { base }) {
  const prefix = () => `${base()}/api/l/`

  async function shorten(url) {
    if (!isWeb(url) || String(url).startsWith(base())) return url // los de la propia web ya son cortos
    for (let len = LEN; len <= LEN + 4; len++) {
      const code = codeFor(url, len)
      const found = await repo.find(code)
      if (found && found.url !== url) continue // colisión: un carácter más
      if (!found) await repo.create({ code, url })
      return prefix() + code
    }
    return url
  }

  // Copia del resumen con los enlaces de cada evento y noticia acortados
  async function shortenDigest(d) {
    const short = async (i) => ({ ...i, enlace: await shorten(i.enlace) })
    return {
      ...d,
      secciones: await Promise.all(d.secciones.map(async s => ({ ...s, items: await Promise.all(s.items.map(short)) }))),
      noticias: await Promise.all((d.noticias || []).map(short))
    }
  }

  // Adónde lleva un código (y cuenta el clic)
  async function resolve(code) {
    if (!/^[0-9a-zA-Z]{7,11}$/.test(String(code))) return null
    const found = await repo.find(code)
    if (!found) return null
    repo.hit(code).catch(() => {})
    return found.url
  }

  return { shorten, shortenDigest, resolve }
}

function mongoRepo() {
  const mongoose = require('mongoose')
  const schema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    clics: { type: Number, default: 0 }
  }, { timestamps: { createdAt: 'creado', updatedAt: false } })
  const ShortLink = mongoose.models.ShortLink || mongoose.model('ShortLink', schema, 'shortlinks')
  return {
    find: (code) => ShortLink.findOne({ code }).lean(),
    create: (doc) => ShortLink.updateOne({ code: doc.code }, { $setOnInsert: doc }, { upsert: true }),
    hit: (code) => ShortLink.updateOne({ code }, { $inc: { clics: 1 } })
  }
}

function memoryRepo() {
  const rows = new Map()
  return {
    rows,
    find: async (code) => rows.get(code) || null,
    create: async (doc) => { if (!rows.has(doc.code)) rows.set(doc.code, { ...doc, clics: 0 }) },
    hit: async (code) => { const r = rows.get(code); if (r) r.clics++ }
  }
}

module.exports = { createService, mongoRepo, memoryRepo, _test: { codeFor } }
