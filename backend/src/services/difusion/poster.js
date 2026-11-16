// Cartel semanal en imagen (PNG 1080×1350, 4:5, el formato que mejor se ve en el móvil) para el canal de WhatsApp
// y la cabecera de la newsletter: espectáculos, fiestas, eventos de ciencia y el tiempo de la semana.
// Se dibuja con @napi-rs/canvas (Skia) y la tipografía Poppins (SIL OFL, en backend/assets/fonts), así que sale
// igual en el servidor (Alpine, sin fuentes del sistema) que en local. Los iconos del tiempo se dibujan a mano.
const path = require('path')
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas')

const FONT_DIR = path.resolve(__dirname, '../../../assets/fonts')
let fontsReady = false
function loadFonts() {
  if (fontsReady) return
  for (const w of ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold']) GlobalFonts.registerFromPath(path.join(FONT_DIR, `Poppins-${w}.ttf`), 'Poppins')
  fontsReady = true
}

const W = 1080
const H = 1350
const PAD = 56
const C = {
  bg: '#f7f5f0', ink: '#1d2228', muted: '#5d6670', line: '#e3dfd6', card: '#ffffff',
  brand: '#1f6b3a', brand2: '#2f8a4f', brandInk: '#ffffff', soft: '#dff0e3'
}
// Un color por sección (contraste ≥ 4,5:1 con el texto blanco de la fecha)
const SECTION = {
  espectaculos: { color: '#a8324a', label: 'Espectáculos' },
  fiestas: { color: '#a35214', label: 'Fiestas en los pueblos' },
  ciencia: { color: '#25609c', label: 'Ciencia' }
}

const WEEK = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const parse = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)) }
const range = (a, b) => {
  const A = parse(a); const B = parse(b)
  return A.getUTCMonth() === B.getUTCMonth()
    ? `Del ${A.getUTCDate()} al ${B.getUTCDate()} de ${MONTHS[B.getUTCMonth()]}`
    : `Del ${A.getUTCDate()} de ${MONTHS[A.getUTCMonth()]} al ${B.getUTCDate()} de ${MONTHS[B.getUTCMonth()]}`
}
const font = (weight, size) => `${weight} ${size}px Poppins`

