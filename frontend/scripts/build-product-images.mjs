// Fotos de producto y logotipos de sellos de calidad para el escaparate de Tierra de Sabor.
// Lee scripts/product-images.picks.json (archivos de Wikimedia Commons elegidos a mano), descarga cada
// foto, la recorta a 800×600 en WebP y guarda autor y licencia para mostrarlos (CC BY/BY-SA lo exigen).
//   npx -y node@20 scripts/build-product-images.mjs      (sharp necesita Node ≥ 18.17)
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PICKS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/product-images.picks.json'), 'utf8'))
const IMG_DIR = path.join(ROOT, 'public/assets/productos')
const SEAL_DIR = path.join(ROOT, 'public/assets/sellos')
const OUT = path.join(ROOT, 'src/data/productImages.json')
const UA = 'infoSalamanca-bot/1.0 (+https://infosalamanca.duckdns.org)'

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const strip = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function get(url, type = 'json') {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } })
    if (r.ok) return type === 'json' ? r.json() : Buffer.from(await r.arrayBuffer())
    await sleep(1500 * (i + 1)) // Commons limita la descarga de miniaturas
  }
  throw new Error(`No se pudo descargar ${url}`)
}

// Datos de varios archivos de una vez: URL de la miniatura, autor y licencia
async function info(titles) {
  const out = {}
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40)
    const d = await get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800&titles=${encodeURIComponent(batch.join('|'))}`)
    const norm = Object.fromEntries((d.query.normalized || []).map(n => [n.to, n.from]))
    for (const p of Object.values(d.query.pages)) {
      const ii = p.imageinfo?.[0]
      if (!ii) throw new Error(`No está en Commons: ${p.title}`)
      const m = ii.extmetadata || {}
      out[norm[p.title] || p.title] = {
        thumb: ii.thumburl, original: ii.url, page: ii.descriptionurl,
        author: strip(m.Artist?.value).slice(0, 120) || 'Autor desconocido',
        license: strip(m.LicenseShortName?.value), licenseUrl: m.LicenseUrl?.value || null
      }
    }
  }
  return out
}

fs.mkdirSync(IMG_DIR, { recursive: true })
fs.mkdirSync(SEAL_DIR, { recursive: true })

const variedades = PICKS.variedades
const meta = await info([...new Set(Object.values(variedades))])
const result = { generated: new Date().toISOString(), source: 'Wikimedia Commons', variedades: {}, sellos: {} }

for (const [variedad, title] of Object.entries(variedades)) {
  const m = meta[title]
  const file = `${slug(variedad)}.webp`
  const dest = path.join(IMG_DIR, file)
  if (!fs.existsSync(dest)) {
    const buf = await get(m.thumb, 'buffer')
    await sharp(buf).resize(800, 600, { fit: 'cover', position: 'attention' }).webp({ quality: 68 }).toFile(dest)
    await sleep(400)
  }
  result.variedades[variedad] = { src: `/assets/productos/${file}`, title: title.replace(/^File:/, ''), page: m.page, author: m.author, license: m.license, licenseUrl: m.licenseUrl }
  console.log('✓', variedad)
}

// Logotipos oficiales de la UE (dominio público): se guardan tal cual, en SVG
const sm = await info(Object.values(PICKS.sellos))
for (const [key, title] of Object.entries(PICKS.sellos)) {
  const m = sm[title]
  const dest = path.join(SEAL_DIR, `${key}.svg`)
  if (!fs.existsSync(dest)) fs.writeFileSync(dest, await get(m.original, 'buffer'))
  result.sellos[key] = { src: `/assets/sellos/${key}.svg`, page: m.page, author: m.author, license: m.license }
  console.log('✓ sello', key)
}

fs.writeFileSync(OUT, JSON.stringify(result, null, 1))
console.log(`${Object.keys(result.variedades).length} fotos y ${Object.keys(result.sellos).length} sellos → ${path.relative(ROOT, OUT)}`)
