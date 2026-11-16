// Convocatorias de la Universidad de Salamanca (comunicacion.usal.es/convocatorias): la agenda de actos que la
// USAL anuncia a la prensa cada día (conferencias, exposiciones, presentaciones de libros, conciertos, jornadas).
// Se quedan los actos abiertos al público de la provincia: fuera las ruedas de prensa, los actos institucionales
// (plenos, tomas de posesión, firmas de convenios…) y los de los campus de Ávila y Zamora. La lista da el día y el
// título; la ficha, el texto, de donde salen la hora, el lugar y, en las exposiciones, hasta cuándo siguen.
// Cada acto se clasifica como cultura o ciencia (agendas/classify.js). robots.txt permite /convocatoria*.
// Lista 1 hora en memoria; fichas, 24 horas.
const axios = require('axios')
const cheerio = require('cheerio')
const { findTown } = require('../../helpers/townIndex')
const { classify } = require('./classify')

const BASE = 'https://comunicacion.usal.es'
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; infoSalamanca-bot/1.0; +https://infosalamanca.duckdns.org)' }
const TTL = 60 * 60 * 1000
const DETAIL_TTL = 24 * 60 * 60 * 1000
const PAGES = 2
const MONTHS = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 }

// Las ruedas de prensa no son para el público, salvo las que estrenan algo que sí lo es (una exposición, un ciclo)
const PRESS = /^\s*(rueda|convocatoria) de prensa\s*:?\s*/i
const PRESS_PUBLIC = /exposici[oó]n|concierto|festival|ciclo|muestra|temporada/i
const INSTITUTIONAL = /\b(pleno|claustro|consejo de gobierno|consejo social|toma de posesi[oó]n|firma(n)? (de )?(un |el )?(convenio|acuerdo|protocolo)|reuni[oó]n de|recibe a|visita institucional|feria de empleo|elecciones|junta de facultad|honoris causa|inviste|investidura|acto acad[eé]mico|graduaci[oó]n|bienvenida)\b/i
// (\b no entiende de tildes: "Ávila" no tendría límite de palabra; van a mano con \p{L} y la bandera u)
const ELSEWHERE = /(^|[^\p{L}])([aá]vila|zamora|ponferrada|madrid)($|[^\p{L}])/iu

const get = (url, opts = {}) => axios.get(url, { timeout: 25000, headers: HEADERS, responseType: 'text', ...opts }).then(r => r.data)
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim()
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

function parseList(html) {
  const $ = cheerio.load(html)
  const out = []
  $('article.node--type-usal-convocatoria').each((_, el) => {
    const $a = $(el).find('h2 a').first()
    const href = $a.attr('href')
    const day = Number(clean($(el).find('.date-day').text()))
    const month = MONTHS[clean($(el).find('.date-month').text()).toLowerCase()]
    const year = Number(clean($(el).find('.date-year').text()))
    if (!href || !day || !month || !year) return
    out.push({
      id: $(el).attr('data-history-node-id') || href.split('/').pop(),
      titulo: clean($a.text()),
      fecha: iso(year, month, day),
      link: href.startsWith('http') ? href : BASE + href
    })
  })
  return out
}

// Texto de la ficha: lo que va tras el título
function parseDetail(html) {
  const $ = cheerio.load(html)
  $('script,style').remove()
  const $art = $('article').first()
  const titulo = clean($art.find('h1, h2').first().text())
  let texto = clean($art.text())
  const at = titulo ? texto.indexOf(titulo) : -1
  if (at >= 0) texto = texto.slice(at + titulo.length)
  return {
    descripcion: texto.replace(/Se adjunta[^.]*\./gi, '').replace(/Compartir.*$/i, '').trim().slice(0, 1200) || null,
    imagen: $('meta[property="og:image"]').attr('content') || null
  }
}

// "a las 19:00 horas", "19.30 h" → "19:00"
function hourOf(text) {
  const m = String(text || '').match(/\b(?:a las\s+)?(\d{1,2})[:.](\d{2})\s*(?:h\b|horas)/i) || String(text || '').match(/\ba las (\d{1,2})[:.](\d{2})\b/i)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null
}

// "en el Aula Magna de la Facultad de Filología", "en la Hospedería Fonseca"
const PLACE = /\ben (?:el|la|los|las) ((?:Aula|Paraninfo|Sal[oó]n|Sala|Hospeder[ií]a|Facultad|Escuela|Colegio|Casa|Teatro|Auditorio|Edificio|Biblioteca|Palacio|Patio|Capilla|Centro|Museo|Espacio)\b[^.;:]{0,80}?)(?=[.;:]| a las | el (?:pr[oó]ximo|d[ií]a)|,\s*(?:el|a las|organizad|que|donde|con)\b|$)/i
const placeOf = (text) => clean((String(text || '').match(PLACE) || [])[1]) || null

