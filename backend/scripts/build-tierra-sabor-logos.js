// Logotipo de cada productor Tierra de Sabor, sacado de su propia web, para la miniatura de las listas.
// Busca en la portada, por este orden: una <img> que sea el logo (src/alt/clase con "logo"), el icono para
// móviles (apple-touch-icon), el favicon grande y la og:image si se llama "logo". Lo guarda en 160×160 WebP.
//   node scripts/build-tierra-sabor-logos.js            (respeta robots.txt; 4 webs a la vez)
//   node scripts/build-tierra-sabor-logos.js --force    (vuelve a bajar los que ya están)
// Salida: frontend/public/assets/productores/<idempresa>.webp y frontend/src/data/producerLogos.json
// Los que salgan mal se apuntan en LOGO_SKIP (y no se descargan).
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
// idempresa cuya "logo" encontrada no es el logotipo (revisado a mano)
const LOGO_SKIP = new Set([563, 704, 772, 2122]) // D.O. Arribes, CERTIFOOD, ayuda UE, foto de un jamón

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
const NOT_OWN = /certifood|certific|union[- ]?europea|financiado|feder|fondo|next[- ]?generation|kit[- ]?digital|ministerio|junta|gobierno|denominaci|d[-_.]?o[-_.]?p|do|tierra[- ]?de[- ]?sabor|tierradesabor|igp|ifs|brc|ecologic|ccpae|enac|aenor|pago|visa|mastercard|paypal|bizum|confianza|whatsapp|facebook|instagram|twitter/i

// Candidatos a logotipo, de más a menos fiable
function candidates({ $, url }) {
  const abs = (u) => { try { return new URL(u, url).href } catch { return null } }
  const out = []
  const LOGO = /logo/i
  $('img').each((_, el) => {
    const img = $(el)
    const src = img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src') || ''
    const hint = [src, img.attr('alt'), img.attr('class'), img.attr('id'), img.parent().attr('class'), img.parent().attr('id')].join(' ')
    if (LOGO.test(hint) && !NOT_OWN.test(hint) && !/^data:/.test(src)) out.push({ from: 'img', url: abs(src), header: img.closest('header, .header, #header, nav').length > 0 })
  })
  out.sort((a, b) => b.header - a.header) // mejor el de la cabecera
  $('link[rel~="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').each((_, el) => out.push({ from: 'apple-touch-icon', url: abs($(el).attr('href')) }))
  const icons = $('link[rel~="icon"]').toArray()
    .map(el => ({ href: $(el).attr('href'), size: Number(String($(el).attr('sizes') || '').split('x')[0]) || 0 }))
    .filter(i => i.size >= 96).sort((a, b) => b.size - a.size)
  for (const i of icons) out.push({ from: 'icon', url: abs(i.href) })
  const og = $('meta[property="og:image"]').attr('content')
  if (og && LOGO.test(og)) out.push({ from: 'og:image', url: abs(og) })
  return out.filter(c => c.url && /^https?:/.test(c.url))
}

// Descarga y normaliza: 160×160 con fondo transparente; dice si el logo es claro (va sobre fondo oscuro)
async function store(url, dest) {
  const { data } = await safeGet(url, { responseType: 'arraybuffer', timeout: 15000, maxBytes: 3 * 1024 * 1024 })
  const input = Buffer.from(data)
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
  if (weight < 160 * 160 * 0.03) throw new Error('casi vacía')
  await sharp(buf.data, { raw: buf.info }).webp({ quality: 85 }).toFile(dest)
  return { light: lum / weight > 185 }
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

  await mapLimit(empresas.filter(e => e.web?.estado === 'ok' && !LOGO_SKIP.has(e.idempresa)), 4, async (e) => {
    const dest = path.join(IMG_DIR, `${e.idempresa}.webp`)
    if (!FORCE && prev[e.idempresa] && fs.existsSync(dest)) { logos[e.idempresa] = prev[e.idempresa]; stats.ok++; return }
    const p = await page(e.web.final || e.web.url)
    if (!p) { stats.sin++; return }
    for (const c of candidates(p).slice(0, 6)) {
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
