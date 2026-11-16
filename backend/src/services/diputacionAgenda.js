// Agenda cultural de la Diputación de Salamanca (La Salina), por tipo de actividad:
//   https://www.lasalina.es/lasalina/agenda.html?id_tipoactividad=<tipo>&area=Cultura&cod_area=6
// El listado (2-3 páginas) trae título, fechas sin año, pueblo y lugar; la ficha de cada actividad trae
// las fechas completas, la hora, la entrada y la descripción. Todo se guarda en memoria: el listado 1 hora
// y cada ficha 12 horas, así que una consulta normal no hace ninguna petición a La Salina.
// Los eventos salen con la misma forma que los de la agenda de la Junta (titulo, fecha_inicio, hora_inicio...).
const axios = require('axios')
const cheerio = require('cheerio')
const { findTown } = require('../helpers/townIndex')

const ORIGIN = 'https://www.lasalina.es'
const LIST = `${ORIGIN}/lasalina/agenda.html`
const LIST_PARAMS = { area: 'Cultura', cod_area: 6 }
const MAX_PAGES = 10
const LIST_TTL = 60 * 60 * 1000
const DETAIL_TTL = 12 * 60 * 60 * 1000
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; infoSalamanca-bot/1.0; +https://infosalamanca.duckdns.org)', Accept: 'text/html' }

// Clase del <li> → categoría y temática como las de la Junta
const CATEGORIES = {
  escenaTeatro: ['Espectáculos', 'Teatro'],
  escenaDanza: ['Espectáculos', 'Danza'],
  escenaMusica: ['Música', 'Música'],
  musica: ['Música', 'Música'],
  arteExposiciones: ['Exposiciones', 'Exposición'],
  cine: ['Cine', 'Cine'],
  cineProyecciones: ['Cine', 'Proyección'],
  musicaDanza: ['Música', 'Música y danza'],
  cursosTalleres: ['Cursos y talleres', 'Taller'],
  literatura: ['Literatura', 'Literatura'],
  juventud: ['Juventud', 'Juventud']
}
const categoryOf = (cls) => {
  const key = String(cls || '').split(/\s+/).find(c => c && c !== 'evento')
  return CATEGORIES[key] || ['Cultura', null]
}

// La Salina guarda a veces el símbolo del euro mal codificado ("2 ¿"): se recupera cuando va tras una cifra
const text = ($el) => $el.text().replace(/\s+/g, ' ').replace(/(\d)\s*¿(?=\s|$|[.,;·])/g, '$1 €').trim()
const absolute = (src) => (!src ? null : src.startsWith('http') ? src : ORIGIN + (src.startsWith('/') ? '' : '/') + src)
const isoDate = (dmy) => {
  const m = String(dmy || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null
}

const get = (url, params) => axios.get(url, { params, timeout: 20000, headers: HEADERS, responseType: 'text' }).then(r => r.data)

// ---------- Listado ----------
function parseList(html) {
  const $ = cheerio.load(html)
  const out = []
  $('li.evento').each((_, li) => {
    const $li = $(li)
    const link = $li.find('h4 a').first()
    const id = (link.attr('href') || '').match(/id_actividad=(\d+)/)?.[1]
    if (!id) return
    out.push({
      id,
      titulo: text(link),
      anteTitulo: text($li.find('.anteTitulo').first()) || null,
      clase: $li.attr('class'),
      nucleo: text($li.find('.nucleoEvento').first()) || null,
      municipio: text($li.find('.municipioEvento').first()).replace(/^\(|\)$/g, '').trim() || null,
      lugar: text($li.find('.localizacionEvento').first()) || null,
      imagen: absolute($li.find('.listThumb img').attr('src'))
    })
  })
  return out
}

// ---------- Ficha ----------
const coords = (href) => {
  const m = String(href || '').match(/[?&]c=\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
  return m ? { lat: Number(m[1]), lon: Number(m[2]) } : { lat: null, lon: null }
}
function parseDetail(html) {
  const $ = cheerio.load(html)
  const main = $('.evento-main').first()
  if (!main.length) return null
  const horario = text(main.find('.horarioEvento').first())
  return {
    inicio: isoDate(text(main.find('.inicioEvento').first())),
    fin: isoDate(text(main.find('.finEvento').first())),
    hora: horario.match(/\d{1,2}[:.]\d{2}/)?.[0]?.replace('.', ':') || null,
    horario: horario || null,
    entrada: text(main.find('.entradaEvento').first()).replace(/\.+$/, '') || null,
    descripcion: text(main.find('.descripcionEvento').first()) || null,
    municipio: text(main.find('.municipioEvento').first()) || null,
    lugar: text(main.find('.localizacionEvento').first()) || null,
    organiza: text(main.find('.organismoEvento').first()) || null,
    // "Ver mapa" lleva las coordenadas del lugar: mapadeactividad.html?m=…&c=40.962886, -5.665831
    ...coords(main.find('.mapaEvento').attr('href'))
  }
}

const details = new Map() // id → { at, data }
async function detailOf(id) {
  const hit = details.get(id)
  if (hit && Date.now() - hit.at < DETAIL_TTL) return hit.data
  const data = parseDetail(await get(LIST, { tipo: 'detalle', id_actividad: id, area: 'Cultura' }))
  details.set(id, { at: Date.now(), data })
  return data
}

// Pocas peticiones a la vez: la web es de la Diputación, no hay que cargarla
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const k = i++
      try { out[k] = await fn(items[k]) } catch { out[k] = null }
    }
  }))
  return out
}

