#!/usr/bin/env node
// Busca carteles de fiestas y los guarda como candidatos pendientes de revisión
// (se aprueban o rechazan en /admin/carteles.html). Nunca publica nada directamente.
//
// Fuentes:
//   1. Web del ayuntamiento (la que hay en municipalInfo): portada y hasta 6 páginas enlazadas que hablen
//      de fiestas, cartel o programa. Respeta robots.txt.
//   2. Buscador (si hay BRAVE_API_KEY): resultados de la web y de Facebook/Instagram. De las redes sociales
//      solo se guarda el enlace: no se entra en Facebook (lo prohíben sus normas y exige sesión).
//
// Uso (en el VPS):
//   docker compose exec backend node scripts/find-posters.js               pueblos con fiestas en los próximos 45 días
//   docker compose exec backend node scripts/find-posters.js --days 90
//   docker compose exec backend node scripts/find-posters.js --ine 37290   un pueblo
//   docker compose exec backend node scripts/find-posters.js --all --no-search
//   ... --dry-run  muestra lo que encontraría sin guardar nada
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const cheerio = require('cheerio');
const MunicipalInfo = require('../src/models/municipalInfo');
const posters = require('../src/services/posterService');

// ---------- Opciones ----------
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const option = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const OPTS = {
  days: Number(option('days', 45)),
  ine: option('ine', null),
  all: flag('all'),
  dryRun: flag('dry-run'),
  web: !flag('no-web'),
  search: !flag('no-search') && !!process.env.BRAVE_API_KEY,
  limit: Number(option('limit', 400))
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// Web oficial de cada ayuntamiento según la Diputación (scripts/build-town-history.js), por si falta en la base
const DIPUTACION_WEBS = (() => {
  try { return require('../src/data/ayuntamientos-web.json'); } catch { return {}; }
})();
const plain = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------- Fechas: próximo día de fiesta y su año ----------
function nextFestival(dates, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let best = null;
  for (const mmdd of [dates?.start_date, dates?.end_date]) {
    const [m, d] = String(mmdd || '').split('-').map(Number);
    if (!m || !d) continue;
    let date = new Date(today.getFullYear(), m - 1, d);
    if (date < today) date = new Date(today.getFullYear() + 1, m - 1, d);
    const days = Math.round((date - today) / 86400000);
    if (!best || days < best.days) best = { days, year: date.getFullYear() };
  }
  return best;
}

// ---------- Puntuación: cuánto parece un cartel de las fiestas de ese pueblo ----------
// Nombre sin artículo final ni inicial: "Martín de Yeltes", "Alberca" (de "La Alberca")
const nameKey = (name) => plain(name).replace(/^(la|el|los|las)\s+/, '').replace(/,\s*(la|el|los|las)$/, '').trim();

const FEST_WORDS = /cartel|fiesta|programa|patronal|ferias?\b|vendimia|romeria|toros|encierro/;
const NOT_POSTER = /cartelera|cine\b|pleno|curso|universidad|deport|gravatar|avatar|logo|icono|icon\b|escudo|bandera|banner-cookie|whatsapp|facebook-|twitter|instagram-/;

// Años que aparecen en el texto (2000-2099)
const yearsIn = (text) => [...String(text).matchAll(/(?:^|\D)(20\d\d)(?!\d)/g)].map(m => Number(m[1]));

// Puntuación de un texto (título, alt, nombre de fichero...). year = año de las próximas fiestas.
// Devuelve { score, year } o null si claramente no es un cartel de estas fiestas.
function score(text, town, year) {
  const t = plain(text);
  if (NOT_POSTER.test(t)) return null;
  const years = yearsIn(t);
  // Un año viejo (anterior al de las últimas fiestas) descarta el candidato
  if (years.length && years.every(y => y < year - 1)) return null;
  let s = 0;
  if (/cartel/.test(t)) s += 3;
  if (/fiesta/.test(t)) s += 2;
  if (/programa/.test(t)) s += 2;
  if (/patronal|vendimia|feria|romeria|virgen|san |santa |santo |cristo|toros|encierro/.test(t)) s += 1;
  const match = years.find(y => y === year) || years.find(y => y === year - 1);
  if (match) s += 3;
  if (town && t.includes(nameKey(town))) s += 2;
  return { score: s, year: match || year };
}
const MIN_SCORE = 5;

// ---------- robots.txt (versión sencilla: bloques User-agent: * y el nuestro) ----------
const robotsCache = new Map();
async function allowedByRobots(url) {
  const u = new URL(url);
  if (!robotsCache.has(u.origin)) {
    let rules = [];
    try {
      const { data } = await posters.safeGet(`${u.origin}/robots.txt`, { timeout: 8000, maxBytes: 200000 });
      let applies = false;
      for (const line of String(data).split(/\r?\n/)) {
        const [k, ...rest] = line.split(':');
        const v = rest.join(':').trim();
        if (/^user-agent$/i.test(k.trim())) applies = v === '*' || /infosalamanca/i.test(v);
        else if (applies && /^disallow$/i.test(k.trim()) && v) rules.push(v);
      }
    } catch { rules = []; }
    robotsCache.set(u.origin, rules);
  }
  return !robotsCache.get(u.origin).some(r => u.pathname.startsWith(r));
}

async function fetchHtml(url) {
  if (!(await allowedByRobots(url))) return null;
  try {
    const { data, headers, url: finalUrl } = await posters.safeGet(url, { timeout: 15000, maxBytes: 3 * 1024 * 1024 });
    if (!/html/.test(String(headers['content-type'] || ''))) return null;
    return { $: cheerio.load(String(data)), url: finalUrl };
  } catch {
    return null;
  } finally {
    await sleep(800); // cortesía con webs pequeñas
  }
}

// Imágenes de una página que pueden ser el cartel: cuenta el texto de la propia imagen (alt, title,
// nombre de fichero); que la página hable de fiestas solo suma un punto.
function imagesIn($, pageUrl, pageText, town, year) {
  const page = score(pageText, town, year);
  const raw = [];
  const og = $('meta[property="og:image"]').attr('content');
  if (og) raw.push({ src: og, text: `${og} ${$('meta[property="og:title"]').attr('content') || ''}` });
  $('img').each((_, el) => {
    const src = $(el).attr('data-src') || $(el).attr('src');
    if (!src || /^data:|\.svg(\?|$)/i.test(src)) return;
    raw.push({ src, text: [$(el).attr('alt'), $(el).attr('title'), src].join(' ') });
  });
  const out = [];
  for (const r of raw) {
    const own = score(r.text, town, year);
    if (!own || !FEST_WORDS.test(plain(r.text))) continue;
    let image_url;
    try { image_url = new URL(r.src, pageUrl).href; } catch { continue; }
    // Miniaturas cuadradas de WordPress (…-120x120.jpg, …-300x300.jpg): no son el cartel
    const size = image_url.match(/-(\d+)x(\d+)\.\w+$/);
    if (size && Math.max(+size[1], +size[2]) < 400) continue;
    out.push({ image_url, score: own.score + (page && page.score >= 4 ? 1 : 0), year: own.year });
  }
  return out;
}

const FEST_LINK = /fiesta|cartel|programa|patronal|ferias?\b|vendimia|romer[ií]a|agenda|noticia/i;

async function searchTownWebsite(town, website, year) {
  const found = [];
  if (!website || /sedelectronica|sede\./i.test(website)) return found; // la sede electrónica no publica carteles
  const home = await fetchHtml(website);
  if (!home) return found;
  const pages = [home];
  const seen = new Set([home.url]);
  home.$('a[href]').each((_, a) => {
    const href = home.$(a).attr('href');
    const text = `${home.$(a).text()} ${href}`;
    if (!FEST_LINK.test(text)) return;
    try {
      const u = new URL(href, home.url);
      if (u.hostname !== new URL(home.url).hostname || seen.has(u.href) || seen.size > 6) return;
      seen.add(u.href);
    } catch { /* enlace roto */ }
  });
  for (const link of [...seen].slice(1, 7)) {
    const page = await fetchHtml(link);
    if (page) pages.push(page);
  }
  for (const page of pages) {
    const title = page.$('title').first().text().trim() || page.$('h1').first().text().trim();
    const pageText = `${title} ${page.$('h1,h2').slice(0, 4).text()}`;
    for (const img of imagesIn(page.$, page.url, pageText, town.municipality_name, year)) {
      if (img.score >= MIN_SCORE) {
        found.push({ source_url: page.url, image_url: img.image_url, title, score: img.score, year: img.year, found_by: 'web' });
      }
    }
  }
  // La misma imagen sale en varias páginas (portada, noticias...): una vez, con la mejor puntuación
  const best = new Map();
  for (const f of found) {
    const key = f.image_url.replace(/-\d+x\d+(?=\.\w+$)/, '');
    if (!best.has(key) || best.get(key).score < f.score) best.set(key, f);
  }
  return [...best.values()];
}

// ---------- Buscador (Brave Search API) ----------
async function braveSearch(query) {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&country=es&search_lang=es&count=10`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': process.env.BRAVE_API_KEY }
  });
  await sleep(1100); // el plan gratuito admite 1 consulta por segundo
  if (res.status === 429) { await sleep(5000); return []; }
  if (!res.ok) throw new Error(`Brave ${res.status}`);
  const data = await res.json();
  return (data.web?.results || []).map(r => ({
    url: r.url, title: r.title, description: r.description, thumb: r.thumbnail?.original
  }));
}

async function searchEngine(town, year) {
  const name = town.municipality_name;
  const queries = [
    `"${name}" fiestas ${year} cartel`,
    `"${name}" fiestas ${year} site:facebook.com`
  ];
  const found = [];
  for (const q of queries) {
    let results = [];
    try { results = await braveSearch(q); } catch (e) { console.warn(`  ⚠️ buscador: ${e.message}`); }
    for (const r of results) {
      const text = `${r.title} ${r.description} ${r.url}`;
      if (!plain(text).includes(nameKey(name))) continue; // tiene que hablar de este pueblo
      const sc = score(text, name, year);
      if (!sc || sc.score < MIN_SCORE) continue;
      let source;
      try { source = posters.sourceOf(r.url); } catch { continue; }
      found.push({
        source_url: r.url,
        image_url: source === 'web' ? r.thumb || null : null,
        title: r.title, snippet: r.description, score: sc.score, year: sc.year, found_by: 'search', query: q
      });
    }
  }
  // Resultados web sin imagen: la og:image de la página
  for (const f of found.filter(f => !f.image_url && posters.sourceOf(f.source_url) === 'web').slice(0, 3)) {
    const page = await fetchHtml(f.source_url);
    f.image_url = page?.$('meta[property="og:image"]').attr('content') || null;
  }
  return found.filter(f => posters.sourceOf(f.source_url) !== 'web' || f.image_url);
}

// ---------- Principal ----------
async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Falta MONGODB_URI');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  const query = { public: true, 'patron_festivals.0': { $exists: true } };
  if (OPTS.ine) query.cod_ine = OPTS.ine;
  const towns = (await MunicipalInfo.find(query)
    .select('municipality_name cod_ine patron_festivals contact_info.town_hall.website').lean())
    .map(t => ({ ...t, next: nextFestival(t.patron_festivals[0]?.celebration_dates) }))
    .filter(t => t.next && (OPTS.all || OPTS.ine || t.next.days <= OPTS.days))
    .sort((a, b) => a.next.days - b.next.days)
    .slice(0, OPTS.limit);

  console.log(`🔎 ${towns.length} pueblos · web del ayuntamiento: ${OPTS.web ? 'sí' : 'no'} · buscador: ${OPTS.search ? 'sí' : 'no (falta BRAVE_API_KEY)'}${OPTS.dryRun ? ' · prueba, sin guardar' : ''}`);
  let total = 0;
  let nuevos = 0;
  for (const town of towns) {
    const year = town.next.year;
    const found = [];
    if (OPTS.web) found.push(...await searchTownWebsite(town, town.contact_info?.town_hall?.website || DIPUTACION_WEBS[town.cod_ine]?.web, year));
    if (OPTS.search) found.push(...await searchEngine(town, year));
    for (const f of found) {
      total++;
      if (OPTS.dryRun) {
        console.log(`  · ${town.municipality_name} ${f.year || year} [${f.score}] ${f.source_url} ${f.image_url || ''}`);
        continue;
      }
      try {
        const r = await posters.addCandidate({ ...f, cod_ine: town.cod_ine, municipality_name: town.municipality_name, year: f.year || year });
        if (r.created) nuevos++;
      } catch (e) {
        console.warn(`  ⚠️ ${town.municipality_name}: ${e.message}`);
      }
    }
    console.log(`${town.municipality_name} (fiestas en ${town.next.days} días): ${found.length} candidatos`);
  }
  console.log(`✅ ${total} candidatos encontrados, ${nuevos} nuevos para revisar en /admin/carteles.html`);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error('❌', e.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
