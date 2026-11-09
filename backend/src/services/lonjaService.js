// Cotizaciones semanales de la Lonja Agropecuaria de Salamanca (cada lunes, desde 2005).
// Fuente: Diputación de Salamanca, portal de datos abiertos (CKAN), conjunto
// "cotizaciones-semanales-de-la-lonja-de-salamanca" (CSV, CC BY 4.0). Se descarga al primer uso y se
// renueva cada 12 horas; si falla la descarga se siguen sirviendo los últimos datos.
//
// Cada fila trae VALOR1 y VALOR2 (mínimo y máximo de la horquilla; VALOR2 = 0 si es un solo precio).
// Un 0 en VALOR1 es que esa semana no cotizó. El CSV no trae unidades: se deducen por mesa y producto.
const axios = require('axios')

const PACKAGE_URL = 'https://datosabiertossalamanca.es/api/3/action/package_show?id=cotizaciones-semanales-de-la-lonja-de-salamanca'
const FALLBACK_CSV = 'https://datosabiertossalamanca.es/dataset/c914b1a6-4673-4288-8613-d077f6d5b619/resource/042beb52-4d80-4380-b073-e170364f65e7/download/agr03.csv'
const SOURCE = {
  name: 'Lonja Agropecuaria de Salamanca (Diputación de Salamanca)',
  url: 'https://datosabiertossalamanca.es/dataset/cotizaciones-semanales-de-la-lonja-de-salamanca',
  license: 'CC BY 4.0'
}
const REFRESH_MS = 12 * 60 * 60 * 1000
const UA = 'infoSalamanca/1.0 (+https://infosalamanca.duckdns.org)'

let state = null // { loadedAt, updated, series: Map(id → serie) }
let loading = null

const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const slug = (s) => plain(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const num = (v) => {
  const n = Number(String(v || '').trim().replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const titleCase = (s) => String(s).toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()).replace(/ E /g, ' e ').replace(/ De /g, ' de ')

// Unidad por mesa y producto (deducida de los valores: cereales ~230 €/t, carne ~1-17 €/kg, animales por cabeza)
function unitOf(mesa, producto, categoria) {
  const m = plain(mesa), p = plain(producto), c = plain(categoria)
  if (m.startsWith('cereales') || m.startsWith('patata')) return '€/t'
  if (m.startsWith('ovino')) return p === 'oveja' && c === 'vida' ? '€/cabeza' : '€/kg'
  if (m.startsWith('porcino')) {
    if (/lechon|toston/.test(p) && !/lechones hasta|lechon iberico/.test(c)) return '€/cabeza'
    if (/toston|reproductora/.test(c)) return '€/cabeza'
    return '€/kg'
  }
  return '€/kg' // bovino de vida y de carne, despiece de ibérico
}

async function csvUrl() {
  try {
    const { data } = await axios.get(PACKAGE_URL, { timeout: 20000, headers: { 'User-Agent': UA } })
    const csv = (data?.result?.resources || []).find(r => /csv/i.test(r.format))
    return { url: csv?.url || FALLBACK_CSV, updated: csv?.last_modified || data?.result?.metadata_modified || null }
  } catch {
    return { url: FALLBACK_CSV, updated: null }
  }
}

async function load() {
  const { url, updated } = await csvUrl()
  const { data } = await axios.get(url, { timeout: 60000, responseType: 'arraybuffer', headers: { 'User-Agent': UA } })
  const text = new TextDecoder('latin1').decode(data) // el CSV va en ISO-8859-1
  const series = new Map()
  const lines = text.split(/\r?\n/)
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(';').map(c => c.replace(/^"|"$/g, '').trim())
    if (cells.length < 7) continue
    const [, date, mesa, producto, categoria, v1, v2] = cells
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const lo = num(v1), hi = num(v2)
    if (!lo) continue // no cotizó esa semana
    const id = slug(`${mesa} ${producto} ${categoria}`)
    if (!series.has(id)) {
      series.set(id, {
        id, mesa: titleCase(mesa), producto: producto.trim(), categoria: categoria.replace(/\s+/g, ' ').trim(),
        unit: unitOf(mesa, producto, categoria), points: []
      })
    }
    // Precio de la semana: el centro de la horquilla (o el único precio)
    series.get(id).points.push({ d: date, p: hi > 0 ? Math.round(((lo + hi) / 2) * 1000) / 1000 : lo, lo, hi: hi > 0 ? hi : lo })
  }
  for (const s of series.values()) s.points.sort((a, b) => a.d.localeCompare(b.d))
  state = { loadedAt: Date.now(), updated, series }
  console.log(`📈 Lonja: ${series.size} productos, ${[...series.values()].reduce((n, s) => n + s.points.length, 0)} cotizaciones`)
  return state
}

async function ready() {
  if (state && Date.now() - state.loadedAt < REFRESH_MS) return state
  if (!loading) {
    loading = load().catch(err => {
      console.warn('⚠️ Lonja: no se pudo actualizar:', err.message)
      if (!state) throw err
      state.loadedAt = Date.now() - REFRESH_MS + 30 * 60 * 1000 // reintentar en media hora
      return state
    }).finally(() => { loading = null })
  }
  if (!state) return loading
  return state // mientras se renueva, los datos anteriores
}

const weeksBetween = (a, b) => (new Date(b) - new Date(a)) / (7 * 86400000)
const pct = (a, b) => (a ? Math.round(((b - a) / a) * 1000) / 10 : null)

// Precio de hace ~n semanas (la cotización más cercana a esa fecha)
function valueWeeksAgo(points, n) {
  const last = points[points.length - 1]
  const target = new Date(last.d).getTime() - n * 7 * 86400000
  let best = null
  for (const p of points) {
    const diff = Math.abs(new Date(p.d).getTime() - target)
    if (diff < 21 * 86400000 && (!best || diff < best.diff)) best = { ...p, diff }
  }
  return best
}

function summary(s) {
  const pts = s.points
  const last = pts[pts.length - 1]
  const prev = pts[pts.length - 2]
  const year = valueWeeksAgo(pts, 52)
  return {
    id: s.id, mesa: s.mesa, producto: s.producto, categoria: s.categoria, unit: s.unit,
    first: pts[0].d, last: last.d, lastPrice: last.p, n: pts.length,
    weekChange: prev ? pct(prev.p, last.p) : null,
    yearChange: year ? pct(year.p, last.p) : null,
    active: weeksBetween(last.d, new Date().toISOString().slice(0, 10)) <= 8
  }
}

// ---------- Análisis: tendencia, estacionalidad y previsión sencillas ----------

// Tendencia de las últimas 26 cotizaciones: pendiente por mínimos cuadrados, en % al mes sobre la media
function trend(points) {
  const recent = points.slice(-26)
  if (recent.length < 8) return null
  const t0 = new Date(recent[0].d).getTime()
  const xs = recent.map(p => (new Date(p.d).getTime() - t0) / (30.44 * 86400000)) // meses
  const ys = recent.map(p => p.p)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  let sxy = 0, sxx = 0
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2 }
  const slope = sxx ? sxy / sxx : 0
  const perMonth = my ? Math.round((slope / my) * 1000) / 10 : 0
  return { perMonth, direction: Math.abs(perMonth) < 0.5 ? 'estable' : perMonth > 0 ? 'sube' : 'baja', weeks: recent.length }
}

