// Noticias de ciencia de la Universidad de Salamanca: canal RSS de la sección Ciencia de su web de comunicación
// (https://comunicacion.usal.es/ciencia → /taxonomy/term/19419/feed). Cada noticia enlaza a la original.
// 30 minutos en memoria.
const axios = require('axios')
const cheerio = require('cheerio')

const FEED = 'https://comunicacion.usal.es/taxonomy/term/19419/feed'
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; infoSalamanca-bot/1.0; +https://infosalamanca.duckdns.org)' }
const TTL = 30 * 60 * 1000

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim()

function parseFeed(xml) {
  const $ = cheerio.load(xml, { xmlMode: true })
  return $('item').map((_, it) => {
    const $it = $(it)
    // La descripción es el HTML de la noticia: imagen, título repetido y texto
    const $d = cheerio.load($it.find('description').text())
    const img = $d('img').first().attr('src') || null
    const alt = clean($d('img').first().attr('alt')) || null
    $d('.field--name-title, .field--name-field-noticia-imagen, .field__label').remove()
    // Empieza por la sección y la fecha ("Ciencia 13 Nov 2026"): sobran, la fecha va aparte
    const text = clean($d.root().text()).replace(/^Ciencia\s+\d{1,2}\s+\p{L}{3,}\.?\s+\d{4}\s*/u, '')
    const link = clean($it.find('link').first().text())
    const date = new Date($it.find('pubDate').text())
    return {
      id: link.split('/').pop(),
      titulo: clean($it.find('title').first().text()),
      resumen: text.length > 320 ? `${text.slice(0, text.lastIndexOf(' ', 320))}…` : text,
      fecha: isNaN(date) ? null : date.toISOString(),
      imagen: img ? new URL(img, 'https://comunicacion.usal.es/').href : null,
      imagenAlt: alt,
      enlace: link,
      fuente: 'Universidad de Salamanca'
    }
  }).get().filter(n => n.titulo && n.enlace)
}

let cache = { at: 0, items: [] }
async function getNews() {
  if (Date.now() - cache.at < TTL) return cache.items
  try {
    const xml = await axios.get(FEED, { timeout: 20000, headers: HEADERS, responseType: 'text' }).then(r => r.data)
    cache = { at: Date.now(), items: parseFeed(xml).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))) }
  } catch (err) {
    if (!cache.items.length) throw err
    console.warn('⚠️ Noticias de la USAL:', err.message) // se sirven las anteriores
  }
  return cache.items
}

module.exports = { getNews, _test: { parseFeed } }
