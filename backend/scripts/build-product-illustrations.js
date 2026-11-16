#!/usr/bin/env node
// Ilustraciones de producto para el escaparate de Tierra de Sabor, generadas con la API de imágenes de OpenAI.
// Lee frontend/scripts/product-illustrations.json (estilo común + escena de cada presentación), pide cada
// imagen con fondo transparente, la reduce a 640×640 en WebP y escribe frontend/src/data/productIllustrations.json,
// que usa frontend/src/utils/tierraSabor.js. Son envases genéricos: sin marcas, texto ni logotipos.
//
// Uso (desde backend/, con OPENAI_API_KEY en el .env de la raíz):
//   node scripts/build-product-illustrations.js              genera las que faltan
//   node scripts/build-product-illustrations.js miel-brezo   rehace solo esas (ids separados por espacios)
//   node scripts/build-product-illustrations.js --all        rehace todas
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })
const { createCanvas, loadImage } = require('@napi-rs/canvas')

const FRONT = path.resolve(__dirname, '../../frontend')
const SPEC = JSON.parse(fs.readFileSync(path.join(FRONT, 'scripts/product-illustrations.json'), 'utf8'))
const IMG_DIR = path.join(FRONT, 'public/assets/productos/ilustraciones')
const OUT = path.join(FRONT, 'src/data/productIllustrations.json')
const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2'
const SIZE = 640
const PARALLEL = 4

const argv = process.argv.slice(2)
const all = argv.includes('--all')
const only = argv.filter(a => !a.startsWith('--'))

const promptFor = (it) => `${SPEC.estilo}\n\nObjeto: ${it.titulo}. ${it.escena}`

// gpt-image-2 no admite fondo transparente: se pide fondo blanco liso y se quita aquí
async function request(prompt) {
  const body = { model: MODEL, prompt, size: '1024x1024', quality: 'medium', n: 1 }
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000)
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error?.message || `HTTP ${res.status}`)
  const b64 = json.data?.[0]?.b64_json
  if (!b64) throw new Error('sin imagen en la respuesta')
  return Buffer.from(b64, 'base64')
}

// Quita el fondo: rellena desde los bordes los píxeles parecidos al color del fondo (transparentes) y suaviza
// el borde del dibujo (semitransparente según lo que se parezca al fondo). La sombra del bodegón se queda.
const NEAR = 26
const EDGE = 70
function removeBackground(data, w, h) {
  const px = (i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]
  const corners = [0, w - 1, (h - 1) * w, h * w - 1].map(px)
  const bg = [0, 1, 2].map(c => corners.reduce((a, p) => a + p[c], 0) / 4)
  const dist = (i) => { const p = px(i); return Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]) }
  const seen = new Uint8Array(w * h)
  const stack = []
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x)
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1)
  while (stack.length) {
    const i = stack.pop()
    if (seen[i]) continue
    const d = dist(i)
    if (d > EDGE) continue
    seen[i] = 1
    // Fondo puro: transparente; transición hacia el dibujo: alfa proporcional a la diferencia
    data[i * 4 + 3] = d <= NEAR ? 0 : Math.round(255 * (d - NEAR) / (EDGE - NEAR))
    if (d > NEAR) continue // no se sigue rellenando a través del borde del dibujo
    const x = i % w
    if (x > 0) stack.push(i - 1)
    if (x < w - 1) stack.push(i + 1)
    if (i >= w) stack.push(i - w)
    if (i < w * (h - 1)) stack.push(i + w)
  }
}

async function generate(it) {
  const png = await request(promptFor(it))
  // @napi-rs/canvas no reconoce estos PNG desde un Buffer (llevan metadatos C2PA), pero sí desde un archivo
  const tmp = path.join(require('os').tmpdir(), `ilustracion-${it.id}-${process.pid}.png`)
  fs.writeFileSync(tmp, png)
  const img = await loadImage(tmp)
  fs.unlinkSync(tmp)
  const full = createCanvas(img.width, img.height)
  const fctx = full.getContext('2d')
  fctx.drawImage(img, 0, 0)
  const pixels = fctx.getImageData(0, 0, img.width, img.height)
  removeBackground(pixels.data, img.width, img.height)
  fctx.putImageData(pixels, 0, 0)
  const canvas = createCanvas(SIZE, SIZE)
  canvas.getContext('2d').drawImage(full, 0, 0, SIZE, SIZE)
  fs.writeFileSync(path.join(IMG_DIR, `${it.id}.webp`), await canvas.encode('webp', 88))
  return true
}

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error('Falta OPENAI_API_KEY en el .env')
  fs.mkdirSync(IMG_DIR, { recursive: true })
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { items: {} }
  const todo = SPEC.ilustraciones.filter(it => all || only.includes(it.id) ||
    (!only.length && !fs.existsSync(path.join(IMG_DIR, `${it.id}.webp`))))
  console.log(`${todo.length} ilustraciones que generar con ${MODEL}`)

  const done = {}
  const queue = [...todo]
  await Promise.all(Array.from({ length: PARALLEL }, async () => {
    for (let it = queue.shift(); it; it = queue.shift()) {
      const t0 = Date.now()
      try {
        await generate(it)
        done[it.id] = { generado: new Date().toISOString().slice(0, 10), modelo: MODEL }
        console.log(`✅ ${it.id} (${Math.round((Date.now() - t0) / 1000)} s)`)
      } catch (e) {
        console.log(`❌ ${it.id}: ${e.message}`)
      }
    }
  }))

  // Manifiesto en el orden del JSON (el orden decide qué ilustración gana: las más concretas van primero)
  const items = SPEC.ilustraciones
    .filter(it => fs.existsSync(path.join(IMG_DIR, `${it.id}.webp`)))
    .map(it => {
      const old = (prev.items || []).find(p => p.id === it.id)
      const made = done[it.id] || old || {}
      return {
        id: it.id,
        titulo: it.titulo,
        variedad: it.variedad,
        // Palabras del nombre (en minúsculas y sin tildes); cualquiera vale
        match: it.match ? [].concat(it.match) : null,
        precinto: it.precinto || null,
        // Productores (idempresa) a cuyos productos de esa variedad se aplica siempre
        empresas: it.empresas || null,
        card: Boolean(it.card),
        src: `/assets/productos/ilustraciones/${it.id}.webp`,
        generado: made.generado || null,
        modelo: made.modelo || null
      }
    })
  fs.writeFileSync(OUT, `${JSON.stringify({ fuente: 'Ilustraciones generadas con IA (OpenAI) para infoSalamanca: envases genéricos, no son los de cada productor', items }, null, 1)}\n`)
  console.log(`📄 ${path.relative(process.cwd(), OUT)}: ${items.length} ilustraciones`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
