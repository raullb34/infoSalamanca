// Lectura de los RSS de la prensa local → noticias { id, medio, titulo, enlace, fecha, resumen, texto, imagen,
// categorias }. El texto (para decidir de qué pueblo es y si anuncia algo) no se publica: la web solo enseña el
// título, el medio, la fecha y el enlace.
const axios = require('axios')
const cheerio = require('cheerio')
const crypto = require('crypto')

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; infoSalamanca-bot/1.0; +https://infosalamanca.duckdns.org)', Accept: 'application/rss+xml, application/xml, text/xml' }

const stripHtml = (h) => String(h || '')
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<br\s*\/?>|<\/p>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/[ \t]+/g, ' ').replace(/\n\s*/g, '\n').trim()

const idOf = (link) => crypto.createHash('sha1').update(String(link)).digest('hex').slice(0, 16)

// La primera imagen: media:content / enclosure, o la primera <img> del contenido
function imageOf($item, html) {
  const media = $item.children('media\\:content, media\\:thumbnail, enclosure').filter((_, el) => /image|jpe?g|png|webp/i.test(`${el.attribs?.type || ''} ${el.attribs?.url || ''} ${el.attribs?.medium || ''}`)).first().attr('url')
  if (media) return media
  const m = String(html || '').match(/<img[^>]+src=["']([^"']+)["']/i)
  return m ? m[1] : null
}

function parseFeed(xml, feed) {
  const $ = cheerio.load(xml, { xmlMode: true })
  const out = []
  $('item').each((_, el) => {
    const $i = $(el)
    const enlace = $i.children('link').first().text().trim() || $i.children('guid').first().text().trim()
    const titulo = stripHtml($i.children('title').first().text())
    if (!enlace || !titulo) return
    const descHtml = $i.children('description').first().text()
    const contentHtml = $i.children('content\\:encoded').first().text()
    const fecha = new Date($i.children('pubDate').first().text() || $i.children('dc\\:date').first().text())
    const resumen = stripHtml(descHtml).slice(0, 600)
    out.push({
      id: idOf(enlace),
      medio: feed.nombre,
      medio_id: feed.id,
      comarcal: feed.comarcal || null,
      titulo,
      enlace,
      fecha: isNaN(fecha) ? new Date().toISOString() : fecha.toISOString(),
      resumen,
      // Para analizarla: el contenido si lo trae; si no, la descripción (algunos medios meten ahí la noticia entera)
      texto: stripHtml(contentHtml || descHtml).slice(0, 4000),
      imagen: imageOf($i, contentHtml || descHtml),
      categorias: $i.children('category').map((_, c) => $(c).text().trim()).get().filter(Boolean)
    })
  })
  return out
}

async function readFeed(feed) {
  const { data } = await axios.get(feed.url, { headers: HEADERS, timeout: 25000, responseType: 'text' })
  return parseFeed(data, feed)
}

module.exports = { readFeed, parseFeed, stripHtml }
