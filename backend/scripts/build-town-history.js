#!/usr/bin/env node
// Historia de cada pueblo a partir de cuatro fuentes y carga en la base de datos (colección townHistory):
//   - Wikipedia (artículos ya descargados): resumen, texto de Historia y hitos con fecha
//   - Junta de Castilla y León, "Relación de monumentos": monumentos y sus fechas
//   - Diputación de Salamanca: la web oficial de cada ayuntamiento (se guarda en src/data/ayuntamientos-web.json)
//   - Web del ayuntamiento: su página de "Historia" (extracto, enlace y hitos con fecha)
// Resultado: src/data/town-history.json (lo lee la API si no hay base de datos) y, con --load, Mongo.
//
// Uso (desde backend/):
//   node scripts/build-town-history.js                   todo (las webs ya visitadas no se repiten)
//   node scripts/build-town-history.js --recrawl         vuelve a visitar las webs de los ayuntamientos
//   node scripts/build-town-history.js --no-web          sin webs de ayuntamientos (rápido)
//   node scripts/build-town-history.js --ine 37170,37046 solo esos pueblos
//   node scripts/build-town-history.js --load-only       carga el JSON en Mongo (en el VPS:
//        docker compose exec backend node scripts/build-town-history.js --load-only)
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })
const { wikipedia, jcylMonuments, diputacionWebs, ayuntamientoHistory, JCYL_PAGE } = require('./history/sources')
const { extractEvents, pickEvents } = require('./history/extractEvents')

const OUT = path.resolve(__dirname, '../src/data/town-history.json')
const WEBS = path.resolve(__dirname, '../src/data/ayuntamientos-web.json')
// Texto completo de las páginas de historia de los ayuntamientos: solo en local (tiene derechos de
// autor y el repositorio es público); sirve para no volver a visitar las webs cada vez
const AYTO_CACHE = path.resolve(__dirname, '../.cache/ayuntamientos-historia.json')
const argv = process.argv.slice(2)
const flag = (n) => argv.includes(`--${n}`)
const option = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null }

const MAX_EVENTS = 18
const MAX_PARAGRAPHS = 12
const EXCERPT = 420

const SOURCES = {
  wikipedia: { name: 'Wikipedia', license: 'CC BY-SA 4.0' },
  jcyl: { name: 'Junta de Castilla y León · Relación de monumentos', url: JCYL_PAGE, license: 'CC BY 4.0' },
  ayuntamiento: { name: 'Web del ayuntamiento', license: 'Extracto con enlace a la fuente' }
}

const excerpt = (paras) => {
  const t = (paras || []).join(' ')
  return t.length <= EXCERPT ? t : t.slice(0, t.lastIndexOf(' ', EXCERPT)) + '…'
}

async function mapLimit(items, limit, fn) {
  const queue = [...items]
  await Promise.all(Array.from({ length: limit }, async () => {
    while (queue.length) await fn(queue.shift())
  }))
}

