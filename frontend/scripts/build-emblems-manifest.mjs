// Genera public/assets/emblems.json con la bandera y el escudo de cada municipio y su crédito:
//   { "37001": { "escudo": { url, autor, licencia, licenciaUrl, fuente } } }
//
// Casi todas las imágenes vienen de Wikimedia Commons y muchas son CC BY-SA, que obliga a citar
// autor y licencia. Por eso solo se publica una imagen si se conoce su crédito:
//   1. Fichero local con crédito en emblems-credits.json (lo escribe scripts/fetch-emblems.mjs; aquí solo se lee).
//   2. Fichero local idéntico (mismo SHA-1, en cualquier versión) a un archivo de Commons candidato:
//      el de Wikidata (P41 bandera / P94 escudo) o el de la ficha de Wikipedia (municipios_md).
//   3. Si ningún fichero local se puede verificar, se enlaza el archivo candidato de Commons.
//   4. Si no hay crédito posible, el municipio se queda sin esa imagen (sale el icono genérico).
//
// Uso: node scripts/build-emblems-manifest.mjs   (desde frontend/)

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', 'public', 'assets')
const mdDir = join(here, '..', '..', 'backend', 'src', 'SaLLMantino', 'ragger', 'script', 'municipios_md')
const UA = { 'User-Agent': 'infoSalamanca-emblems/1.0 (https://infosalamanca.duckdns.org)' }
const IMAGE = /\.(png|svg|jpe?g|webp|gif)$/i
const KINDS = { bandera: { dir: 'flags', prop: 'P41' }, escudo: { dir: 'shields', prop: 'P94' } }

const sleep = ms => new Promise(r => setTimeout(r, ms))
async function getJson(url) {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url, { headers: { ...UA, Accept: 'application/json' } })
    if (res.status === 429 || res.status >= 500) {
      // Commons limita las ráfagas: esperar lo que pida (Retry-After) o cada vez más
      const wait = Number(res.headers.get('retry-after')) * 1000 || 3000 * (i + 1)
      await sleep(wait)
      continue
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    return res.json()
  }
  throw new Error(`Sin respuesta: ${url}`)
}

const title = f => f.replace(/^(File|Archivo|Imagen|Image):/i, '').replace(/_/g, ' ').trim()
const stripHtml = s => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
// Artist a veces es una frase de plantilla ("This vector image includes elements..."), no un nombre
const realArtist = v => { const a = stripHtml(v); return /^this (vector|picture|image|file)\b/i.test(a) ? '' : a }
// SHA-1 del fichero tal cual y, para los SVG, también con saltos LF
// (git en Windows puede haberlos convertido a CRLF al hacer checkout)
const hash = buf => createHash('sha1').update(buf).digest('hex')
const sha1s = file => {
  const buf = readFileSync(file)
  const out = [hash(buf)]
  if (/\.svg$/i.test(file)) out.push(hash(Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8')))
  return out
}
const commonsPage = t => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(t.replace(/ /g, '_'))}`

// URL de la licencia a partir de su nombre corto ("CC BY-SA 4.0" → creativecommons.org/licenses/by-sa/4.0/)
function licenseUrl(name) {
  const m = (name || '').match(/^CC (BY(?:-SA|-NC|-ND)*) (\d\.\d)/i)
  if (m) return `https://creativecommons.org/licenses/${m[1].toLowerCase()}/${m[2]}/`
  if (/^CC0/i.test(name || '')) return 'https://creativecommons.org/publicdomain/zero/1.0/'
  return ''
}

// ---------- Ficheros locales y créditos ya conocidos ----------
const credits = existsSync(join(root, 'emblems-credits.json'))
  ? JSON.parse(readFileSync(join(root, 'emblems-credits.json'), 'utf8'))
  : {}

const local = { bandera: {}, escudo: {} }
for (const [kind, { dir }] of Object.entries(KINDS)) {
  for (const file of readdirSync(join(root, dir)).sort()) {
    const ine = file.match(/^(37\d{3})_/)?.[1]
    if (ine && IMAGE.test(file)) (local[kind][ine] ||= []).push(file)
  }
}

// ---------- Candidatos de Commons: Wikidata y fichas de Wikipedia ----------
const sparql = `SELECT ?ine ?flag ?coa WHERE { ?m wdt:P772 ?ine . FILTER(REGEX(?ine, "^37[0-9]{3}$"))
  OPTIONAL { ?m wdt:P41 ?flag } OPTIONAL { ?m wdt:P94 ?coa } }`
