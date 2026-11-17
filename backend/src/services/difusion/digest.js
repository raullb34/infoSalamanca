// Resumen de la semana para la difusión (canal de WhatsApp y newsletter): lo que hay en la provincia entre dos
// fechas, ya con los datos que la web tiene (no pide nada nuevo a fuera):
//   - Espectáculos (Junta, Diputación y Turismo de Salamanca): services/espectaculos
//   - Fiestas locales: /api/towns/all-festivals
//   - Ciencia: eventos (Salamanca Tech, Convention Bureau…) y noticias de la USAL: services/agendas
//   - El tiempo previsto en Salamanca: /api/v1/weather
// Cada elemento lleva un id estable para que en el panel se pueda elegir qué entra.
const axios = require('axios')
const espectaculos = require('../espectaculos')
const agendas = require('../agendas')
const { nextFestival } = require('../rag/dates')

const SELF = `http://127.0.0.1:${process.env.PORT || 4000}/api`
const TZ = 'Europe/Madrid'
const publicUrl = () => (process.env.PUBLIC_URL || 'https://infosalamanca.duckdns.org').replace(/\/$/, '')

// Fechas de calendario (AAAA-MM-DD) en hora de Madrid
// (con partes: el formato "en-CA" no da AAAA-MM-DD en todas las versiones de Node)
const isoDay = (d) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('es-ES', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const dayOf = (s) => (String(s || '').match(/^\d{4}-\d{2}-\d{2}/) || [])[0] || null
const hourOf = (h) => (String(h || '').match(/(\d{1,2})[:.](\d{2})/) ? String(h).match(/(\d{1,2})[:.](\d{2})/).slice(1).map((x, i) => (i ? x : x.padStart(2, '0'))).join(':') : null)

// ¿El evento [inicio, fin] cae en la semana [desde, hasta]?
const overlaps = (ev, desde, hasta) => {
  const a = dayOf(ev.fecha_inicio)
  const b = dayOf(ev.fecha_fin) || a
  return a && a <= hasta && b >= desde
}
const townLink = (ine) => (ine ? `${publicUrl()}/?pueblo=${ine}` : publicUrl())

function eventItem(ev, seccion, desde) {
  const inicio = dayOf(ev.fecha_inicio)
  const fin = dayOf(ev.fecha_fin)
  return {
    id: `${seccion}:${ev.id_evento || `${inicio}-${String(ev.titulo).slice(0, 40)}`}`,
    titulo: String(ev.titulo || '').replace(/\s+/g, ' ').trim(),
    fecha: inicio < desde ? desde : inicio, // lo ya empezado (un ciclo, una exposición) sale el primer día
    hasta: fin && fin !== inicio ? fin : null,
    empezado: inicio < desde,
    hora: hourOf(ev.hora_inicio),
    lugar: ev.lugar_celebracion || null,
    pueblo: ev.municipio || ev.nombre_localidad || null,
    ine: ev.cod_ine || null,
    precio: ev.precio || null,
    // El de la fuente (Junta, Diputación, periódico…) si es una dirección web; si no, el pueblo en infoSalamanca
    enlace: /^https?:\/\//i.test(ev.enlace_contenido || '') ? ev.enlace_contenido : townLink(ev.cod_ine),
    fuente: ev.fuente || null
  }
}

async function shows(desde, hasta) {
  const list = await espectaculos.getShows().catch(() => [])
  return list.filter(e => overlaps(e, desde, hasta)).map(e => eventItem(e, 'espectaculos', desde))
}

async function fiestas(desde, hasta) {
  const { data } = await axios.get(`${SELF}/towns/all-festivals`, { timeout: 20000 }).catch(() => ({ data: [] }))
  const all = Array.isArray(data) ? data : data?.data || []
  const from = new Date(`${desde}T00:00:00`)
  const out = []
  for (const f of all) {
    const next = nextFestival(f.celebration_dates, from)
    if (!next) continue
    const day = `${next.date.getFullYear()}-${String(next.date.getMonth() + 1).padStart(2, '0')}-${String(next.date.getDate()).padStart(2, '0')}`
    if (day > hasta) continue
    out.push({
      id: `fiestas:${f.cod_ine}-${day}`,
      titulo: `${f.festival_name && !/^fiestas? patronales$/i.test(f.festival_name) ? f.festival_name : 'Fiesta local'} de ${f.municipality_name}`,
      fecha: day, hasta: null, empezado: false, hora: null, lugar: null,
      pueblo: f.municipality_name, ine: String(f.cod_ine), precio: null,
      enlace: townLink(f.cod_ine), fuente: 'Diputación de Salamanca'
    })
  }
  return out
}

async function ciencia(desde, hasta) {
  const [eventos, noticias] = await Promise.all([agendas.scienceEvents().catch(() => []), agendas.scienceNews().catch(() => [])])
  const items = eventos.filter(e => overlaps(e, desde, hasta)).map(e => eventItem(e, 'ciencia', desde))
  // Noticias de la última semana
  const desdeNoticias = addDays(desde, -7)
  const news = noticias.filter(n => n.fecha && isoDay(new Date(n.fecha)) >= desdeNoticias).slice(0, 5).map(n => ({
    id: `noticias:${n.id}`,
    titulo: n.titulo, resumen: n.resumen, fecha: isoDay(new Date(n.fecha)), enlace: n.enlace, fuente: n.fuente
  }))
  return { items, news }
}

// Previsión diaria de Salamanca capital (modelo europeo) para los días de la semana
async function tiempo(desde, hasta) {
  try {
    const { data } = await axios.get(`${SELF}/v1/weather/municipalities/37274/forecast`, { params: { hours: 168 }, timeout: 25000 })
    const m = (data.models || []).find(x => x.model === 'ecmwf_ifs025') || (data.models || [])[0]
    if (!m?.daily?.time) return null
    const days = m.daily.time.map((t, i) => ({
      fecha: isoDay(new Date(t)),
      max: m.daily.temperature_max?.[i] ?? null,
      min: m.daily.temperature_min?.[i] ?? null,
      codigo: m.daily.weather_code?.[i] ?? null,
      lluvia: m.daily.precipitation_probability_max?.[i] ?? null
    })).filter(d => d.fecha >= desde && d.fecha <= hasta && d.max !== null)
    return days.length ? { lugar: 'Salamanca', modelo: m.label, dias: days, fuente: 'Open-Meteo' } : null
  } catch {
    return null
  }
}

const byDate = (a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.hora || '99').localeCompare(String(b.hora || '99'))

// { desde, hasta, secciones: [{ id, titulo, emoji, items }], noticias, tiempo }
async function buildDigest({ desde, dias = 7 } = {}) {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(desde || '') ? desde : isoDay(new Date())
  const to = addDays(from, Math.min(Math.max(Number(dias) || 7, 1), 31) - 1)
  const [esp, fie, cie, tie] = await Promise.all([shows(from, to), fiestas(from, to), ciencia(from, to), tiempo(from, to)])
  return {
    desde: from,
    hasta: to,
    generado: new Date().toISOString(),
    url: publicUrl(),
    secciones: [
      { id: 'espectaculos', titulo: 'Espectáculos', emoji: '🎭', items: esp.sort(byDate) },
      { id: 'fiestas', titulo: 'Fiestas en los pueblos', emoji: '🎉', items: fie.sort(byDate) },
      { id: 'ciencia', titulo: 'Ciencia', emoji: '🔬', items: cie.items.sort(byDate) }
    ],
    noticias: cie.news,
    tiempo: tie
  }
}

// Quita del resumen lo que no se ha marcado en el panel
function select(digest, excluded = []) {
  const out = new Set(excluded)
  return {
    ...digest,
    secciones: digest.secciones.map(s => ({ ...s, items: s.items.filter(i => !out.has(i.id)) })),
    noticias: digest.noticias.filter(n => !out.has(n.id)),
    tiempo: out.has('tiempo') ? null : digest.tiempo
  }
}

module.exports = { buildDigest, select, publicUrl, _test: { overlaps, addDays, eventItem } }
