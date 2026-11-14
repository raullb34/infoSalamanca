// El tiempo en Salamanca: llamadas a /api/v1/weather y utilidades de presentación.
// Fechas: la API da UTC; aquí se muestran en Europe/Madrid. Viento: la API da m/s; al ciudadano, km/h.
import axios from 'axios'

// Mismo criterio que services/apiService.js: relativa en producción (nginx), backend local en desarrollo
const base = import.meta.env.PROD
  ? '/api'
  : `http://${import.meta.env.VITE_BACKEND_HOST || 'localhost'}:${import.meta.env.VITE_BACKEND_PORT || '4000'}/api`
const api = axios.create({ baseURL: `${base}/v1/weather`, timeout: 30000 })
const get = (path, params) => api.get(path, { params }).then(r => r.data)

export const weatherApi = {
  stations: () => get('/stations', { latest: true, limit: 200 }),
  station: (id) => get(`/stations/${encodeURIComponent(id)}`),
  latest: (id) => get(`/stations/${encodeURIComponent(id)}/latest`),
  history: (id, variable, period) => get(`/stations/${encodeURIComponent(id)}/history`, { variable, period }),
  municipalities: () => get('/municipalities'),
  municipality: (id) => get(`/municipalities/${encodeURIComponent(id)}`),
  current: (id) => get(`/municipalities/${encodeURIComponent(id)}/current`),
  forecast: (id, hours = 168) => get(`/municipalities/${encodeURIComponent(id)}/forecast`, { hours }),
  compare: (municipality, time) => get('/models/compare', { municipality, time }),
  sources: () => get('/sources')
}

// ---------- Redes ----------
export const NETWORKS = {
  aemet: { label: 'AEMET', kind: 'Oficial', shape: 'circle' },
  inforiego: { label: 'InfoRiego', kind: 'Agroclimática', shape: 'square' },
  meteoclimatic: { label: 'Meteoclimatic', kind: 'Colaborativa', shape: 'diamond' }
}

// ---------- Modelos (paleta categórica validada del proyecto: azul, naranja, aguamarina) ----------
export const MODEL_COLORS = {
  ecmwf_ifs025: { light: '#2a78d6', dark: '#3987e5' },
  icon_eu: { light: '#eb6834', dark: '#d95926' },
  gfs_global: { light: '#1baf7a', dark: '#199e70' }
}
export const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark'
export const modelColor = (model) => (MODEL_COLORS[model] || { light: '#6b6b6b', dark: '#9a9a9a' })[isDark() ? 'dark' : 'light']

// ---------- Temperatura: escala divergente azul ↔ rojo con gris neutro, tramos fijos ----------
// (un color significa siempre la misma temperatura, aunque cambien las estaciones visibles)
export const TEMP_BINS = [
  { max: 0, color: '#104281', ink: '#fff', label: '< 0 °C' },
  { max: 5, color: '#256abf', ink: '#fff', label: '0–5' },
  { max: 10, color: '#86b6ef', ink: '#0b0b0b', label: '5–10' },
  { max: 15, color: '#e6e5e1', ink: '#0b0b0b', label: '10–15' },
  { max: 20, color: '#f2a19f', ink: '#0b0b0b', label: '15–20' },
  { max: 25, color: '#e34948', ink: '#fff', label: '20–25' },
  { max: 30, color: '#b8302f', ink: '#fff', label: '25–30' },
  { max: Infinity, color: '#7e1d1d', ink: '#fff', label: '≥ 30' }
]
export const tempBin = (t) => (t === null || t === undefined ? null : TEMP_BINS.find(b => t < b.max))

// ---------- Tiempo (código WMO de los modelos) ----------
const WMO = [
  [[0], '☀️', 'Despejado'], [[1], '🌤️', 'Poco nuboso'], [[2], '⛅', 'Intervalos nubosos'], [[3], '☁️', 'Cubierto'],
  [[45, 48], '🌫️', 'Niebla'], [[51, 53, 55, 56, 57], '🌦️', 'Llovizna'], [[61, 63, 66, 80, 81], '🌧️', 'Lluvia'],
  [[65, 67, 82], '🌧️', 'Lluvia fuerte'], [[71, 73, 75, 77, 85, 86], '🌨️', 'Nieve'], [[95, 96, 99], '⛈️', 'Tormenta']
]
export function skyOf(code) {
  const hit = WMO.find(([codes]) => codes.includes(Number(code)))
  return hit ? { icon: hit[1], label: hit[2] } : { icon: '·', label: '—' }
}

// ---------- Formato (Europe/Madrid) ----------
const TZ = 'Europe/Madrid'
const fmt = (opts) => new Intl.DateTimeFormat('es-ES', { timeZone: TZ, ...opts })
export const hour = (d) => fmt({ hour: '2-digit', minute: '2-digit' }).format(new Date(d))
export const dayShort = (d) => fmt({ weekday: 'short', day: 'numeric' }).format(new Date(d))
export const dayLong = (d) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d))
export const dateTime = (d) => fmt({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d))

