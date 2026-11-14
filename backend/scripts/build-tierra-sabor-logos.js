// Logotipo de cada productor Tierra de Sabor, sacado de su propia web, para la miniatura de las listas.
// Busca en la portada, por este orden: una <img> que sea el logo (src/alt/clase con "logo"), el icono para
// móviles (apple-touch-icon), el favicon grande y la og:image si se llama "logo". Lo guarda en 160×160 WebP.
//   node scripts/build-tierra-sabor-logos.js            (respeta robots.txt; 4 webs a la vez)
//   node scripts/build-tierra-sabor-logos.js --force    (vuelve a bajar los que ya están)
// Salida: frontend/public/assets/productores/<idempresa>.webp y frontend/src/data/producerLogos.json
// Los que salgan mal se apuntan en BAD_URL; los que no estén en la web, en scripts/logos-manuales/.
const fs = require('fs')
const path = require('path')
const cheerio = require('cheerio')
const sharp = require('sharp')
const { safeGet } = require('../src/services/posterService')
const { allowedByRobots } = require('./history/robots')

const DATA = path.resolve(__dirname, '../src/data/tierra-sabor.json')
const FRONT = path.resolve(__dirname, '../../frontend')
const IMG_DIR = path.join(FRONT, 'public/assets/productores')
const OUT = path.join(FRONT, 'src/data/producerLogos.json')
const FORCE = process.argv.includes('--force')
const ONLY = (process.env.ONLY || '').split(',').map(Number).filter(Boolean) // ONLY=563,704 para revisar unos pocos
// Logos puestos a mano: scripts/logos-manuales/<idempresa>.png (mandan sobre lo que haya en la web)
const MANUAL_DIR = path.join(__dirname, 'logos-manuales')
// Imágenes de las webs que parecían el logo y no lo son (revisado a mano)
const BAD_URL = new RegExp([
  'bodegasdeperena\.com/.*arribes', // D.O. Arribes
  'ibericoscanpipork.*certifood', // certificado
  'lopezpuerto\.com/.*(feder|financiado|kit)', // ayuda europea
  'luisdomingo\.com/.*(jamon|paleta)' // foto de un jamón
].join('|'), 'i')

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function page(url) {
  if (!(await allowedByRobots(url))) return null
  try {
    const { data, headers, url: finalUrl } = await safeGet(url, { timeout: 15000, maxBytes: 4 * 1024 * 1024 })
    if (!/html/.test(String(headers['content-type'] || ''))) return null
    return { $: cheerio.load(String(data)), url: finalUrl }
  } catch {
    return null
  } finally {
    await sleep(400)
  }
}

// Logos que hay en las webs pero no son del productor: sellos, denominaciones, ayudas públicas…
const NOT_OWN = /certifood|certific|union[- ]?europea|financiado|feder|fondo|next[- ]?generation|kit[- ]?digital|ministerio|junta|gobierno|denominaci|d[-_.]?o[-_.]?p|\bdo\b|tierra[- ]?de[- ]?sabor|tierradesabor|igp|ifs|brc|ecologic|ccpae|enac|aenor|pago|visa|mastercard|paypal|bizum|confianza|whatsapp|facebook|instagram|twitter|exportaci|iso[ _%-]?\d|ecoembes|logosue|funded|prtr|flags?\/|bandera|premio|award|medalla|guia[- ]?penin/i

// Palabras del nombre del productor que sirven para reconocer su logo por el nombre del archivo
const plainWords = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/[^a-z0-9]+/).filter(w => w.length > 3 && !/^(jamones|embutidos|ibericos|carnicas|quesos|productos|hermanos|hijos|bodegas?)$/.test(w))

// Candidatos a logotipo, de más a menos fiable
function candidates({ $, url }, nombre) {
  const abs = (u) => { try { return new URL(u, url).href } catch { return null } }
  const out = []
  const LOGO = /logo|imagotipo|isotipo|marca/i
  const brand = plainWords(nombre)
  const home = new URL(url).origin
  $('img').each((i, el) => {
    const img = $(el)
    const src = img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src') || ''
    if (!src || /^data:/.test(src)) return
    const hint = [src, img.attr('alt'), img.attr('class'), img.attr('id'), img.parent().attr('class'), img.parent().attr('id')].join(' ')
    if (NOT_OWN.test(hint)) return
    const inHeader = img.closest('header, .header, #header, nav, .navbar, .site-branding').length > 0
    const homeLink = img.closest('a').filter((_, a) => { const h = $(a).attr('href') || ''; return h === '/' || abs(h) === home + '/' || abs(h) === home }).length > 0
    const file = plainWords(src.split('/').pop())
    let score = 0
    if (LOGO.test(hint)) score += 4
    if (homeLink) score += 3
    if (inHeader) score += 2
    if (brand.some(w => file.some(f => f.includes(w)))) score += 3 // "monteparra-…svg"
    score += /\.(svg|png|webp)(\?|$)/i.test(src) ? 1 : -1 // los logos casi nunca son JPG
    if (/slider|banner|slide|fondo|background|hero|galeria|gallery|foto|producto/i.test(src)) score -= 4
    if (score >= 3) out.push({ from: 'img', url: abs(src), score: score - i * 0.01 })
  })
  out.sort((a, b) => b.score - a.score)
  $('link[rel~="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').each((_, el) => out.push({ from: 'apple-touch-icon', url: abs($(el).attr('href')) }))
  const icons = $('link[rel~="icon"]').toArray()
    .map(el => ({ href: $(el).attr('href') || '', size: Number(String($(el).attr('sizes') || '').split('x')[0]) || (/(\d{3})x\1/.exec($(el).attr('href') || '') || [])[1] || 0 }))
    .filter(i => Number(i.size) >= 96).sort((a, b) => b.size - a.size)
  for (const i of icons) out.push({ from: 'icon', url: abs(i.href) })
  const og = $('meta[property="og:image"]').attr('content')
  if (og && LOGO.test(og)) out.push({ from: 'og:image', url: abs(og) })
  const seen = new Set()
  return out.filter(c => c.url && /^https?:/.test(c.url) && !BAD_URL.test(c.url) && !seen.has(c.url) && seen.add(c.url))
}

