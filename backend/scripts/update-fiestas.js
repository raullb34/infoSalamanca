#!/usr/bin/env node
// Fiestas locales de cada municipio según la Diputación de Salamanca (ficha municipal de lasalina.es).
// Las fechas que había en la base venían de un PDF antiguo y algunas no coinciden (Ledesma: 19 y 23 de
// junio en la base, 27 y 31 de mayo según la Diputación).
//
// Uso (desde backend/):
//   node scripts/update-fiestas.js            descarga las fichas → src/data/fiestas-diputacion.json
//   node scripts/update-fiestas.js --apply    aplica el JSON a la base de datos (municipalInfo)
//        en el VPS: docker compose exec backend node scripts/update-fiestas.js --apply
//   ... --apply --dry-run                     muestra los cambios sin guardarlos
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const OUT = path.resolve(__dirname, '../src/data/fiestas-diputacion.json')
const MONTHS = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 }
const argv = process.argv.slice(2)
const flag = (n) => argv.includes(`--${n}`)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const mmdd = (m, d) => `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

// "27 de mayo y 31 de mayo", "2 y 3 de febrero", "15 de agosto" → ['05-27', '05-31']
function parseDates(text) {
  const out = []
  const t = String(text || '').toLowerCase()
  // Erratas de la ficha: "20 de3 febrero", "12 diciembre" (sin "de")
  for (const m of t.matchAll(/(\d{1,2})(?:\s*y\s*(\d{1,2}))?\s+(?:de\d*\s+)?([a-zñ]+)/g)) {
    const month = MONTHS[m[3]]
    if (!month) continue
    for (const d of [m[1], m[2]].filter(Boolean)) {
      if (+d >= 1 && +d <= 31) out.push(mmdd(month, +d))
    }
  }
  return [...new Set(out)]
}

async function download() {
  const { diputacionFicha } = require('./history/sources')
  const { displayName } = require('../src/helpers/townIndex')
  const seen = new Map()
  for (const r of require('../src/helpers/ine-codigopostal.json')) {
    const ine = String(r.CodMunicipio)
    if (/^37\d{3}$/.test(ine) && !seen.has(ine)) seen.set(ine, displayName(r.Municipio))
  }
  const towns = {}
  let n = 0
  for (const [ine, name] of seen) {
    try {
      const { fiestas } = await diputacionFicha(ine)
      towns[ine] = { name, text: fiestas, dates: parseDates(fiestas) }
    } catch (e) {
      console.warn(`  ⚠️ ${name}: ${e.message}`)
    }
    if (++n % 50 === 0) console.log(`  ${n}/${seen.size}`)
    await sleep(400)
  }
  fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), source: 'Diputación de Salamanca (lasalina.es)', towns }, null, 1) + '\n')
  const ok = Object.values(towns).filter(t => t.dates.length).length
  const odd = Object.entries(towns).filter(([, t]) => t.text && !t.dates.length)
  console.log(`✅ fiestas-diputacion.json: ${Object.keys(towns).length} municipios, ${ok} con fechas`)
  if (odd.length) console.log('   Sin poder leer la fecha:', odd.map(([, t]) => `${t.name} ("${t.text}")`).join('; '))
}

async function apply() {
  const mongoose = require('mongoose')
  const MunicipalInfo = require('../src/models/municipalInfo')
  if (!process.env.MONGODB_URI) throw new Error('Falta MONGODB_URI')
  const { towns } = JSON.parse(fs.readFileSync(OUT, 'utf8'))
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  let changed = 0, created = 0, same = 0
  for (const [ine, t] of Object.entries(towns)) {
    if (!t.dates.length) continue
    const [start, end] = [t.dates[0], t.dates[1] || t.dates[0]]
    const doc = await MunicipalInfo.findOne({ cod_ine: ine })
    if (!doc) {
      if (!flag('dry-run')) {
        await MunicipalInfo.create({
          cod_ine: ine, municipality_name: t.name, public: true,
          patron_festivals: [{ name: 'Fiestas Patronales', celebration_dates: { start_date: start, end_date: end, approximate: false } }]
        })
      }
      created++
      console.log(`  + ${t.name}: ${t.text}`)
      continue
    }
    const fest = doc.patron_festivals?.[0]
    const before = fest?.celebration_dates || {}
    if (before.start_date === start && before.end_date === end) { same++; continue }
    console.log(`  ~ ${t.name}: ${before.start_date || '?'}/${before.end_date || '?'} → ${start}/${end} (${t.text})`)
    changed++
    if (flag('dry-run')) continue
    if (fest) {
      fest.celebration_dates = { ...(before.toObject ? before.toObject() : before), start_date: start, end_date: end, approximate: false }
    } else {
      doc.patron_festivals = [{ name: 'Fiestas Patronales', celebration_dates: { start_date: start, end_date: end, approximate: false } }]
    }
    await doc.save()
  }
  console.log(`✅ ${changed} actualizados, ${created} nuevos, ${same} ya estaban bien${flag('dry-run') ? ' (prueba, sin guardar)' : ''}`)
  await mongoose.disconnect()
}

;(flag('apply') ? apply() : download()).catch(e => {
  console.error('❌', e.message)
  process.exit(1)
})