const rows = (await getJson('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql))).results.bindings
const candidates = { bandera: {}, escudo: {} }
const add = (kind, ine, t) => { if (t && IMAGE.test(t)) (candidates[kind][ine] ||= new Set()).add(title(t)) }
const fromUrl = u => decodeURIComponent(u.split('/Special:FilePath/')[1] || '')
for (const r of rows) {
  if (r.flag) add('bandera', r.ine.value, fromUrl(r.flag.value))
  if (r.coa) add('escudo', r.ine.value, fromUrl(r.coa.value))
}
for (const f of readdirSync(mdDir).filter(f => f.endsWith('.md'))) {
  const txt = readFileSync(join(mdDir, f), 'utf8').slice(0, 8000)
  const cod = txt.match(/cod_municipio\s*=\s*(\d+)/)?.[1]
  if (!cod) continue
  const ine = '37' + cod.padStart(3, '0')
  for (const kind of Object.keys(KINDS)) add(kind, ine, txt.match(new RegExp(`\\|\\s*${kind}\\s*=\\s*([^\\n|<{]*)`))?.[1]?.trim())
}
// El archivo de Commons citado en emblems-credits.json también es candidato
for (const [ine, e] of Object.entries(credits)) {
  for (const [kind, cr] of Object.entries(e)) if (cr.commons) add(kind, ine, decodeURIComponent(cr.commons.split('/wiki/File:')[1] || ''))
}

// ---------- Metadatos de Commons (autor, licencia y SHA-1 de todas las versiones) ----------
const info = {}
const allTitles = [...new Set(Object.values(candidates).flatMap(byIne => Object.values(byIne).flatMap(s => [...s])))]
for (let i = 0; i < allTitles.length; i += 50) {
  const batch = allTitles.slice(i, i + 50).map(t => 'File:' + t).join('|')
  const d = await getJson('https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1' +
    '&prop=imageinfo&iiprop=sha1|extmetadata|user&iilimit=1&titles=' + encodeURIComponent(batch))
  const back = {}
  for (const n of [...(d.query.normalized || []), ...(d.query.redirects || [])]) back[n.to] = back[n.from] || n.from
  for (const p of d.query.pages || []) {
    if (!p.imageinfo) continue
    const md = p.imageinfo[0].extmetadata || {}
    const t = title(back[p.title] || p.title)
    const licencia = stripHtml(md.LicenseShortName?.value)
    info[t] = {
      real: title(p.title),
      shas: new Set([p.imageinfo[0].sha1]),
      // Attribution es el crédito que pide el autor; si no, Artist; si no, quien lo subió
      autor: realArtist(md.Attribution?.value) || realArtist(md.Artist?.value) || p.imageinfo[0].user || '',
      licencia,
      licenciaUrl: md.LicenseUrl?.value || licenseUrl(licencia)
    }
  }
}
// Historial de versiones solo para los ficheros locales que no coinciden con la versión actual
async function loadHistory(t) {
  const it = info[t]
  if (!it || it.history) return
  it.history = true
  await sleep(250) // sin ráfagas contra la API de Commons
  const d = await getJson('https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2' +
    '&prop=imageinfo&iiprop=sha1&iilimit=50&titles=' + encodeURIComponent('File:' + it.real))
  for (const v of d.query.pages?.[0]?.imageinfo || []) it.shas.add(v.sha1)
}

// ---------- Elegir imagen y crédito ----------
const credit = (t) => ({
  autor: info[t].autor || '',
  licencia: info[t].licencia || '',
  licenciaUrl: info[t].licenciaUrl || '',
  fuente: commonsPage(info[t].real)
})
const localUrl = (kind, f) => `/assets/${KINDS[kind].dir}/${encodeURIComponent(f)}`
const stats = { credito: 0, verificado: 0, enlazado: 0, sinCredito: [] }

async function pick(kind, ine) {
  const files = local[kind][ine] || []
  const cands = [...(candidates[kind][ine] || [])].filter(t => info[t])
  // Preferir SVG frente a PNG cuando ambos están acreditados
  const ordered = [...files].sort((a, b) => (b.endsWith('.svg') - a.endsWith('.svg')))

  // 1. Crédito de fetch-emblems.mjs
  const cr = credits[ine]?.[kind]
  if (cr && files.includes(cr.archivo)) {
    stats.credito++
    const t = decodeURIComponent(cr.commons?.split('/wiki/File:')[1] || '').replace(/_/g, ' ')
    const sinAutor = !cr.autor || /^desconocido$/i.test(cr.autor)
    return {
      url: localUrl(kind, cr.archivo),
      // El autor de Commons (Attribution) es más fiable que el Artist sin limpiar de emblems-credits.json
      autor: info[t]?.autor || (sinAutor ? '' : realArtist(cr.autor)),
      licencia: cr.licencia || info[t]?.licencia || '',
      licenciaUrl: licenseUrl(cr.licencia) || info[t]?.licenciaUrl || '',
      fuente: cr.commons || ''
    }
  }
  // 2. Fichero local idéntico a un candidato de Commons (versión actual o antigua)
  for (const f of ordered) {
    const hs = sha1s(join(root, KINDS[kind].dir, f))
    let match = cands.find(t => hs.some(h => info[t].shas.has(h)))
    if (!match) {
      for (const t of cands) await loadHistory(t)
      match = cands.find(t => hs.some(h => info[t].shas.has(h)))
    }
    if (match) { stats.verificado++; return { url: localUrl(kind, f), ...credit(match) } }
  }
  // 3. Enlazar el archivo de Commons
  if (cands.length) {
    const t = cands[0]
    stats.enlazado++
    return { url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(info[t].real)}?width=200`, ...credit(t) }
  }
  // 4. Sin crédito: no se publica
  if (files.length) stats.sinCredito.push(`${ine} ${kind}: ${files.join(', ')}`)
  return null
}

const manifest = {}
const ines = new Set(Object.keys(KINDS).flatMap(k => [...Object.keys(local[k]), ...Object.keys(candidates[k])]))
for (const ine of [...ines].sort()) {
  const entry = {}
  for (const kind of Object.keys(KINDS)) {
    const e = await pick(kind, ine)
    if (e) entry[kind] = e
  }
  if (Object.keys(entry).length) manifest[ine] = entry
}

// Miniaturas ligeras para la ficha (scripts/build-emblem-thumbs.py). El original sigue en "url".
let thumbs = 0
for (const [ine, entry] of Object.entries(manifest)) {
  for (const kind of Object.keys(KINDS)) {
    if (entry[kind] && existsSync(join(root, 'emblems-thumbs', `${ine}-${kind}.webp`))) {
      entry[kind].thumb = `/assets/emblems-thumbs/${ine}-${kind}.webp`
      thumbs++
    }
  }
}

// ---------- Estado de la bandera cuando no hay imagen (cruce con BOCyL/BOE en docs/) ----------
// "oficial-sin-imagen": aprobada en un boletín pero sin imagen; "sin-oficial": no aparece en ningún boletín.
function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const [head, ...body] = rows.filter(r => r.length > 1)
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] || ''])))
}
const docsDir = join(here, '..', '..', 'docs')
const readDoc = f => existsSync(join(docsDir, f)) ? parseCsv(readFileSync(join(docsDir, f), 'utf8')) : []
const flagStatus = {}
for (const r of readDoc('emblemas-sin-oficial.csv')) if (r.falta === 'bandera') flagStatus[r.ine] = 'sin-oficial'
for (const r of readDoc('emblemas-oficial-sin-imagen.csv')) if (r.falta === 'bandera') flagStatus[r.ine] = 'oficial-sin-imagen'
let withStatus = 0
for (const [ine, status] of Object.entries(flagStatus)) {
  if (manifest[ine]?.bandera) continue
  manifest[ine] = { ...(manifest[ine] || {}), estadoBandera: status }
  withStatus++
}

writeFileSync(join(root, 'emblems.json'), JSON.stringify(manifest, null, 1) + '\n')
console.log(`  estado de bandera (sin imagen) para ${withStatus} municipios; ${thumbs} miniaturas`)
const count = k => Object.values(manifest).filter(e => e[k]).length
console.log(`emblems.json: ${Object.keys(manifest).length} municipios, ${count('bandera')} banderas, ${count('escudo')} escudos`)
console.log(`  crédito de emblems-credits.json: ${stats.credito}, verificados por SHA-1: ${stats.verificado}, enlazados a Commons: ${stats.enlazado}`)
if (stats.sinCredito.length) {
  console.log(`  ${stats.sinCredito.length} ficheros locales sin crédito (no se muestran):`)
  for (const s of stats.sinCredito) console.log('   - ' + s)
}
