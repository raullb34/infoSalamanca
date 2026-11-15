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
// backend/assets/cartel) con el título encima. Debajo, una hoja clara con las citas y el tiempo. Los datos
// (fechas, títulos, pueblos, temperaturas) los escribe siempre este código, nunca la IA.
const DEFAULT_ART = path.resolve(__dirname, '../../../assets/cartel/ilustracion-defecto.png')
const ART_H = 540
const SHEET_TOP = ART_H - 34
const ITEM_GAP = 10
const TITLE_SIZE = 24
const META_SIZE = 18
const BADGE = 60

function itemLayout(ctx, it, textW) {
  ctx.font = font(600, TITLE_SIZE)
  const lines = wrap(ctx, it.titulo, textW, 2)
  const meta = [it.pueblo, it.hora && !it.empezado ? it.hora : null].filter(Boolean).join(' · ')
  return { it, lines, meta, h: Math.max(BADGE, lines.length * 30 + (meta ? 24 : 0)) }
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

  // Ilustración
  let art = null
  // La de la semana; si no está o no se puede leer, la de serie; y si tampoco, un degradado verde
  for (const src of [illustration, DEFAULT_ART].filter(Boolean)) {
    try { art = await loadImage(src); break } catch { art = null }
  }
  if (art) drawCover(ctx, art, 0, 0, W, ART_H)
  else { const g = ctx.createLinearGradient(0, 0, W, ART_H); g.addColorStop(0, C.brand); g.addColorStop(1, C.brand2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, ART_H) }
  // Velo oscuro abajo para que el título se lea sobre cualquier ilustración
  const veil = ctx.createLinearGradient(0, ART_H * 0.42, 0, ART_H)
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
  roundRect(ctx, PAD - 6, 34, brandW + 40, 46, 23)
  ctx.fill()
  ctx.fillStyle = C.brand
  ctx.font = font(500, 24)
  ctx.fillText('info', PAD + 14, 66)
  ctx.font = font(700, 24)
  ctx.fillText('Salamanca', PAD + 14 + infoW, 66)

  // Título y semana
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 12
  ctx.fillStyle = '#fff'
  ctx.font = font(800, 60)
  ctx.fillText('Esta semana', PAD, ART_H - 128)
  ctx.font = font(800, 60)
  ctx.fillText('en la provincia', PAD, ART_H - 68)
  ctx.restore()
  ctx.font = font(600, 26)
  const when = range(digest.desde, digest.hasta)
  const whenW = ctx.measureText(when).width
  ctx.fillStyle = '#f2b01e'
  roundRect(ctx, W - PAD - whenW - 36, ART_H - 120, whenW + 36, 48, 24)
  ctx.fill()
  ctx.fillStyle = '#1d2228'
  ctx.fillText(when, W - PAD - whenW - 18, ART_H - 87)

  // Hoja clara que monta sobre la ilustración
  ctx.fillStyle = C.bg
  roundRect(ctx, 0, SHEET_TOP, W, H - SHEET_TOP + 40, 34)
  ctx.fill()

  const weatherH = digest.tiempo?.dias?.length ? 150 : 0
  const footH = 66
  const top = SHEET_TOP + 34
  const bottom = H - footH - weatherH - (weatherH ? 16 : 0)
  const textW = W - PAD * 2 - BADGE - 18

  // Qué cabe: por rondas, un elemento de cada sección por vuelta; lo que tiene fecha esta semana, antes
  const sections = digest.secciones
    .filter(s => SECTION[s.id] && s.items.length)
    .map(s => {
      const items = s.items.filter(i => !i.empezado).concat(s.items.filter(i => i.empezado))
      return { ...s, layouts: items.map(it => itemLayout(ctx, it, textW)), shown: [] }
    })
  const HEADER_H = 46
  const MORE_H = 26
  const used = () => sections.reduce((a, s) => a + (s.shown.length ? HEADER_H + s.shown.reduce((b, l) => b + l.h + ITEM_GAP, 0) + (s.shown.length < s.layouts.length ? MORE_H : 0) + 12 : 0), 0)
  let added = true
  while (added) {
    added = false
    for (const s of sections) {
      const next = s.layouts[s.shown.length]
      if (!next) continue
      s.shown.push(next)
      if (top + used() > bottom) { s.shown.pop(); continue }
      added = true
    }
  }

  let y = top
  if (!sections.some(s => s.shown.length)) {
    ctx.fillStyle = C.muted
    ctx.font = font(500, 28)
    ctx.fillText('Esta semana no hay actividades anunciadas.', PAD, y + 50)
  }
  for (const s of sections) {
    if (!s.shown.length) continue
    const st = SECTION[s.id]
    // Cabecera: punto de color, nombre y número de citas
    ctx.fillStyle = st.color
    ctx.beginPath(); ctx.arc(PAD + 9, y + 16, 9, 0, Math.PI * 2); ctx.fill()
    ctx.font = font(700, 26)
    ctx.fillText(st.label, PAD + 28, y + 26)
    const lw = ctx.measureText(st.label).width
    ctx.fillStyle = C.muted
    ctx.font = font(500, 20)
    ctx.fillText(`${s.layouts.length} ${s.layouts.length === 1 ? 'cita' : 'citas'}`, PAD + 40 + lw, y + 25)
    y += HEADER_H

    for (const l of s.shown) {
      const it = l.it
      const [d1, d2] = it.empezado && it.hasta
        ? ['HASTA', `${parse(it.hasta).getUTCDate()} ${MONTHS[parse(it.hasta).getUTCMonth()].slice(0, 3).toUpperCase()}`]
        : [WEEK[parse(it.fecha).getUTCDay()], String(parse(it.fecha).getUTCDate())]
      // Fecha: tarjeta blanca con el día en el color de la sección
      ctx.fillStyle = '#fff'
      roundRect(ctx, PAD, y, BADGE, BADGE, 14)
      ctx.fill()
      ctx.strokeStyle = C.line
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.textAlign = 'center'
      ctx.fillStyle = st.color
      ctx.font = font(700, 14)
      ctx.fillText(d1, PAD + BADGE / 2, y + 21)
      ctx.font = font(800, d2.length > 3 ? 17 : 26)
      ctx.fillText(d2, PAD + BADGE / 2, y + (d2.length > 3 ? 46 : 50))
      ctx.textAlign = 'left'
      const tx = PAD + BADGE + 18
      ctx.fillStyle = C.ink
      ctx.font = font(600, TITLE_SIZE)
      l.lines.forEach((line, i) => ctx.fillText(line, tx, y + 24 + i * 30))
      if (l.meta) {
        ctx.fillStyle = C.muted
        ctx.font = font(400, META_SIZE)
        ctx.fillText(wrap(ctx, l.meta, textW, 1)[0], tx, y + 24 + l.lines.length * 30 - 4)
      }
      y += l.h + ITEM_GAP
    }
    const rest = s.layouts.length - s.shown.length
    if (rest > 0) {
      ctx.fillStyle = st.color
      ctx.font = font(600, 19)
      ctx.fillText(`+ ${rest} más en la web`, PAD + BADGE + 18, y + 14)
      y += MORE_H
    }
    y += 12
  }

  // El tiempo: una tarjeta por día
  if (weatherH) {
    const days = digest.tiempo.dias.slice(0, 7)
    const wy = H - footH - weatherH - 8
    ctx.fillStyle = C.ink
    ctx.font = font(700, 20)
    ctx.fillText(`El tiempo en ${digest.tiempo.lugar}`, PAD, wy + 4)
    const gap = 10
    const cw = (W - PAD * 2 - gap * (days.length - 1)) / days.length
    days.forEach((d, i) => {
      const x = PAD + i * (cw + gap)
      const cy = wy + 16
      ctx.fillStyle = '#fff'
      roundRect(ctx, x, cy, cw, weatherH - 26, 14)
      ctx.fill()
      ctx.strokeStyle = C.line
      ctx.lineWidth = 2
      ctx.stroke()
      const cx = x + cw / 2
      ctx.textAlign = 'center'
      ctx.fillStyle = C.muted
      ctx.font = font(600, 16)
      const wd = WEEK[parse(d.fecha).getUTCDay()]
      ctx.fillText(`${wd.charAt(0)}${wd.slice(1).toLowerCase()} ${parse(d.fecha).getUTCDate()}`, cx, cy + 24)
      weatherIcon(ctx, d.codigo, cx, cy + 50, 19)
      ctx.fillStyle = C.ink
      ctx.font = font(700, 21)
      ctx.fillText(`${Math.round(d.max)}°`, cx - 18, cy + 104)
      ctx.fillStyle = C.muted
      ctx.font = font(500, 17)
      ctx.fillText(`${Math.round(d.min)}°`, cx + 20, cy + 104)
      ctx.textAlign = 'left'
    })
  }

  // Pie
  ctx.fillStyle = C.brand
  ctx.fillRect(0, H - footH, W, footH)
  ctx.fillStyle = '#fff'
  ctx.font = font(600, 23)
  ctx.fillText(String(digest.url || '').replace(/^https?:\/\//, ''), PAD, H - footH / 2 + 8)
  ctx.textAlign = 'right'
  ctx.font = font(500, 20)
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.fillText('Mapa, agenda y el tiempo de cada pueblo', W - PAD, H - footH / 2 + 7)
  ctx.textAlign = 'left'

  return canvas.encode('png')
}

module.exports = { renderPoster, W, H, DEFAULT_ART, _test: { wrap, range } }