// Estacionalidad: cómo varió el precio en las 8 semanas siguientes a esta misma fecha en años anteriores
function seasonality(points) {
  const last = new Date(points[points.length - 1].d)
  const changes = []
  for (let y = 1; y <= 8; y++) {
    const from = new Date(last); from.setFullYear(last.getFullYear() - y)
    const to = new Date(from.getTime() + 8 * 7 * 86400000)
    const near = (date) => {
      let best = null
      for (const p of points) {
        const diff = Math.abs(new Date(p.d) - date)
        if (diff < 14 * 86400000 && (!best || diff < best.diff)) best = { p: p.p, diff }
      }
      return best
    }
    const a = near(from), b = near(to)
    if (a && b) changes.push(pct(a.p, b.p))
  }
  if (changes.length < 3) return null
  changes.sort((a, b) => a - b)
  const median = changes[Math.floor(changes.length / 2)]
  const ups = changes.filter(c => c > 0.5).length
  const downs = changes.filter(c => c < -0.5).length
  return { years: changes.length, medianChange: median, ups, downs }
}

// Previsión a 8 semanas: suavizado exponencial de Holt (nivel + tendencia amortiguada) sobre las
// últimas 2 años de cotizaciones, con una banda del 80 % a partir de los errores de un paso
function forecast(points, horizon = 8) {
  const data = points.slice(-104)
  if (data.length < 12) return null
  const alpha = 0.5, beta = 0.1, phi = 0.9
  let level = data[0].p
  let tr = data[1].p - data[0].p
  const errors = []
  for (let i = 1; i < data.length; i++) {
    const predicted = level + phi * tr
    errors.push(data[i].p - predicted)
    const prevLevel = level
    level = alpha * data[i].p + (1 - alpha) * (level + phi * tr)
    tr = beta * (level - prevLevel) + (1 - beta) * phi * tr
  }
  const recentErr = errors.slice(-52)
  const sigma = Math.sqrt(recentErr.reduce((a, e) => a + e * e, 0) / recentErr.length)
  const lastDate = new Date(data[data.length - 1].d)
  const out = []
  let damp = 0
  for (let h = 1; h <= horizon; h++) {
    damp += Math.pow(phi, h)
    const p = Math.max(0, level + damp * tr)
    const band = 1.28 * sigma * Math.sqrt(h)
    const d = new Date(lastDate.getTime() + h * 7 * 86400000).toISOString().slice(0, 10)
    const round = (v) => Math.round(v * 1000) / 1000
    out.push({ d, p: round(p), lo: round(Math.max(0, p - band)), hi: round(p + band) })
  }
  return { model: 'Holt (tendencia amortiguada)', points: out }
}

async function products() {
  const { series, updated } = await ready()
  const list = [...series.values()].map(summary)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.mesa.localeCompare(b.mesa, 'es') || a.producto.localeCompare(b.producto, 'es') || a.categoria.localeCompare(b.categoria, 'es'))
  return { updated, source: SOURCE, products: list }
}

async function seriesFor(ids) {
  const { series } = await ready()
  return ids.map(id => series.get(id)).filter(Boolean).map(s => ({
    ...summary(s),
    points: s.points.map(p => [p.d, p.p, p.lo, p.hi]),
    trend: trend(s.points),
    seasonality: seasonality(s.points),
    forecast: summary(s).active ? forecast(s.points) : null
  }))
}

module.exports = { products, seriesFor, SOURCE }
