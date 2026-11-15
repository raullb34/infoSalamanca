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
const ITEM_GAP = 10
const TITLE_SIZE = 25
const META_SIZE = 19
const BADGE_W = 84
const BADGE_H = 62

function itemLayout(ctx, it, textW) {
  ctx.font = font(600, TITLE_SIZE)
  const lines = wrap(ctx, it.titulo, textW, 2)
  const meta = [it.pueblo, it.hora && !it.empezado ? it.hora : null].filter(Boolean).join(' · ')
  return { it, lines, meta, h: Math.max(BADGE_H, lines.length * 32 + (meta ? 26 : 0)) }
}

async function renderPoster(digest) {
  loadFonts()
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  ctx.textBaseline = 'alphabetic'

  // Fondo y cabecera
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, H)
  const headH = 220
  const grad = ctx.createLinearGradient(0, 0, W, headH)
  grad.addColorStop(0, C.brand)
  grad.addColorStop(1, C.brand2)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, headH)
  // Círculos suaves de adorno
  ctx.fillStyle = 'rgba(255,255,255,0.07)'
  ctx.beginPath(); ctx.arc(W - 90, 40, 170, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(W - 250, headH + 20, 110, 0, Math.PI * 2); ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = font(500, 28)
  ctx.fillText('info', PAD, 70)
  const infoW = ctx.measureText('info').width
  ctx.fillStyle = C.brandInk
  ctx.font = font(700, 28)
  ctx.fillText('Salamanca', PAD + infoW, 70)
  ctx.font = font(800, 62)
  ctx.fillText('La agenda de la semana', PAD, 144)
  ctx.font = font(500, 31)
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fillText(range(digest.desde, digest.hasta), PAD, 190)

  // Zona de contenido: entre la cabecera y el tiempo
  const weatherH = digest.tiempo?.dias?.length ? 196 : 0
  const footH = 74
  const top = headH + 28
  const bottom = H - footH - weatherH - (weatherH ? 26 : 0)
  const textW = W - PAD * 2 - BADGE_W - 22

  // Qué cabe: se reparte por rondas entre las secciones (un elemento de cada una por vuelta)
  const sections = digest.secciones
    .filter(s => SECTION[s.id] && s.items.length)
    .map(s => {
      const items = s.items.filter(i => !i.empezado).concat(s.items.filter(i => i.empezado))
      return { ...s, layouts: items.map(it => itemLayout(ctx, it, textW)), shown: [] }
    })
  const HEADER_H = 54
  const MORE_H = 30
  const used = () => sections.reduce((a, s) => a + (s.shown.length ? HEADER_H + s.shown.reduce((b, l) => b + l.h + ITEM_GAP, 0) + (s.shown.length < s.layouts.length ? MORE_H : 0) + 18 : 0), 0)
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
    ctx.font = font(500, 30)
    ctx.fillText('Esta semana no hay actividades anunciadas.', PAD, y + 60)
  }
  for (const s of sections) {
    if (!s.shown.length) continue
    const st = SECTION[s.id]
    // Cabecera de la sección: pastilla de color con el nombre y el número
    ctx.font = font(700, 26)
    const label = `${st.label}`
    const lw = ctx.measureText(label).width
    ctx.fillStyle = st.color
    roundRect(ctx, PAD, y, lw + 36, 44, 22)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillText(label, PAD + 18, y + 31)
    ctx.fillStyle = C.muted
    ctx.font = font(500, 22)
    ctx.fillText(`${s.layouts.length} ${s.layouts.length === 1 ? 'cita' : 'citas'}`, PAD + lw + 52, y + 30)
    y += HEADER_H

    for (const l of s.shown) {
      const it = l.it
      // Fecha: "MIÉ / 18" o "HASTA / 29 NOV"
      const [d1, d2] = it.empezado && it.hasta
        ? ['HASTA', `${parse(it.hasta).getUTCDate()} ${MONTHS[parse(it.hasta).getUTCMonth()].slice(0, 3).toUpperCase()}`]
        : [WEEK[parse(it.fecha).getUTCDay()], String(parse(it.fecha).getUTCDate())]
      ctx.fillStyle = st.color
      roundRect(ctx, PAD, y, BADGE_W, BADGE_H, 13)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.font = font(600, 16)
      ctx.fillText(d1, PAD + BADGE_W / 2, y + 23)
      ctx.font = font(800, d2.length > 3 ? 19 : 27)
      ctx.fillText(d2, PAD + BADGE_W / 2, y + (d2.length > 3 ? 48 : 52))
      ctx.textAlign = 'left'
      // Título y lugar
      const tx = PAD + BADGE_W + 22
      ctx.fillStyle = C.ink
      ctx.font = font(600, TITLE_SIZE)
      l.lines.forEach((line, i) => ctx.fillText(line, tx, y + 25 + i * 32))
      if (l.meta) {
        ctx.fillStyle = C.muted
        ctx.font = font(400, META_SIZE)
        ctx.fillText(wrap(ctx, l.meta, textW, 1)[0], tx, y + 25 + l.lines.length * 32 - 6)
      }
      y += l.h + ITEM_GAP
    }
    const rest = s.layouts.length - s.shown.length
    if (rest > 0) {
      ctx.fillStyle = st.color
      ctx.font = font(600, 21)
      ctx.fillText(`+ ${rest} más en la web`, PAD + BADGE_W + 22, y + 18)
      y += MORE_H
    }
    y += 14
  }

  // El tiempo de la semana
  if (weatherH) {
    const wy = H - footH - weatherH
    ctx.fillStyle = C.card
    roundRect(ctx, PAD - 12, wy, W - (PAD - 12) * 2, weatherH - 10, 22)
    ctx.fill()
    ctx.strokeStyle = C.line
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = C.ink
    ctx.font = font(700, 24)
    ctx.fillText(`El tiempo en ${digest.tiempo.lugar}`, PAD + 8, wy + 38)
    const days = digest.tiempo.dias.slice(0, 7)
    const colW = (W - PAD * 2) / days.length
    days.forEach((d, i) => {
      const cx = PAD + colW * i + colW / 2
      ctx.textAlign = 'center'
      ctx.fillStyle = C.muted
      ctx.font = font(600, 19)
      ctx.fillText(`${WEEK[parse(d.fecha).getUTCDay()].charAt(0)}${WEEK[parse(d.fecha).getUTCDay()].slice(1).toLowerCase()} ${parse(d.fecha).getUTCDate()}`, cx, wy + 74)
      weatherIcon(ctx, d.codigo, cx, wy + 104, 25)
      ctx.fillStyle = C.ink
      ctx.font = font(700, 25)
      ctx.fillText(`${Math.round(d.max)}°`, cx, wy + 156)
      ctx.fillStyle = C.muted
      ctx.font = font(500, 19)
      ctx.fillText(`${Math.round(d.min)}°`, cx, wy + 178)
      ctx.textAlign = 'left'
    })
  }

  // Pie
  ctx.fillStyle = C.brand
  ctx.fillRect(0, H - footH, W, footH)
  ctx.fillStyle = '#fff'
  ctx.font = font(600, 24)
  const host = String(digest.url || '').replace(/^https?:\/\//, '')
  ctx.fillText(host, PAD, H - footH / 2 + 9)
  ctx.textAlign = 'right'
  ctx.font = font(500, 21)
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.fillText('Mapa, agenda y el tiempo de cada pueblo', W - PAD, H - footH / 2 + 8)
  ctx.textAlign = 'left'

  return canvas.encode('png')
}

module.exports = { renderPoster, W, H, _test: { wrap, range } }
