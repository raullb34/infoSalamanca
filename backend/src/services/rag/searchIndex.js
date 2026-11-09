// Índice de búsqueda del asistente: SQLite FTS5 en memoria (better-sqlite3), sin servicios aparte.
// Se construye al primer uso a partir de src/data/town-history.json (Wikipedia, monumentos de la
// Junta y webs de ayuntamientos) y de las fiestas de la base de datos, y se rehace cada 12 horas.
// "Bejar" encuentra "Béjar" (tokenizer unicode61 sin tildes).
const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')
const { findTownsInText } = require('./towns')

const DATA = path.resolve(__dirname, '../../data/town-history.json')
const REBUILD_MS = 12 * 60 * 60 * 1000

let db = null
let builtAt = 0
let building = null

// Palabras que no ayudan a buscar
const STOP = new Set(('a al algo algun alguna como con cual cuales cuando cuanto de del donde el ella en entre es esta este esto ' +
  'fue ha hay la las le lo los mas me mi mucho muy no nos o para pero por que quien se ser si sin sobre son su sus tambien ' +
  'te tiene tienen un una uno unos y ya yo hay dime cuentame quiero saber puedes puedo informacion sobre salamanca pueblo ' +
  'pueblos municipio provincia ver visitar hacer que cual cuales hoy manana').split(' '))

const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function addTownDocs(insert, t) {
  const base = { ine: t.cod_ine, town: t.name }
  if (t.summary) insert({ ...base, kind: 'resumen', title: t.name, text: t.summary, source: 'Wikipedia', url: t.wikipedia?.url })
  ;(t.wikipedia?.paragraphs || []).forEach((p, i) =>
    insert({ ...base, kind: 'historia', title: `Historia de ${t.name}${i ? ` (${i + 1})` : ''}`, text: p, source: 'Wikipedia', url: t.wikipedia?.url }))
  for (const m of t.monuments || []) {
    const meta = [m.type, (m.periods || []).join(', ')].filter(Boolean).join(' · ')
    insert({ ...base, kind: 'patrimonio', title: m.name, text: `${m.name}${meta ? ` (${meta})` : ''}. ${m.description || ''}`, source: 'Junta de Castilla y León', url: m.url })
  }
  if (t.ayuntamiento?.excerpt) {
    insert({ ...base, kind: 'historia', title: t.ayuntamiento.title || `Historia de ${t.name}`, text: t.ayuntamiento.excerpt, source: `Ayuntamiento de ${t.name}`, url: t.ayuntamiento.url })
  }
  for (const e of (t.events || []).filter(e => e.source === 'ayuntamiento')) {
    insert({ ...base, kind: 'historia', title: `${t.name}, ${e.label}`, text: e.text, source: `Ayuntamiento de ${t.name}`, url: e.url })
  }
}

async function festivalDocs() {
  // Fiestas locales (Mongo). Sin base de datos, el índice se queda sin ellas
  try {
    const mongoose = require('mongoose')
    if (mongoose.connection.readyState !== 1) return []
    const MunicipalInfo = require('../../models/municipalInfo')
    const { formatFestivalDays } = require('./dates')
    const docs = await MunicipalInfo.find({ public: true, 'patron_festivals.0': { $exists: true } })
      .select('municipality_name cod_ine patron_festivals').lean()
    return docs.map(d => ({
      ine: d.cod_ine, town: d.municipality_name, kind: 'fiestas', title: `Fiestas de ${d.municipality_name}`,
      text: `Fiestas locales de ${d.municipality_name}: ${d.patron_festivals.map(f => formatFestivalDays(f.celebration_dates)).filter(Boolean).join('; ')}.`,
      source: 'Diputación de Salamanca', url: null
    }))
  } catch {
    return []
  }
}

async function build() {
  const next = new Database(':memory:')
  next.exec(`CREATE VIRTUAL TABLE docs USING fts5(
    ine UNINDEXED, town, kind UNINDEXED, title, text, source UNINDEXED, url UNINDEXED,
    tokenize = 'unicode61 remove_diacritics 2'
  )`)
  const stmt = next.prepare('INSERT INTO docs (ine, town, kind, title, text, source, url) VALUES (@ine, @town, @kind, @title, @text, @source, @url)')
  const insert = (d) => stmt.run({ url: null, ...d })
  const towns = fs.existsSync(DATA) ? Object.values(JSON.parse(fs.readFileSync(DATA, 'utf8')).towns || {}) : []
  next.transaction(() => { for (const t of towns) addTownDocs(insert, t) })()
  const fiestas = await festivalDocs()
  next.transaction(() => { for (const d of fiestas) insert(d) })()
  const n = next.prepare('SELECT count(*) n FROM docs').get().n
  console.log(`🔎 Índice del asistente: ${n} fragmentos (${towns.length} pueblos, ${fiestas.length} con fiestas)`)
  db = next
  builtAt = Date.now()
}

async function ready() {
  if (db && Date.now() - builtAt < REBUILD_MS) return db
  if (!building) building = build().finally(() => { building = null })
  if (!db) await building // la primera vez hay que esperar; después se sirve el anterior mientras se rehace
  return db
}

// Términos de búsqueda de la pregunta: sin palabras vacías ni nombres de pueblo (esos filtran aparte)
function queryTerms(question, towns) {
  let q = plain(question)
  for (const t of towns) q = q.replace(plain(t.name), ' ')
  return [...new Set(q.split(/[^a-z0-9ñ]+/).filter(w => w.length > 2 && !STOP.has(w)))]
}

// Fragmentos más parecidos a la pregunta. Si nombra pueblos, primero los de esos pueblos.
async function search(question, { limit = 8, kinds = null } = {}) {
  const index = await ready()
  const towns = findTownsInText(question)
  const terms = queryTerms(question, towns)
  const match = terms.map(w => `"${w}"*`).join(' OR ')
  const kindSql = kinds ? ` AND kind IN (${kinds.map(() => '?').join(',')})` : ''
  const rows = []
  const seen = new Set()
  const add = (list) => { for (const r of list) if (!seen.has(r.rowid) && rows.length < limit) { seen.add(r.rowid); rows.push(r) } }

  if (towns.length) {
    const ines = towns.map(t => t.ine)
    const inSql = `ine IN (${ines.map(() => '?').join(',')})`
    if (match) add(index.prepare(`SELECT rowid, *, bm25(docs, 0, 2, 0, 3, 1, 0, 0) AS score FROM docs WHERE docs MATCH ? AND ${inSql}${kindSql} ORDER BY score LIMIT ?`).all(match, ...ines, ...(kinds || []), limit))
    // Sin términos (o pocos resultados): lo principal del pueblo
    add(index.prepare(`SELECT rowid, * FROM docs WHERE ${inSql}${kindSql} ORDER BY CASE kind WHEN 'resumen' THEN 0 WHEN 'fiestas' THEN 1 WHEN 'patrimonio' THEN 2 ELSE 3 END, rowid LIMIT ?`).all(...ines, ...(kinds || []), limit))
  } else if (match) {
    add(index.prepare(`SELECT rowid, *, bm25(docs, 0, 2, 0, 3, 1, 0, 0) AS score FROM docs WHERE docs MATCH ?${kindSql} ORDER BY score LIMIT ?`).all(match, ...(kinds || []), limit))
  }
  return { towns, terms, results: rows.map(({ rowid, score, ...r }) => r) }
}

module.exports = { search, ready }