// Texto en líneas que caben en `max` píxeles; la última se corta con "…"
function wrap(ctx, text, max, maxLines) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ')
  const lines = []
  let cur = ''
  for (let i = 0; i < words.length; i++) {
    const test = cur ? `${cur} ${words[i]}` : words[i]
    if (ctx.measureText(test).width <= max) { cur = test; continue }
    if (cur) lines.push(cur)
    cur = words[i]
    if (lines.length === maxLines) break
  }
  if (lines.length < maxLines && cur) lines.push(cur)
  const used = lines.join(' ').split(' ').length
  if (used < words.length || lines.length > maxLines) {
    lines.length = Math.min(lines.length, maxLines)
    let last = lines[lines.length - 1]
    while (last.length && ctx.measureText(`${last}…`).width > max) last = last.slice(0, -1).trimEnd()
    lines[lines.length - 1] = `${last}…`
  }
  return lines
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// ---------- Iconos del tiempo (código WMO de Open-Meteo) ----------
function sun(ctx, x, y, r) {
  ctx.save()
  ctx.fillStyle = '#f2b01e'
  ctx.strokeStyle = '#f2b01e'
  ctx.lineWidth = r * 0.22
  ctx.lineCap = 'round'
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3)
    ctx.lineTo(x + Math.cos(a) * r * 1.7, y + Math.sin(a) * r * 1.7)
    ctx.stroke()
  }
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}
function cloud(ctx, x, y, s, color = '#b8c2cc') {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x - s * 0.55, y + s * 0.1, s * 0.45, 0, Math.PI * 2)
  ctx.arc(x, y - s * 0.2, s * 0.6, 0, Math.PI * 2)
  ctx.arc(x + s * 0.6, y + s * 0.1, s * 0.45, 0, Math.PI * 2)
  ctx.fill()
  roundRect(ctx, x - s * 1, y + s * 0.05, s * 2, s * 0.5, s * 0.25)
  ctx.fill()
  ctx.restore()
}
function drops(ctx, x, y, s, n, color = '#2a78d6') {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = s * 0.14
  ctx.lineCap = 'round'
  for (let i = 0; i < n; i++) {
    const dx = x + (i - (n - 1) / 2) * s * 0.55
    ctx.beginPath(); ctx.moveTo(dx, y + s * 0.75); ctx.lineTo(dx - s * 0.15, y + s * 1.15); ctx.stroke()
  }
  ctx.restore()
}
function flakes(ctx, x, y, s) {
  ctx.save()
  ctx.fillStyle = '#7fb3e6'
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + (i - 1) * s * 0.55, y + s * 0.95, s * 0.12, 0, Math.PI * 2); ctx.fill() }
  ctx.restore()
}
function bolt(ctx, x, y, s) {
  ctx.save()
  ctx.fillStyle = '#f2b01e'
  ctx.beginPath()
  ctx.moveTo(x + s * 0.1, y + s * 0.55); ctx.lineTo(x - s * 0.25, y + s * 1.05); ctx.lineTo(x + s * 0.02, y + s * 1.0)
  ctx.lineTo(x - s * 0.12, y + s * 1.4); ctx.lineTo(x + s * 0.3, y + s * 0.85); ctx.lineTo(x + s * 0.05, y + s * 0.88)
  ctx.closePath(); ctx.fill()
  ctx.restore()
}
function fog(ctx, x, y, s) {
  ctx.save()
  ctx.strokeStyle = '#9aa5b1'
  ctx.lineWidth = s * 0.16
  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - s * 0.8 + (i % 2) * s * 0.2, y - s * 0.3 + i * s * 0.4); ctx.lineTo(x + s * 0.8 - (i % 2) * s * 0.2, y - s * 0.3 + i * s * 0.4); ctx.stroke() }
  ctx.restore()
}
function weatherIcon(ctx, code, x, y, s) {
  const c = Number(code)
  if (c === 0) return sun(ctx, x, y, s * 0.55)
  if (c === 1 || c === 2) { sun(ctx, x - s * 0.35, y - s * 0.3, s * 0.42); return cloud(ctx, x + s * 0.15, y + s * 0.1, s * 0.75) }
  if (c === 3) return cloud(ctx, x, y, s * 0.9)
  if (c === 45 || c === 48) return fog(ctx, x, y, s)
  if ([71, 73, 75, 77, 85, 86].includes(c)) { cloud(ctx, x, y - s * 0.2, s * 0.85); return flakes(ctx, x, y - s * 0.2, s) }
  if ([95, 96, 99].includes(c)) { cloud(ctx, x, y - s * 0.2, s * 0.85, '#8d98a5'); return bolt(ctx, x, y - s * 0.2, s) }
  const heavy = [65, 67, 82].includes(c)
  const drizzle = [51, 53, 55, 56, 57].includes(c)
  cloud(ctx, x, y - s * 0.2, s * 0.85, heavy ? '#8d98a5' : '#b8c2cc')
  return drops(ctx, x, y - s * 0.2, s, drizzle ? 2 : 3)
}

