// Fuentes de la historia de los pueblos (las usa build-town-history.js):
//  - wikipedia(): artículos ya descargados en src/SaLLMantino/ragger/script/municipios_md (CC BY-SA 4.0)
//  - jcylMonuments(): "Relación de monumentos" de datos abiertos de la Junta de Castilla y León (CC BY 4.0)
//  - diputacionWebs(): web oficial de cada ayuntamiento según la Diputación de Salamanca (lasalina.es)
//  - ayuntamientoHistory(): la página "Historia" de la web de cada ayuntamiento (solo extracto + enlace)
const fs = require('fs')
const path = require('path')
const cheerio = require('cheerio')
const { safeGet, USER_AGENT } = require('../../src/services/posterService')
const { findTown } = require('../../src/helpers/townIndex')
const { allowedByRobots } = require('./robots')
const { paragraphs, section, intro } = require('./wikitext')

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// ---------- Wikipedia ----------
const WIKI_DIR = path.resolve(__dirname, '../../src/SaLLMantino/ragger/script/municipios_md')
const ineByName = new Map(require('../../src/helpers/ine-codigopostal.json').map(x => [normalize(x.Municipio), String(x.CodMunicipio)]))

// Fuera las líneas de bibliografía o de presentación de una cita que se cuelan en la Historia
// ("Diccionario geográfico de España. 1960. Ediciones…", "En el diccionario de Miñano se indica lo siguiente:")
const isProse = (p) => p.length >= 100 && !/:\s*$/.test(p) && !/\bISBN\b|\bEdiciones\b|\bEditorial\b|\bpp?\.\s?\d/.test(p)

function wikipedia() {
  const out = {}
  for (const file of fs.readdirSync(WIKI_DIR).filter(f => f.endsWith('.md')).sort()) {
    const md = fs.readFileSync(path.join(WIKI_DIR, file), 'utf8')
    const cod = md.match(/\|\s*cod_municipio\s*=\s*(\d{1,3})/)
    if (!cod) continue
    const name = (md.match(/^#\s+(.+)$/m)?.[1] || file.replace(/\.md$/, '').replace(/_/g, ' ')).trim()
    const ine = ineByName.get(normalize(name)) || '37' + cod[1].padStart(3, '0')
    const hab = md.match(/\*\*Población:\*\*\s*(\d+)/)?.[1]
    const ctx = { poblacion: hab ? `${Number(hab).toLocaleString('es-ES')} habitantes` : '' }
    out[ine] = {
      name,
      summary: intro(md, ctx),
      history: paragraphs(section(md, 'Historia'), ctx).filter(isProse),
      heritage: paragraphs(section(md, 'Patrimonio|Monumentos|Monumentos y lugares de inter[eé]s|Lugares de inter[eé]s|Patrimonio hist[oó]rico(?:-art[ií]stico)?|Cultura'), ctx),
      url: `https://es.wikipedia.org/wiki/${encodeURIComponent(file.replace(/\.md$/, ''))}`
    }
  }
  return out
}

// ---------- Monumentos de la Junta ----------
const JCYL_URL = 'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/relacion-monumentos/records'
const JCYL_PAGE = 'https://analisis.datosabiertos.jcyl.es/explore/dataset/relacion-monumentos/'

const htmlToText = (html) => cheerio.load(`<div>${html || ''}</div>`)('div').text().replace(/\s+/g, ' ').trim()

async function jcylMonuments() {
  const all = []
  for (let offset = 0; offset < 2000; offset += 100) {
    const url = `${JCYL_URL}?limit=100&offset=${offset}&where=${encodeURIComponent('poblacion_provincia="Salamanca"')}`
    const { data } = await safeGet(url, { responseType: 'json', timeout: 30000 })
    all.push(...(data.results || []))
    if ((data.results || []).length < 100) break
  }
  const byIne = {}
  for (const r of all) {
    const town = findTown([r.poblacion_municipio, r.poblacion_localidad])
    if (!town) continue
    const description = htmlToText(r.descripcion)
    ;(byIne[town.ine] = byIne[town.ine] || []).push({
      name: r.nombre,
      type: r.tipomonumento || r.clasificacion || null,
      periods: [].concat(r.periodohistorico || []),
      locality: r.poblacion_localidad || null,
      description,
      lat: r.pto_geolocalizado?.lat ?? null,
      lon: r.pto_geolocalizado?.lon ?? null,
      bic: r.identificadorbieninterescultural || null,
      source: 'jcyl',
      url: JCYL_PAGE
    })
  }
  return { byIne, total: all.length }
}

// ---------- Directorio de la Diputación (web de cada ayuntamiento) ----------
const DIPUTACION_URL = 'https://www.lasalina.es/Aplicaciones/GestorInter.jsp'

async function diputacionWebs(ines, { cacheFile, refresh = false, log = () => {} } = {}) {
  let cache = {}
  if (cacheFile && fs.existsSync(cacheFile)) cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
  for (const ine of ines) {
    if (cache[ine] && !refresh) continue
    try {
      const res = await fetch(DIPUTACION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: `prestacion=Cipublico&funcion=MuestraInformacionMunicipio&codMunicipio=${Number(ine) - 37000}`
      })
      const $ = cheerio.load(Buffer.from(await res.arrayBuffer()).toString('latin1'))
      const cell = (label) => {
        const td = $('td').filter((_, el) => $(el).text().trim().toLowerCase() === label).first()
        return td.next('td').text().trim() || null
      }
      const web = cell('web')
      const sede = cell('sede electrónica') || cell('sede electr\u00f3nica')
      cache[ine] = { web: /^https?:\/\//i.test(web || '') ? web : null, sede: /^https?:\/\//i.test(sede || '') ? sede : null }
    } catch (e) {
      log(`  ⚠️ Diputación ${ine}: ${e.message}`)
    }
    await sleep(400)
  }
  if (cacheFile) fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 1) + '\n')
  return cache
}

