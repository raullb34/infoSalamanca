// Datos que cambian (fiestas, bibliobús, agenda cultural, ciencia, el tiempo): se piden a las rutas del propio backend, que ya tienen
// caché, según de qué trate la pregunta. Devuelven fragmentos como los del índice: { town, title, text, source, url }.
const axios = require('axios')
const { formatFestivalDays, nextFestival } = require('./dates')
const { findTown } = require('../../helpers/townIndex')
const agendas = require('../agendas')
const agendaCultural = require('../agendaCultural')

const BASE = `http://127.0.0.1:${process.env.PORT || 4000}/api/towns`
const WEATHER = `http://127.0.0.1:${process.env.PORT || 4000}/api/v1/weather`
const get = async (path) => {
  const { data } = await axios.get(BASE + path, { timeout: 15000 })
  return Array.isArray(data) ? data : data?.data || []
}

const INTENTS = {
  fiestas: /fiesta|patron|festej|romer[ií]a|feria/i,
  bibliobus: /bibliob[uú]s|biblioteca|libros?\b|pr[eé]stamo|lectura/i,
  // Espectáculos, exposiciones y charlas, talleres y lecturas (la función agenda decide cuáles según la pregunta)
  agenda: /teatro|obra|funci[oó]n|espect[aá]culo|concierto|m[uú]sica|danza|t[ií]teres|circo|exposici[oó]n|museo|charla|taller|curso|cuentacuentos|club de lectura|evento|agenda|planes?\b|qu[eé] hacer|fin de semana|esta semana|actividad|ocio/i,
  ciencia: /ciencia|cient[ií]fic|congreso|divulgaci[oó]n|investigaci[oó]n|investigador|tecnolog[ií]a|innovaci[oó]n|jornadas? (t[eé]cnic|m[eé]dic|cient)|charla|conferencia|universidad|usal\b/i
}

// "El tiempo" en español casi siempre es el meteorológico, salvo en giros como "cuánto tiempo", "tiempo libre",
// "a tiempo", "hace mucho tiempo" o "la línea del tiempo"
// (\b no entiende de tildes: los límites de palabra van a mano con (^|[^\p{L}]) y la bandera u)
const WEATHER_WORDS = /llov|lluev|lluvi|nev(ar|ad|ó|ará)|niev|temperatura|grados|calor|(^|[^\p{L}])fr[ií]o($|[^\p{L}])|viento|helad|niebla|tormenta|granizo|pron[oó]stico|meteo|paraguas|soleado|nublado|nubes|(^|[^\p{L}])clima($|[^\p{L}])|(hace|har[aá]|habr[aá]|saldr[aá] el) sol($|[^\p{L}])/iu
const TIEMPO = /(^|[^\p{L}])tiempo($|[^\p{L}])/iu
const NOT_WEATHER = /(^|[^\p{L}])(cu[aá]nt[oa]s?|mucho|poco|m[aá]s|menos|suficiente|al mismo|a|un|otro|el mismo|cada)\s+tiempo($|[^\p{L}])|tiempo\s+(libre|atr[aá]s|de\s+(viaje|espera|recorrido|visita|coche|camino|llegada))|l[ií]nea del tiempo|(^|[^\p{L}])tiempos($|[^\p{L}])/iu
const isWeather = (q) => WEATHER_WORDS.test(q) || (TIEMPO.test(q) && !NOT_WEATHER.test(q))

// Con una pregunta del tiempo ("¿lloverá el fin de semana?"), la agenda solo si se pide expresamente
const EVENTS_EXPLICIT = /teatro|obra|funci[oó]n|espect[aá]culo|concierto|exposici[oó]n|taller|charla|evento|agenda|actividad|planes?(\s|$)|qu[eé] hacer/i
function detectIntents(question) {
  const weather = isWeather(question)
  const others = Object.keys(INTENTS).filter(k => INTENTS[k].test(question) && !(weather && k === 'agenda' && !EVENTS_EXPLICIT.test(question)))
  return weather ? ['tiempo', ...others] : others // el tiempo, primero
}

