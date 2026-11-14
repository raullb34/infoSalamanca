// Agenda cultural de la Diputación de Salamanca (La Salina):
//   https://www.lasalina.es/lasalina/agenda.html?id_tipoactividad=1&area=Cultura&cod_area=6
// El listado (2-3 páginas) trae título, fechas sin año, pueblo y lugar; la ficha de cada actividad trae
// las fechas completas, la hora, la entrada y la descripción. Todo se guarda en memoria: el listado 1 hora
// y cada ficha 12 horas, así que una consulta normal no hace ninguna petición a La Salina.
// Los eventos salen con la misma forma que los de la agenda de la Junta (titulo, fecha_inicio, hora_inicio...).
const axios = require('axios')
const cheerio = require('cheerio')
const { findTown } = require('../helpers/townIndex')

const ORIGIN = 'https://www.lasalina.es'
const LIST = `${ORIGIN}/lasalina/agenda.html`
const LIST_PARAMS = { id_tipoactividad: 1, area: 'Cultura', cod_area: 6 }
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
    organiza: text(main.find('.organismoEvento').first()) || null
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

function toEvent(item, d) {
  const [categoria, tematica] = categoryOf(item.clase)
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
    enlace_contenido: `${LIST}?tipo=detalle&id_actividad=${item.id}&area=Cultura`,
    source: 'diputacion'
  }
}

let cache = { at: 0, events: [] }
let inflight = null

// Todos los eventos de la agenda cultural (de caché si es reciente)
async function getAgenda() {
  if (Date.now() - cache.at < LIST_TTL) return cache.events
  if (inflight) return inflight
  inflight = (async () => {
    const items = []
    const seen = new Set()
    for (let page = 1; page <= MAX_PAGES; page++) {
      const list = parseList(await get(LIST, { ...LIST_PARAMS, nPagina: page }))
      const fresh = list.filter(it => !seen.has(it.id))
      if (!fresh.length) break // la última página se repite o viene vacía
      fresh.forEach(it => seen.add(it.id))
      items.push(...fresh)
    }
    const ds = await mapLimit(items, 4, it => detailOf(it.id))
    const events = items.map((it, k) => toEvent(it, ds[k])).filter(e => e.fecha_inicio)
    cache = { at: Date.now(), events }
    console.log(`✅ Agenda de la Diputación: ${events.length} actividades culturales`)
    return events
  })().finally(() => { inflight = null })
  return inflight
}

// Eventos de un municipio (código INE). Nunca lanza: si La Salina falla, devuelve lo último que tenía.
async function eventsForTown(ine) {
  try {
    return (await getAgenda()).filter(e => e.cod_ine === String(ine))
  } catch (err) {
    console.warn('⚠️ Agenda de la Diputación:', err.message)
    return cache.events.filter(e => e.cod_ine === String(ine))
  }
}

module.exports = { getAgenda, eventsForTown, _test: { parseList, parseDetail, toEvent } }
