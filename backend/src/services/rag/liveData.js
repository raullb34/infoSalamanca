// Datos que cambian (fiestas, bibliobús, teatro): se piden a las rutas del propio backend, que ya tienen
// caché, según de qué trate la pregunta. Devuelven fragmentos como los del índice: { town, title, text, source, url }.
const axios = require('axios')
const { formatFestivalDays, nextFestival } = require('./dates')
const { findTown } = require('../../helpers/townIndex')

const BASE = `http://127.0.0.1:${process.env.PORT || 4000}/api/towns`
const get = async (path) => {
  const { data } = await axios.get(BASE + path, { timeout: 15000 })
  return Array.isArray(data) ? data : data?.data || []
}

const INTENTS = {
  fiestas: /fiesta|patron|festej|romer[ií]a|feria/i,
  bibliobus: /bibliob[uú]s|biblioteca|libros?\b|pr[eé]stamo|lectura/i,
  teatro: /teatro|obra|funci[oó]n|espect[aá]culo|concierto|evento|agenda|planes?\b|qu[eé] hacer|fin de semana|esta semana|actividad/i
}

const detectIntents = (question) => Object.keys(INTENTS).filter(k => INTENTS[k].test(question))

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

async function teatro(towns) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const events = (await get('/teatro'))
    .map(e => ({ ...e, start: new Date(e.fecha_inicio) }))
    .filter(e => !isNaN(e.start) && e.start >= today)
    .sort((a, b) => a.start - b.start)
  const ines = new Set(towns.map(t => t.ine))
  const pick = towns.length
    ? events.filter(e => ines.has(findTown([e.municipio], e.cp)?.ine))
    : events.slice(0, 8)
  return pick.slice(0, 8).map(e => ({
    town: e.municipio, kind: 'teatro', title: e.titulo,
    text: `${e.titulo}: ${fmtDate(e.start)} en ${e.municipio}.${e.precio ? ` Precio: ${e.precio}.` : ''} ${stripHtml(e.descripcion).slice(0, 200)}`.trim(),
    source: 'Junta de Castilla y León (agenda cultural)', url: null
  }))
}

// Fragmentos en directo para la pregunta (nunca lanza: si una fuente falla, se sigue sin ella)
async function liveFragments(question, towns) {
  const intents = detectIntents(question)
  const tasks = { fiestas, bibliobus, teatro }
  const lists = await Promise.all(intents.map(i => tasks[i](towns).catch(e => {
    console.warn(`⚠️ Asistente, datos de ${i}:`, e.message)
    return []
  })))
  return { intents, fragments: lists.flat() }
}

module.exports = { liveFragments, detectIntents }