// El antetítulo a veces es el ciclo o festival ("FESTEACO 2026", "Provincia a Escena") y otras una línea de
// créditos ("Escrita y dirigida por…"): solo los cortos van delante del título; el resto, a la descripción
const isSeries = (s) => s && s.split(/\s+/).length <= 4 && !/^(con|de|por|escrit|dirigid|a cargo)/i.test(s)

function toEvent(item, d, type = null) {
  let [categoria, tematica] = categoryOf(item.clase)
  // Clase desconocida: la categoría la dice el tipo de actividad del listado
  if (categoria === 'Cultura' && TYPE_CATEGORY[type]) [categoria, tematica] = TYPE_CATEGORY[type]
  const ante = item.anteTitulo && !item.titulo.toLowerCase().includes(item.anteTitulo.toLowerCase()) ? item.anteTitulo : null
  const municipio = d?.municipio || item.municipio || item.nucleo
  const town = findTown([municipio, item.nucleo].filter(Boolean))
  return {
    id_evento: `dip-${item.id}`,
    titulo: isSeries(ante) ? `${ante}: ${item.titulo}` : item.titulo,
    descripcion: [ante && !isSeries(ante) ? `${ante}.` : null, d?.descripcion].filter(Boolean).join(' ') || null,
    categoria,
    tematica,
    fecha_inicio: d?.inicio || null,
    fecha_fin: d?.fin && d.fin !== d.inicio ? d.fin : null,
    hora_inicio: d?.hora ? `${d.hora} h` : null,
    horario: d?.horario || null,
    precio: d?.entrada || null,
    imagen_evento: item.imagen,
    lugar_celebracion: d?.lugar || item.lugar,
    nombre_localidad: item.nucleo || municipio,
    municipio,
    cod_ine: town?.ine || null,
    organiza: d?.organiza || null,
    latitud: d?.lat ?? null,
    longitud: d?.lon ?? null,
    enlace_contenido: `${LIST}?tipo=detalle&id_actividad=${item.id}&area=Cultura`,
    source: 'diputacion'
  }
}

// Tipos de actividad de La Salina (área Cultura). Todos menos cine y proyecciones (van con los cines,
// services/cinesService.js) forman la agenda cultural de cada pueblo; muchos están vacíos casi todo el año
// (concursos, cultura tradicional…) pero se leen igual para que entren solos cuando publiquen algo.
const TYPES = { escena: 1, musica: 2, arte: 4, cine: 3, concursos: 5, formacion: 6, otras: 11, tradicional: 13, turismo: 20 }
const AGENDA_TYPES = ['escena', 'musica', 'arte', 'formacion', 'concursos', 'tradicional', 'otras', 'turismo']
// Categoría (como las de la Junta) de cada tipo, si la clase del evento no la dice
const TYPE_CATEGORY = {
  escena: ['Espectáculos', null],
  musica: ['Música', 'Música'],
  arte: ['Exposiciones', 'Exposición'],
  concursos: ['Concursos y certámenes', 'Concurso'],
  formacion: ['Cursos y talleres', 'Taller'],
  otras: ['Otras actividades', null],
  tradicional: ['Cultura tradicional', null],
  turismo: ['Visitas', 'Visita guiada']
}

const caches = {} // tipo → { at, events }
const inflight = {}

// Actividades de un tipo (de caché si es reciente)
async function getType(type) {
  const c = caches[type]
  if (c && Date.now() - c.at < LIST_TTL) return c.events
  if (inflight[type]) return inflight[type]
  inflight[type] = (async () => {
    const items = []
    const seen = new Set()
    for (let page = 1; page <= MAX_PAGES; page++) {
      const list = parseList(await get(LIST, { ...LIST_PARAMS, id_tipoactividad: TYPES[type], nPagina: page }))
      const fresh = list.filter(it => !seen.has(it.id))
      if (!fresh.length) break // la última página se repite o viene vacía
      fresh.forEach(it => seen.add(it.id))
      items.push(...fresh)
    }
    const ds = await mapLimit(items, 4, it => detailOf(it.id))
    const events = items.map((it, k) => toEvent(it, ds[k], type)).filter(e => e.fecha_inicio)
    caches[type] = { at: Date.now(), events }
    return events
  })().finally(() => { delete inflight[type] })
  return inflight[type]
}

// Si un tipo falla, lo último que se tenía de él (o nada)
const safeType = (type) => getType(type).catch(err => {
  console.warn(`⚠️ Agenda de la Diputación (${type}):`, err.message)
  return caches[type]?.events || []
})

// Agenda cultural: todos los tipos salvo el cine (una actividad puede salir en dos tipos)
async function getAgenda() {
  const lists = []
  for (const t of AGENDA_TYPES) lists.push(await safeType(t)) // de uno en uno: no cargar la web
  const seen = new Set()
  return lists.flat().filter(e => !seen.has(e.id_evento) && seen.add(e.id_evento))
}

// Cine y proyecciones (ciclos de la Filmoteca, documentales…)
const getScreenings = () => safeType('cine')

// Eventos de un municipio (código INE). Nunca lanza.
async function eventsForTown(ine) {
  return (await getAgenda()).filter(e => e.cod_ine === String(ine))
}

module.exports = { getAgenda, getScreenings, eventsForTown, _test: { parseList, parseDetail, toEvent } }