const WEEKDAY = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' })
const fmtDate = (d) => WEEKDAY.format(d)
const inDays = (n) => (n === 0 ? 'hoy' : n === 1 ? 'mañana' : `dentro de ${n} días`)

async function fiestas(towns) {
  const all = await get('/all-festivals')
  const withNext = all.map(f => ({ ...f, next: nextFestival(f.celebration_dates) })).filter(f => f.next)
  if (towns.length) {
    const ines = new Set(towns.map(t => t.ine))
    return withNext.filter(f => ines.has(String(f.cod_ine))).map(f => ({
      town: f.municipality_name, kind: 'fiestas', title: `Fiestas de ${f.municipality_name}`,
      text: `Fiestas locales de ${f.municipality_name}: ${formatFestivalDays(f.celebration_dates)}. La próxima es el ${fmtDate(f.next.date)} (${inDays(f.next.days)}).`,
      source: 'Diputación de Salamanca', url: null
    }))
  }
  const soon = withNext.filter(f => f.next.days <= 30).sort((a, b) => a.next.days - b.next.days).slice(0, 10)
  if (!soon.length) return []
  return [{
    town: null, kind: 'fiestas', title: 'Fiestas en los próximos 30 días',
    text: 'Fiestas locales en los próximos 30 días: ' + soon.map(f => `${f.municipality_name} (${fmtDate(f.next.date)})`).join('; ') + '.',
    source: 'Diputación de Salamanca', url: null
  }]
}

const shortDay = (dia) => {
  const m = String(dia || '').match(/(\d{2})\/(\d{2})\/\d{4}\s*\(([^)]+)\)/)
  return m ? `${m[3]} ${Number(m[1])}/${Number(m[2])}` : dia || ''
}

async function bibliobus(towns) {
  if (!towns.length) {
    return [{
      town: null, kind: 'bibliotecas', title: 'Bibliobuses de Salamanca',
      text: 'Tres bibliobuses con base en Salamanca recorren la provincia con rutas que paran una vez al mes en cada pueblo. Pregunta por un pueblo concreto para saber su próxima visita.',
      source: 'Junta de Castilla y León', url: 'https://bibliotecas.jcyl.es/'
    }]
  }
  const ines = new Set(towns.map(t => t.ine))
  const [points, libs] = await Promise.all([get('/bibliobus/points?maxPages=8'), get('/libraries?maxPages=6')])
  const out = []
  for (const l of libs.filter(l => ines.has(String(l.cod_ine)))) {
    out.push({ town: l.municipio, kind: 'bibliotecas', title: l.nombre, text: `${l.nombre}${l.direccion ? `, ${l.direccion}` : ''}.`, source: 'Junta de Castilla y León', url: l.enlace })
  }
  const today = Date.now() - 86400000
  for (const t of towns) {
    const stops = points.filter(p => String(p.cod_ine) === t.ine && p.nextDate && new Date(p.nextDate).getTime() >= today)
      .sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate))
    if (!stops.length) continue
    const s = stops[0]
    out.push({
      town: t.name, kind: 'bibliobus', title: `Bibliobús en ${t.name}`,
      text: `El bibliobús pasa por ${t.name}${s.localidad && s.localidad !== t.name ? ` (${s.localidad})` : ''} el ${shortDay(s.dia)}${s.hora ? `, ${String(s.hora).replace(/\s*\n\s*/g, ' · ')}` : ''}${s.lugar ? `, en ${s.lugar}` : ''}.${s.incidencias ? ` Aviso: ${s.incidencias}` : ''}`,
      source: 'Junta de Castilla y León', url: s.enlace || null
    })
  }
  return out
}

const stripHtml = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()

