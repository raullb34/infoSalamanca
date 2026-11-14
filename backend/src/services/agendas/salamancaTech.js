// Agenda de Salamanca Tech (salamancatech.es/eventos): ciencia, tecnología e innovación.
// Su lista (WordPress) da día y mes sin año, modalidad u horario, lugar y etiquetas; el año sale de la fecha de
// publicación de cada evento en su API (wp-json/wp/v2/event), y la descripción e imagen de su ficha (og:*).
// Solo se quedan los de la provincia: la agenda incluye ferias de Madrid, Málaga, Bilbao o Miami.
// robots.txt permite /eventos/ y la API. Lista y API 1 hora en memoria; fichas, 24 horas.
const axios = require('axios')
const cheerio = require('cheerio')
const { findTown } = require('../../helpers/townIndex')

const BASE = 'https://salamancatech.es'
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; infoSalamanca-bot/1.0; +https://infosalamanca.duckdns.org)' }
const TTL = 60 * 60 * 1000
const DETAIL_TTL = 24 * 60 * 60 * 1000
const MONTHS = { ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12, dec: 12 }
// Ciudades y países de fuera que aparecen en su agenda (si el lugar no nombra Salamanca ni un pueblo de la provincia)
const ELSEWHERE = /\b(madrid|barcelona|m[aá]laga|marbella|bilbao|valencia|sevilla|valladolid|le[oó]n|zamora|[aá]vila|burgos|segovia|soria|palencia|ponferrada|bierzo|lisboa|oporto|porto|miami|ee\.?\s?uu|londres|par[ií]s|berl[ií]n|fycma)\b/i

const get = (url, opts = {}) => axios.get(url, { timeout: 25000, headers: HEADERS, ...opts }).then(r => r.data)
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim()

function parseList(html) {
  const $ = cheerio.load(html)
  const out = []
  // La página tiene dos bloques: próximos y, tras el título "Eventos pasados", los que ya fueron
  const pastAt = html.search(/<h2[^>]*>\s*Eventos pasados\s*<\/h2>/i)
  $('.event-views-row').each((_, row) => {
    const $r = $(row)
    const link = $r.find('a.title-event').attr('href')
    if (!link) return
    if (pastAt >= 0 && html.indexOf(`href="${link}"`) > pastAt) return
    const texts = $r.find('.icon-text .text').map((_, t) => clean($(t).text())).get()
    out.push({
      link,
      slug: link.replace(/\/$/, '').split('/').pop(),
      titulo: clean($r.find('a.title-event h3').text()),
      dia: Number(clean($r.find('.date .day').text())),
      mes: MONTHS[clean($r.find('.date .month').text()).toLowerCase().slice(0, 4)] || MONTHS[clean($r.find('.date .month').text()).toLowerCase().slice(0, 3)],
      // El primer texto es la modalidad o el horario ("Presencial", "9:30 - 14:30 h"); el segundo, el lugar
      horario: texts[0] || null,
      lugar: texts[1] || null,
      etiquetas: $r.find('.tags a, .tag, .categories a').map((_, t) => clean($(t).text())).get().filter(Boolean)
    })
  })
  return out
}

// Año del evento: el de su publicación, o el siguiente si la fecha ya había pasado cuando se publicó
function eventDate(dia, mes, published) {
  if (!dia || !mes) return null
  const pub = published ? new Date(published) : new Date()
  let year = pub.getFullYear()
  if (new Date(year, mes - 1, dia) < new Date(pub.getFullYear(), pub.getMonth(), pub.getDate() - 7)) year++
  return `${year}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

function inProvince(lugar) {
  const parts = String(lugar || '').split(/[,(]/).map(s => s.trim()).filter(Boolean)
  const town = findTown(parts.slice().reverse()) || (/salamanca/i.test(lugar || '') ? findTown(['Salamanca']) : null)
  if (town) return town
  if (ELSEWHERE.test(lugar || '')) return null
  return findTown(['Salamanca']) // su agenda es de Salamanca: un lugar sin ciudad ("Plaza del Oeste…") es de aquí
}

const details = new Map()
async function detail(link) {
  const hit = details.get(link)
  if (hit && Date.now() - hit.at < DETAIL_TTL) return hit.data
  const $ = cheerio.load(await get(link, { responseType: 'text' }))
  const data = {
    descripcion: clean($('meta[property="og:description"]').attr('content')) || null,
    imagen: $('meta[property="og:image"]').attr('content') || null
  }
  details.set(link, { at: Date.now(), data })
  return data
}

let cache = { at: 0, events: [] }
let inflight = null
async function getEvents() {
  if (Date.now() - cache.at < TTL) return cache.events
  if (inflight) return inflight
  inflight = (async () => {
    const [html, posts] = await Promise.all([
      get(`${BASE}/eventos/`, { responseType: 'text' }),
      get(`${BASE}/wp-json/wp/v2/event`, { params: { per_page: 50, _fields: 'slug,date' } }).catch(() => [])
    ])
    const published = new Map((Array.isArray(posts) ? posts : []).map(p => [p.slug, p.date]))
    const today = new Date().toISOString().slice(0, 10)
    const items = parseList(html)
      .map(it => {
        // Un año en el título ("Startup OLÉ Marbella 2027") manda sobre la fecha de publicación
        const y = (it.titulo.match(/\b(20\d{2})\b/) || [])[1]
        const fecha = y && it.dia && it.mes ? `${y}-${String(it.mes).padStart(2, '0')}-${String(it.dia).padStart(2, '0')}` : eventDate(it.dia, it.mes, published.get(it.slug))
        return { ...it, fecha, town: inProvince(it.lugar) }
      })
      .filter(it => it.fecha && it.fecha >= today && it.town)
    const events = []
    for (const it of items) {
      let d = {}
      try { d = await detail(it.link) } catch { /* sin ficha: se queda con lo de la lista */ }
      const hour = (String(it.horario || '').match(/(\d{1,2}:\d{2})/) || [])[1]
      events.push({
        id_evento: `tech-${it.slug}`,
        titulo: it.titulo,
        descripcion: d.descripcion,
        categoria: 'Ciencia y tecnología',
        tematica: it.etiquetas.join(', ') || null,
        fecha_inicio: it.fecha,
        fecha_fin: null,
        hora_inicio: hour ? hour.padStart(5, '0') : null,
        horario: it.horario,
        precio: null,
        imagen_evento: d.imagen,
        lugar_celebracion: it.lugar,
        nombre_localidad: it.town.name,
        municipio: it.town.name,
        cod_ine: it.town.ine,
        latitud: null,
        longitud: null,
        enlace_contenido: it.link,
        source: 'salamanca-tech',
        fuente: 'Salamanca Tech',
        ambito: 'ciencia'
      })
    }
    cache = { at: Date.now(), events }
    return events
  })().finally(() => { inflight = null })
  return inflight
}

module.exports = { getEvents, _test: { parseList, eventDate, inProvince } }
