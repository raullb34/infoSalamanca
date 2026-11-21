// Almacén del cuaderno: colecciones con documentos de id propio (texto). Dos implementaciones con la misma interfaz:
//  - mongoStore(): colecciones de Mongo (prefijo "cuaderno_"), separadas de los datos públicos del visor;
//  - memoryStore(): en memoria, para las pruebas.
// Filtros de igualdad, con rutas con punto que entran en listas ("miembros.userId": x).
// `update` admite control de versión: si se pasa `version` y no coincide con la guardada, no escribe y devuelve null.
const crypto = require('crypto')

const newId = () => crypto.randomUUID()
const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)))

// ¿Cumple un documento el filtro? (igualdad; las rutas con punto atraviesan listas)
function matches(doc, filter = {}) {
  const values = (obj, parts) => {
    if (!parts.length) return [obj]
    if (obj === null || obj === undefined) return []
    if (Array.isArray(obj)) return obj.flatMap(o => values(o, parts))
    return values(obj[parts[0]], parts.slice(1))
  }
  return Object.entries(filter).every(([k, v]) => values(doc, k.split('.')).flat().some(x => x === v))
}

function memoryStore() {
  const cols = new Map()
  const col = (name) => (cols.has(name) || cols.set(name, new Map()), cols.get(name))
  return {
    kind: 'memoria',
    async insert(name, doc) {
      const d = { ...clone(doc), _id: doc._id || newId() }
      if (col(name).has(d._id)) throw Object.assign(new Error('Id repetido'), { code: 11000 })
      col(name).set(d._id, d)
      return clone(d)
    },
    async get(name, id) { return clone(col(name).get(id)) || null },
    async find(name, filter = {}) { return [...col(name).values()].filter(d => matches(d, filter)).map(clone) },
    async update(name, id, patch, { version } = {}) {
      const d = col(name).get(id)
      if (!d) return null
      if (version !== undefined && d.version !== version) return null
      Object.assign(d, clone(patch))
      return clone(d)
    },
    async remove(name, id) { return col(name).delete(id) },
    _cols: cols
  }
}

function mongoStore() {
  const mongoose = require('mongoose')
  const c = (name) => mongoose.connection.collection(`cuaderno_${name}`)
  return {
    kind: 'mongo',
    async insert(name, doc) {
      const d = { ...doc, _id: doc._id || newId() }
      await c(name).insertOne(d)
      return d
    },
    async get(name, id) { return c(name).findOne({ _id: id }) },
    async find(name, filter = {}) { return c(name).find(filter).toArray() },
    async update(name, id, patch, { version } = {}) {
      const q = version === undefined ? { _id: id } : { _id: id, version }
      const { _id, ...set } = patch // el _id no se toca nunca
      const r = await c(name).findOneAndUpdate(q, { $set: set }, { returnDocument: 'after' })
      return r?.value !== undefined ? r.value : r // el driver devuelve el documento o { value }
    },
    async remove(name, id) { return (await c(name).deleteOne({ _id: id })).deletedCount > 0 },
    // Índices (una vez, al arrancar)
    async ensureIndexes() {
      await c('usuarios').createIndex({ email: 1 }, { unique: true })
      await c('sesiones').createIndex({ hash: 1 }, { unique: true })
      await c('sesiones').createIndex({ caduca: 1 }, { expireAfterSeconds: 0 })
      await c('explotaciones').createIndex({ 'miembros.userId': 1 })
      for (const n of ['recintos', 'fincas', 'cultivos', 'operaciones', 'productos']) await c(n).createIndex({ explotacionId: 1 })
    }
  }
}

module.exports = { memoryStore, mongoStore, newId, matches }
