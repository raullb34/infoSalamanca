// Descarga banderas y escudos de Wikimedia Commons a public/assets/{flags,shields},
// con el nombre que espera build-emblems-manifest.mjs (<ine>_<nombre>_bandera.svg / _shield.svg),
// y guarda la licencia y el autor de cada archivo en public/assets/emblems-credits.json.
//
// Fuentes, de más a menos fiable:
//   1. Wikidata: P41 (bandera) y P94 (escudo) del municipio con código INE P772.
//   2. Ficha de Wikipedia descargada (municipios_md): campos "bandera =" y "escudo =".
//   3. Categorías de Commons "SVG flags/coats of arms of municipalities of the province of Salamanca",
//      emparejando el nombre del archivo con el del municipio (solo coincidencia exacta).
//
// Peso: SVG solo si ocupa ≤ 150 KB. Si no, PNG de 400 px renderizado por Commons.
// Añade lo que falta. Si el municipio solo tenía un PNG, añade un .svg ligero o, si no lo hay,
// sustituye ese PNG (normalmente de 100 px) por el de 400 px con el mismo nombre de archivo.
// Además deja docs/emblemas-pendientes.csv con los municipios a los que aún les falta algo.
//
// Uso (desde frontend/):  node scripts/fetch-emblems.mjs [--dry-run]
// Después:                node scripts/build-emblems-manifest.mjs

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const assets = join(here, '..', 'public', 'assets')
const mdDir = join(here, '..', '..', 'backend', 'src', 'SaLLMantino', 'ragger', 'script', 'municipios_md')
const docsDir = join(here, '..', '..', 'docs')
const DRY = process.argv.includes('--dry-run')
const UA = 'infoSalamanca-emblems/1.0 (https://infosalamanca.duckdns.org)'
const KINDS = {
  bandera: { dir: 'flags', suffix: 'bandera', p: 'P41', cat: 'SVG flags of municipalities of the province of Salamanca', prefixes: ['bandera de', 'flag of'] },
  escudo: { dir: 'shields', suffix: 'shield', p: 'P94', cat: 'SVG coats of arms of municipalities of the province of Salamanca', prefixes: ['escudo de', 'coat of arms of'] }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
async function get(url, asJson = true) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: asJson ? 'application/json' : '*/*' } })
    if (res.status === 429 || res.status >= 500) { await sleep(2000 * (i + 1)); continue }
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    return asJson ? res.json() : Buffer.from(await res.arrayBuffer())
  }
  throw new Error(`Sin respuesta tras varios intentos: ${url}`)
}

// Nombre normalizado: sin tildes ni signos, y sin artículo al principio o al final ("Alberca, La" = "La Alberca")
const ARTICLES = /^(la|el|los|las)\s+|,\s*(la|el|los|las)$/g
function norm(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/_/g, ' ').replace(/\s*\(salamanca\)\s*/g, ' ').trim()
    .replace(ARTICLES, '').replace(/[^a-z0-9ñ]+/g, '')
}
const fileTitle = f => f.replace(/^(File|Archivo|Imagen|Image):/i, '').replace(/_/g, ' ').trim()
const slug = name => name.normalize('NFC').toLowerCase()

