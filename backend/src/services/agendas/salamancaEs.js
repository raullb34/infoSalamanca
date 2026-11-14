// Agenda de Turismo de Salamanca (salamanca.es/agenda) y del Salamanca Convention Bureau
// (salamanca.es/convention-bureau/agenda). Su robots.txt lo permite todo.
// La lista de la web carga más eventos con un botón (Livewire), pero el sitemap.xml trae todas las fichas
// vigentes; cada ficha lleva un Event de schema.org en JSON-LD (fechas, lugar con coordenadas, precio, imagen).
// El sitemap se lee cada hora y cada ficha se guarda 24 horas: en un día normal se piden solo las nuevas.
const axios = require('axios')
const cheerio = require('cheerio')
const { findTown } = require('../../helpers/townIndex')
const { classify } = require('./classify')

const SITEMAP = 'https://salamanca.es/sitemap.xml'
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; infoSalamanca-bot/1.0; +https://infosalamanca.duckdns.org)' }
const SITEMAP_TTL = 60 * 60 * 1000
const DETAIL_TTL = 24 * 60 * 60 * 1000

const get = (url) => axios.get(url, { timeout: 25000, headers: HEADERS, responseType: 'text' }).then(r => r.data)

// Fichas en español de la agenda y del Convention Bureau (las demás lenguas llevan /en/, /fr/…)
function eventUrls(xml) {
  const urls = [...String(xml).matchAll(/<loc>(https:\/\/salamanca\.es\/(?:convention-bureau\/)?agenda\/eventos\/[^<]+)<\/loc>/g)].map(m => m[1].trim())
  return [...new Set(urls)]
}

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim()
// "20.00 h", "19:30 h", "a las 18 h"
const hourIn = (text) => {
  const m = String(text || '').match(/(\d{1,2})[.:](\d{2})\s*h/i) || String(text || '').match(/a las (\d{1,2})\s*h/i)
  return m ? `${m[1].padStart(2, '0')}:${m[2] || '00'}` : null
}
const isoDay = (d) => (String(d || '').match(/^\d{4}-\d{2}-\d{2}/) || [])[0] || null

// Ficha → evento con la forma de la agenda de la Junta (titulo, fecha_inicio, lugar_celebracion…)
function parseEvent(html, url) {
  const $ = cheerio.load(html)
  let ev = null
  $('script[type="application/ld+json"]').each((_, s) => {
    try {
      const j = JSON.parse($(s).contents().text())
      const nodes = j['@graph'] || [j]
      ev = ev || nodes.find(n => n['@type'] === 'Event')
    } catch { /* JSON-LD roto: se ignora */ }
  })
  if (!ev || !ev.startDate) return null
  const place = ev.location || {}
  const addr = place.address || {}
  const long = clean($('#hiddenContent').text())
  const summary = clean(ev.description)
  const locality = clean(addr.addressLocality) || 'Salamanca'
  const town = findTown([locality]) || findTown(['Salamanca'])
  const convention = url.includes('/convention-bureau/')
  const offer = Array.isArray(ev.offers) ? ev.offers[0] : ev.offers
  const free = ev.isAccessibleForFree === true || /gratu|entrada libre/i.test(summary)
  const price = free ? 'Gratuito' : offer?.price && Number(offer.price) > 0 ? `${Number(offer.price).toLocaleString('es-ES')} €` : (summary.match(/Precio:\s*([^.]+)/i) || [])[1] || null
  const base = {
    id_evento: `${convention ? 'scb' : 'tds'}-${url.split('/').pop()}`,
    titulo: clean(ev.name),
    descripcion: [summary, long && !long.startsWith(summary.slice(0, 40)) ? long : null].filter(Boolean).join(' ').slice(0, 1500) || null,
    fecha_inicio: isoDay(ev.startDate),
    fecha_fin: isoDay(ev.endDate) && isoDay(ev.endDate) !== isoDay(ev.startDate) ? isoDay(ev.endDate) : null,
    hora_inicio: (String(ev.startDate).match(/T(\d{2}:\d{2})/) || [])[1] || hourIn(summary),
    precio: price,
    imagen_evento: ev.image ? String(Array.isArray(ev.image) ? ev.image[0] : ev.image).replace(/^http:/, 'https:') : null,
    lugar_celebracion: clean(place.name) || null,
    calle: clean(addr.streetAddress) || null,
    nombre_localidad: town?.name || locality,
    municipio: town?.name || locality,
    cod_ine: town?.ine || null,
    latitud: Number(place.geo?.latitude) || null,
    longitud: Number(place.geo?.longitude) || null,
    enlace_contenido: url,
    source: convention ? 'convention-bureau' : 'turismo-salamanca',
    fuente: convention ? 'Salamanca Convention Bureau' : 'Turismo de Salamanca'
  }
  const kind = classify(base, { congresses: convention })
  // El horario de una exposición ("hasta las 21 h") no es la hora de un acto
  if (kind.categoria === 'Exposiciones' && base.fecha_fin) base.hora_inicio = null
  return { ...base, ...kind }
}

const details = new Map() // url → { at, data }
let index = { at: 0, urls: [] }

async function detail(url) {
  const hit = details.get(url)
  // Los que ya han pasado no cambian: no se vuelven a pedir
  if (hit && (Date.now() - hit.at < DETAIL_TTL || (hit.data && (hit.data.fecha_fin || hit.data.fecha_inicio) < today()))) return hit.data
  const data = parseEvent(await get(url), url)
  details.set(url, { at: Date.now(), data })
  return data
}
const today = () => new Date().toISOString().slice(0, 10)

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

let inflight = null
// Todos los eventos vigentes (de hoy en adelante, o que siguen abiertos)
async function getEvents() {
  if (inflight) return inflight
  inflight = (async () => {
    if (Date.now() - index.at > SITEMAP_TTL) {
      try {
        index = { at: Date.now(), urls: eventUrls(await get(SITEMAP)) }
      } catch (err) {
        if (!index.urls.length) throw err
        console.warn('⚠️ Sitemap de salamanca.es:', err.message) // se sigue con el anterior
      }
    }
    const events = (await mapLimit(index.urls, 3, detail)).filter(Boolean)
    return events.filter(e => (e.fecha_fin || e.fecha_inicio) >= today())
  })().finally(() => { inflight = null })
  return inflight
}

module.exports = { getEvents, _test: { eventUrls, parseEvent, hourIn } }