// ---------- Agenda cultural ----------
// Espectáculos, exposiciones y charlas, talleres y lecturas de las tres agendas (Junta, Diputación y Turismo de
// Salamanca), ya juntas y sin repetir en services/agendaCultural.js. La pregunta decide qué grupos: "¿hay teatro?",
// solo espectáculos; "¿qué exposiciones hay?", solo exposiciones; "¿qué hacer el finde?", los tres. Con "niños",
// "familia", "peques"…, solo lo pensado para niños o familias.
const GROUPS = {
  espectaculos: /teatro|obra|funci[oó]n|espect[aá]culo|concierto|m[uú]sica|danza|t[ií]teres|circo|mon[oó]logo|zarzuela|[oó]pera/i,
  exposiciones: /exposici[oó]n|exposiciones|muestra|museo|galer[ií]a|pintura|fotograf[ií]a|(^|[^\p{L}])arte($|[^\p{L}])/iu,
  actividades: /charla|conferencia|taller|curso|club de lectura|cuentacuentos|cuentos|presentaci[oó]n de(l| un)? libro|visita guiada|juego de pistas|ajedrez|debate/i
}
const KIDS_WORDS = /niñ[oa]s?|infantil|familia|peques|hij[oa]s|cr[ií][oa]s|beb[eé]s/i
const GROUP_LABEL = { espectaculos: 'Espectáculo', exposiciones: 'Exposición', actividades: 'Actividad' }
const FULL_DATE = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' })

async function agenda(towns, question = '') {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const all = await agendaCultural.getAll()
  const asked = Object.keys(GROUPS).filter(g => GROUPS[g].test(question))
  const groups = asked.length ? asked : Object.keys(GROUPS)
  const kids = KIDS_WORDS.test(question)
  const events = groups.flatMap(g => all[g].map(e => ({ ...e, grupo: g })))
    .filter(e => !kids || e.infantil)
    .map(e => ({ ...e, ine: e.cod_ine || findTown([e.municipio], e.cp)?.ine, start: new Date(e.fecha_inicio), end: e.fecha_fin ? new Date(e.fecha_fin) : null }))
    // Lo que sigue abierto (una exposición, un ciclo) cuenta mientras no acabe
    .filter(e => !isNaN(e.start) && (e.end || e.start) >= today)
    .sort((a, b) => Math.max(a.start, today) - Math.max(b.start, today))
  const ines = new Set(towns.map(t => t.ine))
  const pick = towns.length ? events.filter(e => ines.has(e.ine)) : events
  // Lo ya empezado (una exposición, un ciclo): "abierto hasta el…"; con el año si no es este
  const withYear = (d) => (d.getFullYear() !== today.getFullYear() ? FULL_DATE.format(d) : fmtDate(d))
  const when = (e) => (e.end && e.end > e.start
    ? (e.start < today ? `abierto hasta el ${withYear(e.end)}` : `del ${fmtDate(e.start)} al ${withYear(e.end)}`)
    : fmtDate(e.start))
  return pick.slice(0, 10).map(e => ({
    town: e.municipio, kind: 'agenda', title: e.titulo,
    text: `${GROUP_LABEL[e.grupo]}${e.grupo === 'actividades' && (e.tematica || e.categoria) ? ` (${e.tematica || e.categoria})` : ''}${e.infantil ? ', para niños y familias' : ''}: ${e.titulo}, ${when(e)}${e.hora_inicio ? `, ${e.hora_inicio}` : ''} en ${e.municipio}${e.lugar_celebracion ? ` (${e.lugar_celebracion})` : ''}.${e.precio ? ` Precio: ${e.precio}.` : ''} ${stripHtml(e.descripcion).slice(0, 200)}`.trim(),
    source: e.fuente === 'Junta de Castilla y León' ? 'Junta de Castilla y León (agenda cultural)' : e.fuente === 'Diputación de Salamanca' ? 'Diputación de Salamanca (La Salina)' : e.fuente,
    url: e.enlace_contenido || null
  }))
}

