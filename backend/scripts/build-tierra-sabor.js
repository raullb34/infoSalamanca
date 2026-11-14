#!/usr/bin/env node
// Productores Tierra de Sabor de Salamanca: dónde se venden sus productos.
// Las webs que publica la Junta están "regulares" (sin https, caídas, aparcadas, dos webs en un campo…),
// así que se visita la de cada empresa y se apunta lo que sirve para comprar:
//   - tienda online (enlace y plataforma), página de "dónde comprar / puntos de venta" (extracto),
//   - teléfono, correo, horario y redes sociales,
//   - estado de la web (ok, no responde, aparcada, bloquea robots, sin web).
// Fuentes: Junta de Castilla y León, "empresas acogidas" y "productos de la marca Tierra de Sabor" (CC BY 4.0).
// Resultado: src/data/tierra-sabor.json y, con --load, la colección tierraSabor de Mongo.
//
// Uso (desde backend/):
//   node scripts/build-tierra-sabor.js              descarga, visita las webs y genera el JSON
//   node scripts/build-tierra-sabor.js --load-only  carga el JSON en Mongo
//        (en el VPS: docker compose exec backend node scripts/build-tierra-sabor.js --load-only)
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })
const cheerio = require('cheerio')
const { safeGet } = require('../src/services/posterService')
const { findTown } = require('../src/helpers/townIndex')
const { allowedByRobots } = require('./history/robots')

const OUT = path.resolve(__dirname, '../src/data/tierra-sabor.json')
const JCYL = 'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/'
const SOURCE = { name: 'Junta de Castilla y León · Marca Tierra de Sabor', url: 'https://analisis.datosabiertos.jcyl.es/explore/dataset/empresas-acogidas-a-la-marca-tierra-de-sabor/', license: 'CC BY 4.0' }
const argv = process.argv.slice(2)
const flag = (n) => argv.includes(`--${n}`)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
// Localidades de la Junta que son pedanías o están escritas de otra forma → su municipio
const PEDANIAS = {
  'corporario': 'Aldeadávila de la Ribera',
  'villanueva de canedo': 'Topas',
  'poligono el montalvo': 'Carbajosa de la Sagrada',
  'cespedosa': 'Cespedosa de Tormes',
  'fresno alhandiga': 'Fresno Alhóndiga',
  'campillo de salvatierra': 'Guijuelo' // se agregó a Guijuelo antes de 1981
}

// Webs revisadas a mano (noviembre de 2026): mandan sobre la que publica la Junta, que a veces está caducada
const WEB_FIX = {
  24378: 'https://garrapinadasbejar.com/', // Garrapiñadas Mario Sánchez
  34785: 'https://hicarsa.com/', // Hispano Cárnicas Salmantinas
  1821: 'https://laencinacharra.com/',
  1185: 'https://www.elcotoramos.es/',
  1941: 'https://ibericosjiber.com/',
  2212: 'https://jamonesmanuelangel.com/',
  33185: 'https://www.hermanosmartinsanchez.es/',
  35869: 'https://porcisan.es/',
  2735: 'https://ibericosbrisa.com/',
  2857: 'https://www.revisan.com/',
  3081: 'https://www.simonmartin.es/es/',
  33337: 'https://www.quesoscarlosnavas.com/', // Quesos Vallellano (marca Carlos Navas)
  35754: 'https://carnicasdearriba.com/', // Jesús Sánchez de Arriba e Hijas
  30240: 'https://joalja.es/',
  41435: 'https://laspamelas.es/',
  40116: 'https://www.buenamor.net/'
}
const urlsOf = (e) => (WEB_FIX[e.idempresa] ? [WEB_FIX[e.idempresa]] : webList(e.web))