// Descarga y normaliza: 160×160 con fondo transparente; dice si el logo es claro (va sobre fondo oscuro)
async function store(url, dest) {
  const input = /^https?:/.test(url)
    ? Buffer.from((await safeGet(url, { responseType: 'arraybuffer', timeout: 15000, maxBytes: 3 * 1024 * 1024 })).data)
    : fs.readFileSync(url)
  const img = sharp(input, { density: 200 })
  const meta = await img.metadata()
  if (!meta.width || meta.width < 48 || meta.height < 24) throw new Error('demasiado pequeña')
  if (meta.width / meta.height > 6 || meta.height / meta.width > 3) throw new Error('proporción rara')
  // Sin márgenes (si se puede) y encajado en 160×160 con fondo transparente
  let trimmed = input
  try { trimmed = await sharp(input, { density: 200 }).trim({ threshold: 10 }).png().toBuffer() } catch { /* tal cual */ }
  const buf = await sharp(trimmed, { density: 200 })
    .resize(160, 160, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  // Luminosidad media de lo visible
  let lum = 0
  let weight = 0
  const px = buf.data
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3] / 255
    lum += a * (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2])
    weight += a
  }
  if (weight < 160 * 160 * 0.01) throw new Error('casi vacía')
  await sharp(buf.data, { raw: buf.info }).webp({ quality: 85 }).toFile(dest)
  return { light: lum / weight > 160 }
}

async function mapLimit(items, n, fn) {
  const queue = [...items]
  await Promise.all(Array.from({ length: n }, async () => { while (queue.length) await fn(queue.shift()) }))
}

async function main() {
  const { empresas } = JSON.parse(fs.readFileSync(DATA, 'utf8'))
  fs.mkdirSync(IMG_DIR, { recursive: true })
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).logos || {} : {}
  const logos = {}
  const stats = { ok: 0, sin: 0 }

  // Los manuales primero
  const manual = new Set()
  for (const f of fs.existsSync(MANUAL_DIR) ? fs.readdirSync(MANUAL_DIR) : []) {
    const id = Number(path.basename(f, path.extname(f)))
    if (!id) continue
    const { light } = await store(path.join(MANUAL_DIR, f), path.join(IMG_DIR, `${id}.webp`))
    logos[id] = { src: `/assets/productores/${id}.webp`, light, from: 'manual' }
    manual.add(id)
    stats.ok++
  }

  await mapLimit(empresas.filter(e => ['ok', 'no responde'].includes(e.web?.estado) && e.web?.url && !manual.has(e.idempresa)), 4, async (e) => {
    const dest = path.join(IMG_DIR, `${e.idempresa}.webp`)
    const redo = FORCE || ONLY.includes(e.idempresa)
    if (!redo && (ONLY.length || prev[e.idempresa]) && (prev[e.idempresa] ? fs.existsSync(dest) : true)) {
      if (prev[e.idempresa]) { logos[e.idempresa] = prev[e.idempresa]; stats.ok++ }
      return
    }
    const p = await page(e.web.final || e.web.url)
    if (!p) { stats.sin++; return }
    const cands = candidates(p, e.nombre)
    if (process.env.DEBUG) console.log(e.idempresa, e.nombre, cands.slice(0, 6).map(c => `${c.from} ${c.url}`))
    for (const c of cands.slice(0, 6)) {
      try {
        const { light } = await store(c.url, dest)
        logos[e.idempresa] = { src: `/assets/productores/${e.idempresa}.webp`, light, from: c.from, url: c.url }
        stats.ok++
        console.log('✓', e.nombre, '←', c.from)
        return
      } catch (err) { if (process.env.DEBUG) console.log('  ✗', c.url, err.message) }
    }
    stats.sin++
    console.log('·', e.nombre, 'sin logo')
  })

  const sorted = Object.fromEntries(Object.entries(logos).sort((a, b) => a[0] - b[0]))
  fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), note: 'Logotipos sacados de la web de cada productor (scripts/build-tierra-sabor-logos.js)', logos: sorted }, null, 1))
  console.log(`\n${stats.ok} con logo · ${stats.sin} sin logo → ${path.relative(process.cwd(), OUT)}`)
}

main().catch(err => { console.error(err); process.exit(1) })