// ---------- Ciencia ----------
// Congresos, jornadas y divulgación (Salamanca Tech, Convention Bureau, Turismo de Salamanca) y las últimas
// noticias de ciencia de la Universidad de Salamanca
async function ciencia(towns) {
  const [eventos, noticias] = await Promise.all([agendas.scienceEvents(), agendas.scienceNews()])
  const ines = new Set(towns.map(t => t.ine))
  const pick = towns.length ? eventos.filter(e => ines.has(e.cod_ine)) : eventos
  const out = pick.slice(0, 6).map(e => ({
    town: e.municipio, kind: 'ciencia', title: e.titulo,
    text: `${e.titulo} (${e.categoria}): ${e.fecha_fin ? `del ${fmtDate(new Date(e.fecha_inicio))} al ${fmtDate(new Date(e.fecha_fin))}` : fmtDate(new Date(e.fecha_inicio))}${e.hora_inicio ? `, ${e.hora_inicio} h` : ''} en ${e.municipio}${e.lugar_celebracion ? ` (${e.lugar_celebracion})` : ''}.${e.precio ? ` Precio: ${e.precio}.` : ''} ${stripHtml(e.descripcion).slice(0, 200)}`.trim(),
    source: e.fuente, url: e.enlace_contenido
  }))
  for (const n of noticias.slice(0, 3)) {
    out.push({
      town: null, kind: 'ciencia', title: n.titulo,
      text: `Noticia del ${fmtDate(new Date(n.fecha))}: ${n.titulo}. ${n.resumen}`,
      source: 'Universidad de Salamanca (noticias de ciencia)', url: n.enlace
    })
  }
  return out
}

// ---------- El tiempo ----------
// Lo medido en las estaciones cercanas (con su distancia y altitud, porque no es el pueblo) y la previsión.
// Sin pueblo en la pregunta, Salamanca capital.
const SKY = [[[0], 'despejado'], [[1], 'poco nuboso'], [[2], 'intervalos nubosos'], [[3], 'cubierto'], [[45, 48], 'niebla'],
  [[51, 53, 55, 56, 57], 'llovizna'], [[61, 63, 66, 80, 81], 'lluvia'], [[65, 67, 82], 'lluvia fuerte'], [[71, 73, 75, 77, 85, 86], 'nieve'], [[95, 96, 99], 'tormenta']]
const sky = (code) => SKY.find(([c]) => c.includes(Number(code)))?.[1] || null
const num = (v, dec = 0) => (v === null || v === undefined ? null : Number(v).toLocaleString('es-ES', { maximumFractionDigits: dec }))
const HOUR = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
const DAY = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', timeZone: 'Europe/Madrid' })
const NETS = { aemet: 'AEMET', inforiego: 'InfoRiego', meteoclimatic: 'Meteoclimatic' }