const titleCase = (s) => String(s || '').toLowerCase().replace(/(^|[\s(/-])(\S)/g, (m, a, b) => a + b.toUpperCase())
  .replace(/\b(De|Del|La|Las|Los|El|Y|E|En|S\.?l\.?|S\.?a\.?)\b/g, w => (/^s\.?[la]\.?$/i.test(w) ? w.toUpperCase() : w.toLowerCase()))
  .replace(/^./, c => c.toUpperCase())

// ---------- Datos de la Junta ----------
async function jcylAll(dataset, query) {
  const out = []
  for (let offset = 0; offset < 5000; offset += 100) {
    const { data } = await safeGet(`${JCYL}${dataset}/records?${query}&limit=100&offset=${offset}`, { responseType: 'json', timeout: 30000 })
    out.push(...(data.results || []))
    if ((data.results || []).length < 100) break
  }
  return out
}

// ---------- Webs ----------
// "www.a.es;www.b.es" → ['https://www.a.es/', 'https://www.b.es/']
function webList(raw) {
  return String(raw || '').split(/[;,\s]+/).map(w => w.trim()).filter(Boolean).map(w => {
    if (!/^https?:\/\//i.test(w)) w = 'https://' + w.replace(/^\/+/, '')
    try { return new URL(w).href } catch { return null }
  }).filter(Boolean)
}

const PARKED = /domain (is )?for sale|dominio .{0,40}(en )?venta|this domain (is|may be)|buy this domain|parked|sedo\.com|dan\.com|godaddy|hostinger|p[aá]gina en construcci[oó]n|under construction|coming soon|pr[oó]ximamente|index of \//i
const SHOP_SIGNS = [
  [/cdn\.shopify\.com|shopify\.theme/i, 'Shopify'],
  [/woocommerce|wc-ajax|add_to_cart_button/i, 'WooCommerce'],
  [/prestashop|id_product=/i, 'PrestaShop'],
  [/wix\.com.{0,200}(ecom|stores)|wixstores/i, 'Wix'],
  [/magento/i, 'Magento']
]
const SHOP_LINK = /^(tienda( online)?|shop|store|comprar|compra online|tienda virtual|venta online|e-?shop)$/i
const WHERE_LINK = /d[oó]nde (comprar|encontrar(nos|los)?)|puntos? de venta|distribuidores|nuestras tiendas|tiendas? f[ií]sicas?/i
// Pruebas de que de verdad se vende en la web (no basta con tener instalado WooCommerce)
const CART = /add_to_cart|añadir al carrito|anadir al carrito|add to cart|\/carrito|\/cart\b|\/cesta|comprar ahora|data-product_id|product-price|woocommerce-Price-amount|cart-contents/i
const CONTACT_LINK = /contact|d[oó]nde estamos|localiz|ubicaci/i

async function fetchPage(url) {
  if (!(await allowedByRobots(url))) return { blocked: 'robots' }
  try {
    const { data, headers, url: finalUrl } = await safeGet(url, { timeout: 15000, maxBytes: 4 * 1024 * 1024 })
    if (!/html/.test(String(headers['content-type'] || ''))) return null
    const html = String(data)
    return { html, $: cheerio.load(html), url: finalUrl }
  } catch (err) {
    const status = err.response?.status
    return { error: status === 403 || status === 429 ? 'bloquea robots' : status ? `HTTP ${status}` : err.code || err.message }
  } finally {
    await sleep(500)
  }
}

const sameSite = (a, b) => {
  const h = (u) => new URL(u).hostname.replace(/^www\./, '')
  try { return h(a) === h(b) || h(a).endsWith('.' + h(b)) || h(b).endsWith('.' + h(a)) } catch { return false }
}
const textOf = ($, el) => $(el).text().replace(/\s+/g, ' ').trim()

function linksOf(page) {
  const out = []
  page.$('a[href]').each((_, a) => {
    const href = page.$(a).attr('href')
    if (!href || /^(#|javascript:)/i.test(href)) return
    try { out.push({ text: textOf(page.$, a), href: new URL(href, page.url).href }) } catch { /* enlace roto */ }
  })
  return out
}

// Teléfono español (fijo o móvil) y correo; primero los enlaces tel:/mailto:
function contactsOf(page) {
  const tel = page.$('a[href^="tel:"]').first().attr('href')
  const mail = page.$('a[href^="mailto:"]').first().attr('href')
  const text = page.$('body').text().replace(/\s+/g, ' ')
  // Solo teléfonos españoles de 9 cifras (con o sin +34), separados como se escriben
  const phoneRe = /(?<![\d.])(?:\+34[\s.]?)?[6789]\d{2}(?:[\s.]\d{2,3}){2,3}(?![\d.])|(?<![\d.])(?:\+34[\s.]?)?[6789]\d{8}(?![\d.])/
  const raw = (tel ? tel.replace(/^tel:/i, '') : (text.match(phoneRe) || [])[0] || '').replace(/[^\d+]/g, '').replace(/^(\+34|0034)/, '')
  const phone = /^[6789]\d{8}$/.test(raw) ? raw : ''
  const email = mail ? mail.replace(/^mailto:/i, '').split('?')[0] : (text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0]
  const hours = (text.match(/horario[^.]{5,140}/i) || [])[0]
  return {
    telefono: phone ? `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}` : null,
    email: email && !/\.(png|jpe?g|gif|webp)$/i.test(email) ? email.toLowerCase() : null,
    horario: hours ? hours.trim().replace(/\s+/g, ' ') : null
  }
}

function socialsOf(html) {
  const found = new Map()
  for (const m of html.matchAll(/https?:\/\/(?:www\.|es-es\.)?(instagram|facebook|tiktok|youtube|x|twitter)\.com\/(?!sharer|share|intent|plugins|tr\?|dialog)[A-Za-z0-9_.\-/]+/gi)) {
    const net = m[1].toLowerCase() === 'twitter' ? 'x' : m[1].toLowerCase()
    if (!found.has(net)) found.set(net, m[0].replace(/\/+$/, ''))
  }
  return Object.fromEntries(found)
}

// Extracto de la página de puntos de venta: las líneas con aspecto de tienda o localidad
function whereExcerpt(page) {
  page.$('script, style, nav, header, footer, form, noscript').remove()
  const lines = page.$('main, article, .content, #content, .entry-content, body').first().find('li, p, h3, h4, td')
    .map((_, el) => textOf(page.$, el)).get()
    .filter(t => t.length > 3 && t.length < 160)
  const unique = [...new Set(lines)].slice(0, 40)
  const text = unique.join(' · ')
  return text.length > 700 ? text.slice(0, text.lastIndexOf(' · ', 700)) + ' …' : text
}

async function inspectWeb(urls) {
  const result = { estado: 'sin web', url: null, final: null, online: null, dondeComprar: null, telefono: null, email: null, horario: null, redes: {} }
  for (const url of urls) {
    let home = await fetchPage(url)
    if (home?.error && url.startsWith('https://')) home = await fetchPage(url.replace('https://', 'http://'))
    if (home?.blocked) { Object.assign(result, { estado: 'bloquea robots', url }); continue }
    if (!home || home.error) { Object.assign(result, { estado: home?.error === 'bloquea robots' ? 'bloquea robots' : 'no responde', url }); continue }
    const bodyText = home.$('body').text().replace(/\s+/g, ' ')
    if (PARKED.test(bodyText.slice(0, 4000)) || bodyText.length < 150) { Object.assign(result, { estado: 'aparcada', url, final: home.url }); continue }

    Object.assign(result, { estado: 'ok', url, final: home.url, redes: socialsOf(home.html), ...contactsOf(home) })
    const links = linksOf(home)
    // Tienda online: enlace "Tienda"/"Shop" del propio sitio, o una plataforma de comercio en la portada
    const shopLink = links.find(l => SHOP_LINK.test(l.text) || /\/(tienda|shop|store|comprar|productos?-online)(\/|$)/i.test(new URL(l.href).pathname) || /^(tienda|shop)\./i.test(new URL(l.href).hostname))
    const platform = CART.test(home.html) ? SHOP_SIGNS.find(([re]) => re.test(home.html))?.[1] || null : null
    if (shopLink || platform) result.online = { url: shopLink?.href || home.url, plataforma: platform }
    // Dónde comprar / puntos de venta
    // Fuera las noticias y las páginas para hacerse distribuidor
    const where = links.find(l => WHERE_LINK.test(l.text) && sameSite(l.href, home.url) &&
      !/ser punto|hazte|quieres ser|trabaja con|nuevos? distribuidor/i.test(l.text) && !/\/(noticias?|blog|news)\//i.test(l.href))
    if (where) {
      const page = await fetchPage(where.href)
      if (page?.$) {
        result.dondeComprar = { url: page.url, titulo: where.text.slice(0, 80), extracto: whereExcerpt(page) }
        const c = contactsOf(page)
        result.telefono = result.telefono || c.telefono
      }
    }
    // Contacto: teléfono, correo y horario si faltan
    if (!result.telefono || !result.email) {
      const contact = links.find(l => CONTACT_LINK.test(`${l.text} ${l.href}`) && sameSite(l.href, home.url))
      if (contact) {
        const page = await fetchPage(contact.href)
        if (page?.$) {
          const c = contactsOf(page)
          result.telefono = result.telefono || c.telefono
          result.email = result.email || c.email
          result.horario = result.horario || c.horario
        }
      }
    }
    break // la primera web que funciona
  }
  return result
}

async function mapLimit(items, n, fn) {
  const queue = [...items]
  await Promise.all(Array.from({ length: n }, async () => { while (queue.length) await fn(queue.shift()) }))
}

async function build() {
  console.log('🧀 Empresas y productos Tierra de Sabor de Salamanca…')
  const empresas = await jcylAll('empresas-acogidas-a-la-marca-tierra-de-sabor', 'refine=provincia%3ASALAMANCA')
  const productos = []
  const ids = empresas.map(e => e.idempresa)
  for (let i = 0; i < ids.length; i += 40) {
    productos.push(...await jcylAll('productos-de-la-marca-tierra-de-sabor', `where=${encodeURIComponent(`idempresa in (${ids.slice(i, i + 40).join(',')})`)}`))
  }
  console.log(`   ${empresas.length} empresas, ${productos.length} productos. Visitando sus webs…`)

  const out = []
  let done = 0
  await mapLimit(empresas, 5, async (e) => {
    const urls = urlsOf(e)
    const web = urls.length ? await inspectWeb(urls) : { estado: 'sin web', redes: {} }
    const town = findTown([PEDANIAS[plain(e.localidad)] || e.localidad], e.c_p)
    const prods = productos.filter(p => p.idempresa === e.idempresa)
    out.push({
      idempresa: e.idempresa,
      nombre: titleCase(e.nombre_comercial),
      direccion: titleCase(e.direccion),
      cp: e.c_p,
      localidad: town?.name || titleCase(e.localidad),
      cod_ine: town?.ine || null,
      heart_of_spain: e.heart_of_spain === 'AUTORIZADO',
      web: { original: e.web || null, url: web.url || null, final: web.final || null, estado: web.estado },
      venta: {
        online: web.online || null,
        dondeComprar: web.dondeComprar || null,
        telefono: web.telefono || null,
        email: web.email || null,
        horario: web.horario || null,
        redes: web.redes || {}
      },
      secciones: [...new Set(prods.map(p => p.seccion).filter(Boolean))],
      productos: prods.map(p => ({ id: p.idproducto, nombre: titleCase(p.producto), marca: p.marca ? titleCase(p.marca) : null, seccion: p.seccion, categoria: p.categoria, variedad: p.variedad, calidad: p.figurascalidad || null })),
      revisado: null,
      checked_at: new Date().toISOString()
    })
    if (++done % 20 === 0) console.log(`   ${done}/${empresas.length}`)
  })
  out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), source: SOURCE, empresas: out }, null, 1) + '\n')
  const count = (f) => out.filter(f).length
  console.log(`✅ tierra-sabor.json: ${out.length} empresas`)
  console.log(`   web ok ${count(e => e.web.estado === 'ok')} · no responde ${count(e => e.web.estado === 'no responde')} · aparcada ${count(e => e.web.estado === 'aparcada')} · bloquea robots ${count(e => e.web.estado === 'bloquea robots')} · sin web ${count(e => e.web.estado === 'sin web')}`)
  console.log(`   tienda online ${count(e => e.venta.online)} · dónde comprar ${count(e => e.venta.dondeComprar)} · teléfono ${count(e => e.venta.telefono)} · correo ${count(e => e.venta.email)} · redes ${count(e => Object.keys(e.venta.redes).length)}`)
}

// --solo=1185,2735: vuelve a mirar solo esas webs (p. ej. tras corregir WEB_FIX) y actualiza el JSON
async function only(ids) {
  const data = JSON.parse(fs.readFileSync(OUT, 'utf8'))
  for (const e of data.empresas.filter(x => ids.includes(x.idempresa))) {
    const urls = urlsOf({ idempresa: e.idempresa, web: e.web.original })
    const web = urls.length ? await inspectWeb(urls) : { estado: 'sin web', redes: {} }
    e.web = { original: e.web.original, url: web.url || null, final: web.final || null, estado: web.estado }
    e.venta = { online: web.online || null, dondeComprar: web.dondeComprar || null, telefono: web.telefono || null, email: web.email || null, horario: web.horario || null, redes: web.redes || {} }
    e.checked_at = new Date().toISOString()
    console.log(`   ${e.nombre}: ${web.estado}${web.online ? ' · tienda' : ''}${web.telefono ? ' · tel' : ''}`)
  }
  fs.writeFileSync(OUT, `${JSON.stringify(data, null, 1)}\n`)
}

async function load() {
  const mongoose = require('mongoose')
  const TierraSabor = require('../src/models/tierraSabor')
  if (!process.env.MONGODB_URI) throw new Error('Falta MONGODB_URI')
  const { empresas } = JSON.parse(fs.readFileSync(OUT, 'utf8'))
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  // Lo revisado a mano en la base de datos no se pisa
  const reviewed = new Map((await TierraSabor.find({ revisado: { $ne: null } }).lean()).map(d => [d.idempresa, d]))
  const ops = empresas.map(e => {
    const r = reviewed.get(e.idempresa)
    const doc = r ? { ...e, venta: r.venta, revisado: r.revisado } : e
    return { replaceOne: { filter: { idempresa: e.idempresa }, replacement: { ...doc, updated_at: new Date() }, upsert: true } }
  })
  const res = await TierraSabor.bulkWrite(ops)
  // Los que la Junta ya no tiene en el registro de la marca (p. ej. Pepiño en noviembre de 2026) se quitan
  const gone = await TierraSabor.deleteMany({ idempresa: { $nin: empresas.map(e => e.idempresa) } })
  console.log(`✅ Mongo tierraSabor: ${res.upsertedCount} nuevas, ${res.modifiedCount} actualizadas, ${gone.deletedCount} quitadas (ya no están en la marca), ${reviewed.size} revisadas a mano respetadas`)
  await mongoose.disconnect()
}

;(async () => {
  const solo = (argv.find(a => a.startsWith('--solo=')) || '').slice(7).split(',').map(Number).filter(Boolean)
  if (solo.length) await only(solo)
  else if (!flag('load-only')) await build()
  if (flag('load') || flag('load-only')) await load()
})().catch(e => { console.error('❌', e.message); process.exit(1) })

