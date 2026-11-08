// Genera public/assets/emblems.json: { "37001": { "bandera": url, "escudo": url } }
// Primero usa los ficheros de public/assets/flags y public/assets/shields (empiezan por el código INE).
// Si falta alguno, usa la imagen de Wikidata (P41 bandera, P94 escudo), servida desde Wikimedia Commons.
//
// Uso: node scripts/build-emblems-manifest.mjs   (desde frontend/)

import { readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets')
const IMAGE = /\.(png|svg|jpe?g|webp)$/i

function localFiles(dir, urlBase) {
  const byIne = {}
  for (const file of readdirSync(join(root, dir)).sort()) {
    const ine = file.match(/^(37\d{3})_/)?.[1]
    if (!ine || !IMAGE.test(file)) continue
    // Si hay .svg y .png del mismo municipio, nos quedamos con el .svg
    if (!byIne[ine] || file.endsWith('.svg')) {
      byIne[ine] = `${urlBase}/${encodeURIComponent(file)}`
    }
  }
  return byIne
}

async function wikidataEmblems() {
  const query = `SELECT ?ine ?flag ?coa WHERE {
    ?m wdt:P772 ?ine . FILTER(REGEX(?ine, "^37[0-9]{3}$"))
    OPTIONAL { ?m wdt:P41 ?flag } OPTIONAL { ?m wdt:P94 ?coa } }`
  const url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(query)
  const res = await fetch(url, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'infoSalamanca-emblems/1.0' }
  })
  if (!res.ok) throw new Error(`Wikidata respondió ${res.status}`)
  const rows = (await res.json()).results.bindings
  // Miniatura de 200 px por https (Commons redirige al fichero real)
  const thumb = (v) => v.replace(/^http:/, 'https:') + '?width=200'
  const flags = {}
  const coats = {}
  for (const r of rows) {
    const ine = r.ine.value
    if (r.flag && !flags[ine]) flags[ine] = thumb(r.flag.value)
    if (r.coa && !coats[ine]) coats[ine] = thumb(r.coa.value)
  }
  return { flags, coats }
}

const localFlags = localFiles('flags', '/assets/flags')
const localCoats = localFiles('shields', '/assets/shields')
const wd = await wikidataEmblems()

const manifest = {}
const ines = new Set([...Object.keys(localFlags), ...Object.keys(localCoats), ...Object.keys(wd.flags), ...Object.keys(wd.coats)])
for (const ine of [...ines].sort()) {
  const bandera = localFlags[ine] || wd.flags[ine]
  const escudo = localCoats[ine] || wd.coats[ine]
  manifest[ine] = { ...(bandera && { bandera }), ...(escudo && { escudo }) }
}

writeFileSync(join(root, 'emblems.json'), JSON.stringify(manifest, null, 1) + '\n')
const count = (k) => Object.values(manifest).filter(e => e[k]).length
console.log(`emblems.json: ${ines.size} municipios, ${count('bandera')} banderas, ${count('escudo')} escudos`)