async function tiempo(towns) {
  const town = towns[0] || { ine: '37274', name: 'Salamanca' }
  const [cur, fc] = await Promise.all([
    axios.get(`${WEATHER}/municipalities/${town.ine}/current`, { timeout: 15000 }).then(r => r.data).catch(() => null),
    axios.get(`${WEATHER}/municipalities/${town.ine}/forecast`, { params: { hours: 48 }, timeout: 20000 }).then(r => r.data).catch(() => null)
  ])
  const name = cur?.municipality?.name || fc?.municipality?.name || town.name
  const elev = cur?.municipality?.elevation ?? fc?.municipality?.elevation ?? null
  const out = []

  const obs = (cur?.observations || []).filter(o => o.recent && o.variables?.temperature).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 3)
  if (obs.length) {
    const lines = obs.map(o => {
      const v = o.variables
      const alt = o.altitude ? `, a ${o.altitude} m de altitud${Number.isFinite(o.altitudeDiff) && Math.abs(o.altitudeDiff) >= 50 ? ` (${Math.abs(o.altitudeDiff)} m más ${o.altitudeDiff > 0 ? 'alta' : 'baja'} que el pueblo)` : ''}` : ''
      const bits = [`${num(v.temperature.value, 1)} °C`]
      if (v.relative_humidity) bits.push(`humedad ${num(v.relative_humidity.value)} %`)
      if (v.wind_speed) bits.push(`viento ${num(v.wind_speed.value * 3.6)} km/h`)
      if (v.precipitation && v.precipitation.value > 0) bits.push(`${num(v.precipitation.value, 1)} mm de lluvia`)
      return `estación ${o.name} (${NETS[o.network] || o.network}, a ${num(o.distanceKm)} km${alt}), a las ${HOUR.format(new Date(o.lastObservationAt))}: ${bits.join(', ')}`
    })
    out.push({
      town: name, kind: 'tiempo', title: `Tiempo medido cerca de ${name}`,
      text: `Medido ahora en estaciones cercanas a ${name}${elev !== null ? ` (el pueblo está a ${Math.round(elev)} m)` : ''}; son mediciones de esas estaciones, no del pueblo: ${lines.join('; ')}.`,
      source: obs.map(o => NETS[o.network]).filter((v, i, a) => a.indexOf(v) === i).join(', '), url: null
    })
  }

  const models = fc?.models || []
  const main = models.find(m => m.model === 'ecmwf_ifs025') || models[0]
  if (main?.daily?.time?.length) {
    const days = main.daily.time.slice(0, 5).map((t, i) => {
      const d = main.daily
      const rain = d.precipitation_sum?.[i]
      const prob = d.precipitation_probability_max?.[i]
      return `${DAY.format(new Date(t))}: ${[sky(d.weather_code?.[i]), `máxima ${num(d.temperature_max?.[i])} °C`, `mínima ${num(d.temperature_min?.[i])} °C`,
        prob !== null && prob !== undefined ? `probabilidad de lluvia ${num(prob)} %` : null, rain ? `${num(rain, 1)} mm` : null,
        d.wind_speed_max?.[i] ? `viento hasta ${num(d.wind_speed_max[i] * 3.6)} km/h` : null].filter(Boolean).join(', ')}`
    })
    const now = (cur?.forecastNow || []).find(m => m.model === main.model)
    // ¿Coinciden los modelos? Máxima de hoy y de mañana según cada uno
    const spread = models.length > 1 ? ' Máximas de hoy y mañana según cada modelo: ' + models.map(m => `${m.label} ${num(m.daily?.temperature_max?.[0])}/${num(m.daily?.temperature_max?.[1])} °C`).join(', ') + '.' : ''
    out.push({
      town: name, kind: 'tiempo', title: `Previsión del tiempo en ${name}`,
      text: `Previsión para ${name} (modelo ${main.label}${main.issuedAt ? `, pasada de las ${HOUR.format(new Date(main.issuedAt))}` : ''}).${now ? ` Ahora: ${sky(now.weather_code) || ''}, ${num(now.temperature, 1)} °C.` : ''} ${days.join('. ')}.${spread}`,
      source: 'Open-Meteo (modelos ECMWF, ICON-EU y GFS)', url: 'https://open-meteo.com/'
    })
  }
  return out
}

// Fragmentos en directo para la pregunta (nunca lanza: si una fuente falla, se sigue sin ella)
async function liveFragments(question, towns) {
  const intents = detectIntents(question)
  const tasks = { fiestas, bibliobus, agenda, tiempo, ciencia }
  const lists = await Promise.all(intents.map(i => tasks[i](towns, question).catch(e => {
    console.warn(`⚠️ Asistente, datos de ${i}:`, e.message)
    return []
  })))
  return { intents, fragments: lists.flat() }
}

module.exports = { liveFragments, detectIntents, isWeather }