// "Estará abierta hasta el 22 de diciembre" → fecha (año del acto, o el siguiente si el mes es anterior)
function untilOf(text, fecha) {
  const m = String(text || '').match(/hasta el (\d{1,2}) de ([a-záé]+)(?: de (\d{4}))?/i)
  if (!m || !MONTHS[m[2].toLowerCase()]) return null
  const y0 = Number(fecha.slice(0, 4))
  const mo = MONTHS[m[2].toLowerCase()]
  const y = m[3] ? Number(m[3]) : (mo < Number(fecha.slice(5, 7)) ? y0 + 1 : y0)
  const out = iso(y, mo, Number(m[1]))
  return out > fecha ? out : null
}

// Pueblo: el primero de la provincia que nombre tras "en" ("celebra en Alba de Tormes", "en Béjar") que no sea
// la capital; si no nombra ninguno, Salamanca (la USAL está allí)
const NAMED = /\ben ((?:\p{Lu}[\p{L}-]+)(?:\s+(?:de|del|la|las|los|el|y)?\s*\p{Lu}[\p{L}-]+)*)/gu
function townOf(text) {
  for (const m of String(text || '').matchAll(NAMED)) {
    // "Alba de Tormes el II Simposio": de más largo a más corto hasta dar con un municipio
    const words = m[1].split(/\s+/)
    for (let n = words.length; n > 0; n--) {
      if (/^(de|del|la|las|los|el|y)$/i.test(words[n - 1])) continue
      const town = findTown([words.slice(0, n).join(' ')])
      if (town && town.name !== 'Salamanca') return town
      if (town) break
    }
  }
  return findTown(['Salamanca'])
}

const details = new Map()
async function detail(link) {
  const hit = details.get(link)
  if (hit && Date.now() - hit.at < DETAIL_TTL) return hit.data
  const data = parseDetail(await get(link))
  details.set(link, { at: Date.now(), data })
  return data
}

// Acto de la lista + su ficha → evento con la forma de los de la Junta, o null si no es para el público de aquí
function toEvent(item, d = {}) {
  if (PRESS.test(item.titulo) && !PRESS_PUBLIC.test(item.titulo)) return null
  const it = { ...item, titulo: item.titulo.replace(PRESS, '') }
  const text = `${it.titulo}. ${d.descripcion || ''}`
  if (INSTITUTIONAL.test(it.titulo) || ELSEWHERE.test(text)) return null
  const lugar = placeOf(d.descripcion)
  const kind = classify({ titulo: it.titulo, descripcion: d.descripcion, lugar_celebracion: lugar })
  if (!kind.ambito) return null
  const town = townOf(text)
  return {
    id_evento: `usal-${it.id}`,
    titulo: it.titulo,
    descripcion: d.descripcion || null,
    categoria: kind.categoria,
    tematica: kind.tematica,
    ambito: kind.ambito,
    fecha_inicio: it.fecha,
    fecha_fin: kind.categoria === 'Exposiciones' ? untilOf(d.descripcion, it.fecha) : null,
    hora_inicio: hourOf(d.descripcion),
    precio: null,
    imagen_evento: d.imagen || null,
    lugar_celebracion: lugar,
    nombre_localidad: town?.name || 'Salamanca',
    municipio: town?.name || 'Salamanca',
    cod_ine: town?.ine || null,
    latitud: null,
    longitud: null,
    enlace_contenido: it.link,
    source: 'usal',
    fuente: 'Universidad de Salamanca'
  }
}

let cache = { at: 0, events: [] }
let inflight = null
// Actos de hoy en adelante (y las exposiciones que siguen abiertas)
async function getEvents() {
  if (Date.now() - cache.at < TTL) return cache.events
  if (inflight) return inflight
  inflight = (async () => {
    const items = []
    for (let page = 0; page < PAGES; page++) {
      const list = parseList(await get(`${BASE}/convocatorias`, { params: { page } }))
      items.push(...list)
      if (!list.length) break
    }
    // Las de los últimos 30 días también: una exposición inaugurada hace dos semanas puede seguir abierta
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)
    const events = []
    for (const it of items.filter(i => i.fecha >= since)) {
      let d = {}
      try { d = await detail(it.link) } catch { /* sin ficha: con lo de la lista */ }
      const ev = toEvent(it, d)
      if (ev && (ev.fecha_fin || ev.fecha_inicio) >= today) events.push(ev)
    }
    cache = { at: Date.now(), events }
    return events
  })().finally(() => { inflight = null })
  return inflight
}

module.exports = { getEvents, _test: { parseList, parseDetail, toEvent, hourOf, placeOf, untilOf } }