// ---------- Cartel ----------
// Arriba, una ilustración de la provincia (generada con IA cada semana, sin texto; si no hay, la de serie de
// backend/assets/cartel) con el título encima. Debajo, una hoja clara con TODAS las citas agrupadas por municipio
// (Salamanca primero, luego los pueblos con más citas) y el tiempo. Para que quepa todo, se prueba de más holgado a
// más compacto (una columna, dos, letra más pequeña, sin el lugar, títulos en una línea) y se queda el primero que
// cabe; solo si ni el más compacto cabe, se corta y se pone "+ N más en la web". Los datos (fechas, títulos,
// pueblos, temperaturas) los escribe siempre este código, nunca la IA.
const DEFAULT_ART = path.resolve(__dirname, '../../../assets/cartel/ilustracion-defecto.png')
const ART_H = 420
const SHEET_TOP = ART_H - 30
const FOOT_H = 60
const WEATHER_H = 124
const COL_GAP = 36
const MODES = [
  { cols: 1, size: 24, lines: 2, lugar: true },
  { cols: 2, size: 21, lines: 2, lugar: true },
  { cols: 2, size: 19, lines: 2, lugar: true },
  { cols: 2, size: 19, lines: 2, lugar: false },
  { cols: 2, size: 17, lines: 2, lugar: false },
  { cols: 2, size: 17, lines: 1, lugar: false },
  { cols: 2, size: 15, lines: 1, lugar: false }
]
const SHORT_MONTH = (iso) => MONTHS[parse(iso).getUTCMonth()].slice(0, 3)
const weekday = (iso) => { const w = WEEK[parse(iso).getUTCDay()]; return `${w.charAt(0)}${w.slice(1).toLowerCase()}` }
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// "Fiesta local de Torresmenudas" debajo de "Torresmenudas" se queda en "Fiesta local"
const stripTown = (title, town) => (town ? title.replace(new RegExp(`\\s+(de|en)\\s+${escapeRe(town)}\\s*$`, 'i'), '') : title)

// [{ name, items }] con las citas de las secciones del cartel; Salamanca, luego los que más tienen
function groupByTown(digest) {
  const towns = new Map()
  for (const s of digest.secciones) {
    if (!SECTION[s.id]) continue
    for (const it of s.items) {
      const name = it.pueblo || 'Varios lugares'
      if (!towns.has(name)) towns.set(name, [])
      const titulo = s.id === 'fiestas' ? stripTown(it.titulo, it.pueblo) || it.titulo : it.titulo
      towns.get(name).push({ ...it, seccion: s.id, titulo })
    }
  }
  // Lo que empieza esta semana, por fecha y hora; lo que ya estaba en marcha (exposiciones, ciclos), al final
  const order = (a, b) => (Number(a.empezado) - Number(b.empezado)) || String(a.fecha).localeCompare(String(b.fecha)) ||
    String(a.hora || '99').localeCompare(String(b.hora || '99'))
  return [...towns].map(([name, items]) => ({ name, items: items.sort(order) }))
    .sort((a, b) => (Number(b.name === 'Salamanca') - Number(a.name === 'Salamanca')) || (b.items.length - a.items.length) ||
      a.name.localeCompare(b.name, 'es'))
}

// Las dos líneas de la fecha de una cita: "Vie 20" / "20:00"; "Hasta" / "18 dic"; "Jue 19" / "al 21 nov"
function dateLines(it) {
  if (it.empezado && it.hasta) return ['Hasta', `${parse(it.hasta).getUTCDate()} ${SHORT_MONTH(it.hasta)}`]
  const second = it.hora || (it.hasta ? `al ${parse(it.hasta).getUTCDate()} ${SHORT_MONTH(it.hasta)}` : '')
  return [`${weekday(it.fecha)} ${parse(it.fecha).getUTCDate()}`, second]
}

// Filas (cabeceras de pueblo y citas) con su alto para un modo
function buildRows(ctx, towns, mode, colW) {
  const s = mode.size
  const lh = Math.round(s * 1.27)
  ctx.font = font(700, Math.round(s * 0.8))
  const dateW = Math.ceil(Math.max(...towns.flatMap(t => t.items.map(it => ctx.measureText(dateLines(it)[0]).width)),
    ctx.measureText('Hasta').width)) + 14
  const textW = colW - 16 - dateW
  const rows = []
  for (const t of towns) {
    const head = { type: 'town', name: t.name, count: t.items.length, h: Math.round(s * 2) }
    rows.push(head)
    for (const it of t.items) {
      ctx.font = font(600, s)
      const lines = wrap(ctx, it.titulo, textW, mode.lines)
      let lugar = null
      if (mode.lugar && it.lugar && it.lugar !== it.pueblo) {
        ctx.font = font(400, Math.round(s * 0.78))
        lugar = wrap(ctx, it.lugar.replace(/\s*\([^)]*\)\s*$/, ''), textW, 1)[0]
      }
      const textH = lines.length * lh + (lugar ? Math.round(lh * 0.82) : 0)
      const dateH = Math.round(s * 1.9)
      rows.push({ type: 'item', it, lines, lugar, town: head, dateW, lh, h: Math.max(textH, dateH) + Math.round(s * 0.55) })
    }
  }
  return rows
}