// ---------- Página "Historia" de la web del ayuntamiento ----------
const HISTORY_LINK = /\bhistoria\b|\bhist[oó]rico\b|nuestro pueblo|conoce .*(pueblo|municipio|villa)|el municipio/i

async function fetchHtml(url) {
  if (!(await allowedByRobots(url))) return null
  try {
    const { data, headers, url: finalUrl } = await safeGet(url, { timeout: 15000, maxBytes: 3 * 1024 * 1024 })
    if (!/html/.test(String(headers['content-type'] || ''))) return null
    return { $: cheerio.load(String(data)), url: finalUrl }
  } catch {
    return null
  } finally {
    await sleep(700) // cortesía con webs pequeñas
  }
}

const sameSite = (a, b) => new URL(a).hostname.replace(/^www\./, '') === new URL(b).hostname.replace(/^www\./, '')

// Texto principal de una página: los párrafos largos, fuera de cabecera, menú y pie
function mainText($) {
  $('script, style, nav, header, footer, aside, form, noscript').remove()
  const root = $('main, article, #content, .content, #contenido, .contenido, .entry-content').first()
  const scope = root.length ? root : $('body')
  // Solo párrafos con frases (los menús no tienen puntos)
  return scope.find('p')
    .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter(t => t.length > 80 && /[.;:]/.test(t) && t.split(/\s+/).length > 12)
}

// Enlaces de una página que pueden llevar a la historia del pueblo
const HUB_LINK = /turismo|municipio|conoce|nuestro pueblo|la villa|la ciudad|el pueblo|patrimonio|cultura/i
function linksIn(page, test) {
  const out = []
  page.$('a[href]').each((_, a) => {
    const text = page.$(a).text().replace(/\s+/g, ' ').trim()
    const href = page.$(a).attr('href')
    if (!test(`${text} ${href}`)) return
    try {
      const u = new URL(href, page.url)
      if (!/^https?:$/.test(u.protocol) || !sameSite(u.href, page.url) || /\.(pdf|jpe?g|png|docx?)$/i.test(u.pathname)) return
      out.push({ url: u.href.split('#')[0], score: /^historia\b/i.test(text) ? 3 : /historia/i.test(text + href) ? 2 : 1 })
    } catch { /* enlace roto */ }
  })
  return out
}

// URLs del mapa del sitio que hablan de historia (muchas webs municipales son WordPress)
async function sitemapHistoryUrls(origin) {
  const found = []
  for (const sm of ['/sitemap.xml', '/wp-sitemap.xml']) {
    const url = origin + sm
    if (!(await allowedByRobots(url))) continue
    try {
      const { data } = await safeGet(url, { timeout: 12000, maxBytes: 2 * 1024 * 1024 })
      const locs = [...String(data).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim())
      found.push(...locs.filter(l => /histori/i.test(l) && !/\.xml$/i.test(l)))
      // Índice de mapas: mirar solo los de páginas
      for (const child of locs.filter(l => /\.xml$/i.test(l) && /page|pagina/i.test(l)).slice(0, 2)) {
        const { data: d2 } = await safeGet(child, { timeout: 12000, maxBytes: 2 * 1024 * 1024 })
        found.push(...[...String(d2).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim()).filter(l => /histori/i.test(l)))
      }
      if (found.length) break
    } catch { /* sin mapa del sitio */ }
    await sleep(500)
  }
  return [...new Set(found)].map(url => ({ url, score: 3 }))
}

async function readHistoryPage(url, townName) {
  const page = await fetchHtml(url)
  if (!page) return null
  const title = page.$('h1').first().text().replace(/\s+/g, ' ').trim() || page.$('title').first().text().trim()
  const paras = mainText(page.$)
  const text = paras.join(' ')
  // Tiene que ser un texto de historia de verdad (no una noticia o un menú) y hablar de este pueblo
  if (text.length < 400 || !/\b(siglo|historia|fund|repobla|romano|medieval|edad media|\d{3,4})/i.test(text)) return null
  if (townName && !normalize(text).includes(normalize(townName).split(' ').slice(-1)[0])) return null
  return { url: page.url, title, paragraphs: paras.slice(0, 30) }
}

const rank = (links) => {
  const seen = new Set()
  return links.sort((a, b) => b.score - a.score).filter(l => !seen.has(l.url) && seen.add(l.url))
}

async function ayuntamientoHistory(web, townName) {
  const home = await fetchHtml(web)
  if (!home) return null
  const origin = new URL(home.url).origin
  // 1. Enlaces de la portada; 2. mapa del sitio; 3. un salto más por turismo, municipio, patrimonio...
  let candidates = rank(linksIn(home, t => HISTORY_LINK.test(t))).slice(0, 2)
  if (!candidates.some(c => c.score >= 2)) candidates = rank([...candidates, ...(await sitemapHistoryUrls(origin))]).slice(0, 3)
  for (const c of candidates) {
    const found = await readHistoryPage(c.url, townName)
    if (found) return found
  }
  for (const hub of rank(linksIn(home, t => HUB_LINK.test(t))).slice(0, 2)) {
    const page = await fetchHtml(hub.url)
    if (!page) continue
    for (const c of rank(linksIn(page, t => /historia/i.test(t))).slice(0, 2)) {
      const found = await readHistoryPage(c.url, townName)
      if (found) return found
    }
  }
  return null
}

module.exports = { wikipedia, jcylMonuments, diputacionWebs, ayuntamientoHistory, JCYL_PAGE }