// ---------- 1. Municipios y campos de las fichas ----------
const towns = {}
for (const f of readdirSync(mdDir)) {
  if (!f.endsWith('.md')) continue
  const txt = readFileSync(join(mdDir, f), 'utf8').slice(0, 8000)
  const cod = txt.match(/cod_municipio\s*=\s*(\d+)/)?.[1]
  const name = txt.match(/^# (.+)$/m)?.[1]?.trim()
  if (!cod || !name) continue
  const ine = '37' + cod.padStart(3, '0')
  const field = k => txt.match(new RegExp(`\\|\\s*${k}\\s*=\\s*([^\\n|<{]*)`))?.[1]?.trim() || ''
  towns[ine] = { ine, name, infobox: { bandera: field('bandera'), escudo: field('escudo') } }
}
const byNorm = {}
for (const t of Object.values(towns)) byNorm[norm(t.name)] = t.ine
console.log(`Fichas de municipios: ${Object.keys(towns).length}`)

// ---------- 2. Lo que ya hay en el repo ----------
function localFiles(dir) {
  const have = {}
  for (const f of readdirSync(join(assets, dir))) {
    const ine = f.match(/^(37\d{3})_/)?.[1]
    if (!ine) continue
    have[ine] = have[ine] || new Set()
    have[ine].add(f.split('.').pop().toLowerCase())
    if (f.toLowerCase().endsWith('.png')) have[ine].png = f
  }
  return have
}

// ---------- 3. Wikidata ----------
const sparql = `SELECT ?ine ?flag ?coa WHERE { ?m wdt:P772 ?ine . FILTER(REGEX(?ine, "^37[0-9]{3}$"))
  OPTIONAL { ?m wdt:P41 ?flag } OPTIONAL { ?m wdt:P94 ?coa } }`
const wdRows = (await get('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql))).results.bindings
const wd = { bandera: {}, escudo: {} }
const fromUrl = u => decodeURIComponent(u.split('/Special:FilePath/')[1] || '').replace(/_/g, ' ')
for (const r of wdRows) {
  if (r.flag && !wd.bandera[r.ine.value]) wd.bandera[r.ine.value] = fromUrl(r.flag.value)
  if (r.coa && !wd.escudo[r.ine.value]) wd.escudo[r.ine.value] = fromUrl(r.coa.value)
}
console.log(`Wikidata: ${Object.keys(wd.bandera).length} banderas, ${Object.keys(wd.escudo).length} escudos`)

// ---------- 4. Categorías de Commons ----------
async function categoryFiles(cat) {
  const out = []
  let cont = ''
  do {
    const d = await get(`https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&cmtype=file&cmlimit=500&format=json&cmtitle=${encodeURIComponent('Category:' + cat)}${cont}`)
    out.push(...d.query.categorymembers.map(m => fileTitle(m.title)))
    cont = d.continue ? `&cmcontinue=${encodeURIComponent(d.continue.cmcontinue)}` : ''
  } while (cont)
  return out
}
function townFromFile(file, kind) {
  let n = file.replace(/\.(svg|png|jpe?g|gif)$/i, '')
  // Variantes que no son el símbolo actual: no las emparejamos
  if (/\b(antigu|old|histor|propuesta|proposal|variant|\d{4})/i.test(n)) return null
  n = n.replace(/\s*-\s*(bandera|escudo|flag|coat of arms)\s*$/i, '')
  for (const p of KINDS[kind].prefixes) {
    if (n.toLowerCase().startsWith(p + ' ')) { n = n.slice(p.length + 1); break }
  }
  n = n.replace(/^(la localidad de|el municipio de)\s+/i, '')
  return byNorm[norm(n)] || null
}
const cat = { bandera: {}, escudo: {} }
for (const kind of Object.keys(KINDS)) {
  const files = await categoryFiles(KINDS[kind].cat)
  for (const f of files) {
    const ine = townFromFile(f, kind)
    if (ine && !cat[kind][ine]) cat[kind][ine] = f
  }
  console.log(`Commons (${KINDS[kind].cat}): ${files.length} archivos, ${Object.keys(cat[kind]).length} emparejados`)
}

// ---------- 5. Elegir, comprobar licencia y descargar ----------
const credits = existsSync(join(assets, 'emblems-credits.json')) ? JSON.parse(readFileSync(join(assets, 'emblems-credits.json'), 'utf8')) : {}
const strip = h => (h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
async function imageInfo(titles) {
  const info = {}
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40).map(t => 'File:' + t).join('|')
    const d = await get(`https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|size|mime|extmetadata&format=json&titles=${encodeURIComponent(batch)}`)
    const norms = Object.fromEntries((d.query.normalized || []).map(n => [n.to, n.from]))
    for (const p of Object.values(d.query.pages)) {
      if (!p.imageinfo) continue
      const ii = p.imageinfo[0], md = ii.extmetadata || {}
      info[fileTitle(norms[p.title] || p.title)] = info[fileTitle(p.title)] = {
        url: ii.url, mime: ii.mime, size: ii.size,
        page: ii.descriptionurl,
        license: strip(md.LicenseShortName?.value) || 'sin licencia indicada',
        artist: strip(md.Artist?.value) || 'desconocido'
      }
    }
  }
  return info
}

const stats = { bandera: { nuevos: 0, mejorados: 0 }, escudo: { nuevos: 0, mejorados: 0 } }
const plan = []
for (const kind of Object.keys(KINDS)) {
  const have = localFiles(KINDS[kind].dir)
  for (const ine of Object.keys(towns)) {
    const box = towns[ine].infobox[kind]
    const boxFile = box && !/^(no|sí|si|yes)$/i.test(box) ? box : null
    const source = wd[kind][ine] ? ['wikidata', wd[kind][ine]] : boxFile ? ['ficha de Wikipedia', boxFile] : cat[kind][ine] ? ['categoría de Commons', cat[kind][ine]] : null
    if (!source) continue
    const local = have[ine]
    if (local && local.has('svg')) continue // ya tenemos un SVG
    plan.push({ ine, kind, via: source[0], file: fileTitle(source[1]), upgrade: !!local, localPng: local?.png })
  }
}
const info = await imageInfo([...new Set(plan.map(p => p.file))])

for (const p of plan) {
  const ii = info[p.file]
  if (!ii) { console.warn(`  ✗ ${p.ine} ${p.kind}: no existe en Commons "${p.file}"`); continue }
  // SVG solo si pesa poco; si no (o si es una imagen rasterizada), PNG de 400 px de ancho
  const isSvg = ii.mime === 'image/svg+xml' && ii.size <= 150_000
  const url = isSvg ? ii.url : `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(p.file)}?width=400`
  const ext = isSvg ? 'svg' : 'png'
  // Si sustituimos un PNG que ya existía, mantenemos su nombre para no dejar dos PNG del mismo municipio
  const name = !isSvg && p.localPng ? p.localPng : `${p.ine}_${slug(towns[p.ine].name)}_${KINDS[p.kind].suffix}.${ext}`
  if (!DRY) {
    const buf = await get(url, false)
    if (isSvg && !/<svg[\s>]/.test(buf.slice(0, 4000).toString('utf8'))) { console.warn(`  ✗ ${p.ine}: no parece un SVG`); continue }
    writeFileSync(join(assets, KINDS[p.kind].dir, name), buf)
    await sleep(250)
  }
  credits[p.ine] = credits[p.ine] || {}
  credits[p.ine][p.kind] = { archivo: name, commons: ii.page, licencia: ii.license, autor: ii.artist, fuente: p.via, fecha: new Date().toISOString().slice(0, 10) }
  stats[p.kind][p.upgrade ? 'mejorados' : 'nuevos']++
  console.log(`  ✓ ${p.ine} ${towns[p.ine].name}: ${p.kind} ${p.upgrade ? (isSvg ? '(PNG → SVG)' : '(PNG → PNG 400 px)') : `(nuevo, ${ext})`} vía ${p.via}`)
}

// ---------- 6. Créditos y lista de pendientes ----------
if (!DRY) writeFileSync(join(assets, 'emblems-credits.json'), JSON.stringify(credits, null, 1) + '\n')

const flagsNow = localFiles('flags'), coatsNow = localFiles('shields')
const rows = [['ine', 'municipio', 'bandera', 'escudo', 'la_ficha_de_wikipedia_dice']]
for (const t of Object.values(towns).sort((a, b) => a.ine.localeCompare(b.ine))) {
  const f = flagsNow[t.ine] ? 'sí' : 'falta', e = coatsNow[t.ine] ? 'sí' : 'falta'
  if (f === 'sí' && e === 'sí') continue
  const said = /^no$/i.test(t.infobox.bandera) ? 'bandera = no' : ''
  rows.push([t.ine, t.name, f, e, said])
}
if (!DRY) {
  mkdirSync(docsDir, { recursive: true })
  writeFileSync(join(docsDir, 'emblemas-pendientes.csv'), rows.map(r => r.map(c => /[",;]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(',')).join('\n') + '\n')
}
const total = Object.keys(towns).length
console.log(`\nBanderas: ${stats.bandera.nuevos} nuevas, ${stats.bandera.mejorados} mejoradas. Ahora ${Object.keys(flagsNow).length}/${total}.`)
console.log(`Escudos:  ${stats.escudo.nuevos} nuevos, ${stats.escudo.mejorados} mejorados. Ahora ${Object.keys(coatsNow).length}/${total}.`)
console.log(`Pendientes: ${rows.length - 1} municipios en docs/emblemas-pendientes.csv${DRY ? ' (dry-run: no se ha escrito nada)' : ''}`)