const sumH = (rows) => rows.reduce((a, r) => a + r.h, 0)

// Reparte las filas en dos columnas lo más igualadas posible; si una columna empieza a mitad de un pueblo,
// repite su cabecera ("sigue"). null si no caben.
function splitColumns(rows, avail) {
  const total = sumH(rows)
  for (let limit = Math.ceil(total / 2); limit <= avail; limit += 6) {
    let h = 0
    let i = 0
    while (i < rows.length && h + rows[i].h <= limit) { h += rows[i].h; i++ }
    if (i > 0 && rows[i - 1].type === 'town') i-- // sin cabeceras huérfanas al pie de la columna
    const a = rows.slice(0, i)
    const b = rows.slice(i)
    if (b.length && b[0].type === 'item') b.unshift({ ...b[0].town, cont: true })
    if (sumH(b) <= avail) return [a, b]
  }
  return null
}

function place(rows, mode, avail) {
  if (mode.cols === 1) return sumH(rows) <= avail ? [rows] : null
  return splitColumns(rows, avail)
}

// Elige el modo más holgado en el que cabe todo; si ninguno, el más compacto quitando citas del final
function planLayout(ctx, towns, avail) {
  const inner = W - PAD * 2
  for (const mode of MODES) {
    const colW = mode.cols === 1 ? inner : (inner - COL_GAP) / 2
    const cols = place(buildRows(ctx, towns, mode, colW), mode, avail)
    if (cols) return { mode, colW, cols, rest: 0 }
  }
  const mode = MODES[MODES.length - 1]
  const colW = (inner - COL_GAP) / 2
  const rows = buildRows(ctx, towns, mode, colW)
  const more = { type: 'more', h: Math.round(mode.size * 1.8) }
  let rest = 0
  while (rows.length) {
    const cols = place([...rows, more], mode, avail)
    if (cols) { more.rest = rest; return { mode, colW, cols, rest } }
    const last = rows.pop()
    if (last.type === 'item') rest++
    // Un pueblo sin citas no deja su cabecera
    while (rows.length && rows[rows.length - 1].type === 'town') rows.pop()
  }
  return { mode, colW, cols: [[more]], rest }
}

function drawPin(ctx, x, y, r, color) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, r, Math.PI, 0)
  ctx.lineTo(x, y + r * 1.9)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function drawRow(ctx, r, x, y, colW, mode) {
  const s = mode.size
  if (r.type === 'town') {
    const base = y + Math.round(s * 1.3)
    drawPin(ctx, x + s * 0.4, base - s * 0.62, s * 0.38, C.brand)
    ctx.fillStyle = C.brand
    ctx.font = font(700, Math.round(s * 1.05))
    const name = r.cont ? `${r.name} (sigue)` : r.name
    ctx.fillText(name, x + s * 1.05, base)
    const nw = ctx.measureText(name).width
    if (!r.cont) {
      ctx.fillStyle = C.muted
      ctx.font = font(500, Math.round(s * 0.72))
      ctx.fillText(`${r.count} ${r.count === 1 ? 'cita' : 'citas'}`, x + s * 1.05 + nw + 10, base - 1)
    }
    ctx.fillStyle = C.line
    ctx.fillRect(x, base + Math.round(s * 0.35), colW, 2)
    return
  }
  if (r.type === 'more') {
    ctx.fillStyle = C.brand
    ctx.font = font(600, Math.round(s * 1.05))
    ctx.fillText(`+ ${r.rest} ${r.rest === 1 ? 'cita más' : 'citas más'} en la web`, x, y + Math.round(s * 1.25))
    return
  }
  const it = r.it
  const st = SECTION[it.seccion]
  const first = y + Math.round(s * 0.98)
  // Marca de color de la sección (la leyenda de arriba dice cuál es cuál)
  ctx.fillStyle = st.color
  roundRect(ctx, x, y + 3, 5, r.h - Math.round(s * 0.55) - 4, 2.5)
  ctx.fill()
  const [d1, d2] = dateLines(it)
  ctx.fillStyle = C.ink
  ctx.font = font(700, Math.round(s * 0.8))
  ctx.fillText(d1, x + 14, first)
  if (d2) {
    ctx.fillStyle = C.muted
    ctx.font = font(500, Math.round(s * 0.74))
    ctx.fillText(d2, x + 14, first + Math.round(s * 0.92))
  }
  const tx = x + 14 + r.dateW
  ctx.fillStyle = C.ink
  ctx.font = font(600, s)
  r.lines.forEach((line, i) => ctx.fillText(line, tx, first + i * r.lh))
  if (r.lugar) {
    ctx.fillStyle = C.muted
    ctx.font = font(400, Math.round(s * 0.78))
    ctx.fillText(r.lugar, tx, first + (r.lines.length - 1) * r.lh + Math.round(r.lh * 0.85))
  }
}