// "hace 20 min", "hace 3 h", "hace 2 días"
export function ago(d) {
  if (!d) return 'sin datos'
  const min = Math.round((Date.now() - new Date(d).getTime()) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 48) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} días`
}
export const isRecent = (d, hours = 3) => Boolean(d && Date.now() - new Date(d).getTime() < hours * 3600e3)

// Valores: decimales en español y unidades para el ciudadano
const n = (v, dec = 1) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-ES', { maximumFractionDigits: dec, minimumFractionDigits: 0 }))
export const fmtTemp = (v) => (v === null || v === undefined ? '—' : `${n(v)} °C`)
export const fmtWind = (ms) => (ms === null || ms === undefined ? '—' : `${n(ms * 3.6, 0)} km/h`)
export const fmtValue = (variable, v) => {
  if (v === null || v === undefined) return '—'
  if (variable.startsWith('temperature')) return fmtTemp(v)
  if (variable === 'wind_speed' || variable === 'wind_gust') return fmtWind(v)
  if (variable === 'relative_humidity' || variable === 'precipitation_probability' || variable === 'cloud_cover') return `${n(v, 0)} %`
  if (variable.startsWith('pressure')) return `${n(v, 0)} hPa`
  if (variable === 'precipitation') return `${n(v)} mm`
  if (variable === 'solar_radiation') return `${n(v, 0)} W/m²`
  if (variable === 'wind_direction') return `${compass(v)}`
  return n(v)
}
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO']
export const compass = (deg) => (deg === null || deg === undefined ? '—' : COMPASS[Math.round(((deg % 360) / 22.5)) % 16])

export const VARIABLE_LABELS = {
  temperature: 'Temperatura', temperature_max: 'Máxima', temperature_min: 'Mínima', relative_humidity: 'Humedad',
  pressure: 'Presión (estación)', pressure_msl: 'Presión (nivel del mar)', wind_speed: 'Viento', wind_gust: 'Racha',
  wind_direction: 'Dirección', precipitation: 'Precipitación', solar_radiation: 'Radiación solar'
}
// Qué significa cada valor según cómo se ha medido (instantáneo, media, acumulado…)
export function aggregationNote(o) {
  if (!o) return ''
  const mins = o.intervalStart && o.observedAt ? Math.round((new Date(o.observedAt) - new Date(o.intervalStart)) / 60000) : 0
  if (o.aggregation === 'sum') return mins >= 600 ? 'acumulada hoy' : `en ${mins} min`
  if (o.aggregation === 'mean') return mins ? `media de ${mins} min` : 'media'
  if (o.aggregation === 'max') return mins >= 600 ? 'máxima de hoy' : `máx. en ${mins} min`
  if (o.aggregation === 'min') return mins >= 600 ? 'mínima de hoy' : `mín. en ${mins} min`
  return ''
}

// Enlace compartible del tiempo de un pueblo: ?tiempo=bejar
export function weatherLink(slug) {
  const u = new URL(window.location.href)
  u.searchParams.set('tiempo', slug)
  return u.toString()
}

// Ajuste afín lon/lat → coordenadas del SVG del mapa por mínimos cuadrados, a partir de pares conocidos
// (centro de cada municipio en el SVG y su lon/lat oficial). Devuelve null si no hay pares suficientes.
export function fitAffine(pairs) {
  if (pairs.length < 3) return null
  const solve = (key) => {
    // Ecuaciones normales 3×3 para v = a·lon + b·lat + c, resueltas por Gauss con pivote parcial
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
    const r = [0, 0, 0]
    for (const p of pairs) {
      const row = [p.lon, p.lat, 1]
      for (let i = 0; i < 3; i++) {
        r[i] += row[i] * p[key]
        for (let j = 0; j < 3; j++) M[i][j] += row[i] * row[j]
      }
    }
    for (let c = 0; c < 3; c++) {
      let piv = c
      for (let k = c + 1; k < 3; k++) if (Math.abs(M[k][c]) > Math.abs(M[piv][c])) piv = k
      ;[M[c], M[piv]] = [M[piv], M[c]]
      ;[r[c], r[piv]] = [r[piv], r[c]]
      for (let k = c + 1; k < 3; k++) {
        const q = M[k][c] / M[c][c]
        for (let j = c; j < 3; j++) M[k][j] -= q * M[c][j]
        r[k] -= q * r[c]
      }
    }
    const x = [0, 0, 0]
    for (let i = 2; i >= 0; i--) {
      let acc = r[i]
      for (let j = i + 1; j < 3; j++) acc -= M[i][j] * x[j]
      x[i] = acc / M[i][i]
    }
    return x
  }
  const ax = solve('x')
  const ay = solve('y')
  return (lon, lat) => ({ x: ax[0] * lon + ax[1] * lat + ax[2], y: ay[0] * lon + ay[1] * lat + ay[2] })
}

// "LA COVATILLA, ESTACIÓN DE ESQUÍ" → "La Covatilla, Estación de Esquí" (los nombres de AEMET vienen en mayúsculas)
export const stationName = (n) => (!n || /[a-z]/.test(n) ? n || ''
  : n.toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Del|La|Las|Los|El|Y)\b/g, w => w.toLowerCase()).replace(/^(\p{Ll})/u, c => c.toUpperCase()))