async function build() {
  const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).towns || {} : {}
  const aytoCache = fs.existsSync(AYTO_CACHE) ? JSON.parse(fs.readFileSync(AYTO_CACHE, 'utf8')) : {}
  const only = option('ine') ? new Set(option('ine').split(',')) : null

  console.log('📖 Wikipedia…')
  const wiki = wikipedia()
  const ines = Object.keys(wiki).filter(ine => !only || only.has(ine)).sort()

  console.log('🏛️  Monumentos de la Junta…')
  const { byIne: monuments, total } = await jcylMonuments()
  console.log(`   ${total} monumentos en ${Object.keys(monuments).length} pueblos`)

  const town = {}
  // undefined = web no visitada; null = visitada sin página de historia
  for (const ine of ines) town[ine] = { ayuntamiento: aytoCache[ine] }

  if (!flag('no-web')) {
    console.log('🏢 Webs de los ayuntamientos (Diputación)…')
    const webs = await diputacionWebs(ines, { cacheFile: WEBS, refresh: flag('refresh-webs'), log: console.warn })
    const todo = ines.filter(ine => webs[ine]?.web && (flag('recrawl') || !(ine in aytoCache)))
    console.log(`   ${Object.values(webs).filter(w => w.web).length} con web; visitando ${todo.length}`)
    let done = 0
    await mapLimit(todo, 4, async (ine) => {
      try {
        town[ine].ayuntamiento = await ayuntamientoHistory(webs[ine].web, wiki[ine].name)
      } catch (e) {
        town[ine].ayuntamiento = null
      }
      aytoCache[ine] = town[ine].ayuntamiento
      if (++done % 20 === 0) {
        console.log(`   ${done}/${todo.length}`)
        fs.mkdirSync(path.dirname(AYTO_CACHE), { recursive: true })
        fs.writeFileSync(AYTO_CACHE, JSON.stringify(aytoCache))
      }
    })
    fs.mkdirSync(path.dirname(AYTO_CACHE), { recursive: true })
    fs.writeFileSync(AYTO_CACHE, JSON.stringify(aytoCache))
  }

  const towns = only ? { ...previous } : {}
  let withEvents = 0
  for (const ine of ines) {
    const w = wiki[ine]
    const ayto = town[ine].ayuntamiento
    const mons = monuments[ine] || []
    const events = [
      ...extractEvents(w.history).map(e => ({ ...e, source: 'wikipedia', url: w.url })),
      ...mons.flatMap(m => extractEvents(m.description, { prefix: m.name }).map(e => ({ ...e, source: 'jcyl', url: m.url }))),
      ...(ayto ? extractEvents(ayto.paragraphs).map(e => ({ ...e, source: 'ayuntamiento', url: ayto.url })) : []),
      ...extractEvents(w.heritage).map(e => ({ ...e, source: 'wikipedia', url: w.url }))
    ]
    const picked = pickEvents(events, MAX_EVENTS)
    if (picked.length) withEvents++
    const used = new Set(['wikipedia', ...(mons.length ? ['jcyl'] : []), ...(ayto ? ['ayuntamiento'] : [])])
    towns[ine] = {
      cod_ine: ine,
      name: w.name,
      summary: w.summary,
      events: picked,
      monuments: mons,
      wikipedia: { url: w.url, paragraphs: w.history.slice(0, MAX_PARAGRAPHS) },
      ayuntamiento: ayto ? { url: ayto.url, title: ayto.title, excerpt: excerpt(ayto.paragraphs) } : null,
      sources: [...used].map(k => ({ ...SOURCES[k], url: k === 'wikipedia' ? w.url : k === 'ayuntamiento' ? ayto.url : SOURCES[k].url }))
    }
  }

  fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), towns }, null, 1) + '\n')
  const n = Object.keys(towns).length
  const aytos = Object.values(towns).filter(t => t.ayuntamiento).length
  console.log(`✅ town-history.json: ${n} pueblos · ${withEvents} con hitos · ${Object.keys(monuments).length} con monumentos · ${aytos} con historia de su web`)
}

async function load() {
  const mongoose = require('mongoose')
  const TownHistory = require('../src/models/townHistory')
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('Falta MONGODB_URI')
  const { towns } = JSON.parse(fs.readFileSync(OUT, 'utf8'))
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
  const ops = Object.values(towns).map(t => ({
    replaceOne: { filter: { cod_ine: t.cod_ine }, replacement: { ...t, updated_at: new Date() }, upsert: true }
  }))
  const res = await TownHistory.bulkWrite(ops)
  console.log(`✅ Mongo townHistory: ${res.upsertedCount} nuevos, ${res.modifiedCount} actualizados`)
  await mongoose.disconnect()
}

;(async () => {
  if (!flag('load-only')) await build()
  if (flag('load') || flag('load-only')) await load()
})().catch(e => {
  console.error('❌', e.message)
  process.exit(1)
})