// La imagen cubre el rectángulo (recorta lo que sobra, centrada un poco hacia abajo: el suelo tiene la gracia)
function drawCover(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height)
  const sw = w / s
  const sh = h / s
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) * 0.6, sw, sh, x, y, w, h)
}

async function renderPoster(digest, { illustration = null } = {}) {
  loadFonts()
  const { loadImage } = require('@napi-rs/canvas')
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  ctx.textBaseline = 'alphabetic'

  // Ilustración: la de la semana; si no está o no se puede leer, la de serie; y si tampoco, un degradado verde
  let art = null
  for (const src of [illustration, DEFAULT_ART].filter(Boolean)) {
    try { art = await loadImage(src); break } catch { art = null }
  }
  if (art) drawCover(ctx, art, 0, 0, W, ART_H)
  else { const g = ctx.createLinearGradient(0, 0, W, ART_H); g.addColorStop(0, C.brand); g.addColorStop(1, C.brand2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, ART_H) }
  // Velo oscuro abajo para que el título se lea sobre cualquier ilustración
  const veil = ctx.createLinearGradient(0, ART_H * 0.3, 0, ART_H)
  veil.addColorStop(0, 'rgba(14,32,22,0)')
  veil.addColorStop(1, 'rgba(14,32,22,0.88)')
  ctx.fillStyle = veil
  ctx.fillRect(0, 0, W, ART_H)

  // Marca en una pastilla
  ctx.font = font(500, 24)
  const infoW = ctx.measureText('info').width
  ctx.font = font(700, 24)
  const brandW = infoW + ctx.measureText('Salamanca').width
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  roundRect(ctx, PAD - 6, 30, brandW + 40, 46, 23)
  ctx.fill()
  ctx.fillStyle = C.brand
  ctx.font = font(500, 24)
  ctx.fillText('info', PAD + 14, 62)
  ctx.font = font(700, 24)
  ctx.fillText('Salamanca', PAD + 14 + infoW, 62)

  // Título y semana
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 12
  ctx.fillStyle = '#fff'
  ctx.font = font(800, 56)
  ctx.fillText('Esta semana', PAD, ART_H - 116)
  ctx.fillText('en la provincia', PAD, ART_H - 60)
  ctx.restore()
  ctx.font = font(600, 26)
  const when = range(digest.desde, digest.hasta)
  const whenW = ctx.measureText(when).width
  ctx.fillStyle = '#f2b01e'
  roundRect(ctx, W - PAD - whenW - 36, ART_H - 110, whenW + 36, 48, 24)
  ctx.fill()
  ctx.fillStyle = '#1d2228'
  ctx.fillText(when, W - PAD - whenW - 18, ART_H - 77)

  // Hoja clara que monta sobre la ilustración
  ctx.fillStyle = C.bg
  roundRect(ctx, 0, SHEET_TOP, W, H - SHEET_TOP + 40, 30)
  ctx.fill()

  const weatherH = digest.tiempo?.dias?.length ? WEATHER_H : 0
  const towns = groupByTown(digest)

  // Leyenda: color de cada sección y cuántas citas tiene
  let y = SHEET_TOP + 30
  const counts = Object.keys(SECTION).map(id => ({ id, n: towns.reduce((a, t) => a + t.items.filter(i => i.seccion === id).length, 0) })).filter(x => x.n)
  let lx = PAD
  for (const { id, n } of counts) {
    const st = SECTION[id]
    ctx.fillStyle = st.color
    roundRect(ctx, lx, y + 4, 5, 22, 2.5)
    ctx.fill()
    ctx.fillStyle = C.ink
    ctx.font = font(600, 20)
    const label = id === 'fiestas' ? 'Fiestas' : st.label
    ctx.fillText(label, lx + 14, y + 22)
    const w1 = ctx.measureText(label).width
    ctx.fillStyle = C.muted
    ctx.font = font(500, 18)
    ctx.fillText(String(n), lx + 14 + w1 + 8, y + 22)
    lx += 14 + w1 + 8 + ctx.measureText(String(n)).width + 34
  }
  y += counts.length ? 44 : 0

  const top = y
  const bottom = H - FOOT_H - weatherH - 10
  if (!towns.length) {
    ctx.fillStyle = C.muted
    ctx.font = font(500, 28)
    ctx.fillText('Esta semana no hay actividades anunciadas.', PAD, top + 50)
  } else {
    const plan = planLayout(ctx, towns, bottom - top)
    plan.cols.forEach((col, ci) => {
      const x = PAD + ci * (plan.colW + COL_GAP)
      let cy = top
      for (const r of col) { drawRow(ctx, r, x, cy, plan.colW, plan.mode); cy += r.h }
    })
  }

  // El tiempo: una tarjeta por día
  if (weatherH) {
    const days = digest.tiempo.dias.slice(0, 7)
    const wy = H - FOOT_H - weatherH
    ctx.fillStyle = C.ink
    ctx.font = font(700, 19)
    ctx.fillText(`El tiempo en ${digest.tiempo.lugar}`, PAD, wy + 6)
    const gap = 10
    const cw = (W - PAD * 2 - gap * (days.length - 1)) / days.length
    days.forEach((d, i) => {
      const x = PAD + i * (cw + gap)
      const cy = wy + 16
      const ch = weatherH - 30
      ctx.fillStyle = '#fff'
      roundRect(ctx, x, cy, cw, ch, 12)
      ctx.fill()
      ctx.strokeStyle = C.line
      ctx.lineWidth = 2
      ctx.stroke()
      const cx = x + cw / 2
      ctx.textAlign = 'center'
      ctx.fillStyle = C.muted
      ctx.font = font(600, 15)
      ctx.fillText(`${weekday(d.fecha)} ${parse(d.fecha).getUTCDate()}`, cx, cy + 21)
      weatherIcon(ctx, d.codigo, cx, cy + 42, 15)
      ctx.fillStyle = C.ink
      ctx.font = font(700, 19)
      ctx.fillText(`${Math.round(d.max)}°`, cx - 17, cy + ch - 10)
      ctx.fillStyle = C.muted
      ctx.font = font(500, 16)
      ctx.fillText(`${Math.round(d.min)}°`, cx + 19, cy + ch - 10)
      ctx.textAlign = 'left'
    })
  }

  // Pie
  ctx.fillStyle = C.brand
  ctx.fillRect(0, H - FOOT_H, W, FOOT_H)
  ctx.fillStyle = '#fff'
  ctx.font = font(600, 22)
  ctx.fillText(String(digest.url || '').replace(/^https?:\/\//, ''), PAD, H - FOOT_H / 2 + 8)
  ctx.textAlign = 'right'
  ctx.font = font(500, 19)
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.fillText('Mapa, agenda y el tiempo de cada pueblo', W - PAD, H - FOOT_H / 2 + 7)
  ctx.textAlign = 'left'

  return canvas.encode('png')
}

module.exports = { renderPoster, W, H, DEFAULT_ART, _test: { wrap, range, groupByTown, dateLines, stripTown } }
