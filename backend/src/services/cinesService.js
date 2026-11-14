// Cartelera de los cines de la provincia, leída de la web de cada cine (no hay datos abiertos de cines).
//  - verdi (Van Dyck): cada película tiene sus sesiones en JSON-LD (schema.org ScreeningEvent)
//  - megarama: la página de horarios da las sesiones de un día; se pide cada día de la semana
//  - multicinesbejar (Béjar y Guijuelo): bloques de película con "sáb | 14 nov" y "19:30h"
// Se guarda 3 horas en memoria; peticiones de una en una con pausa, y con nuestro User-Agent.
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const DATA = path.resolve(__dirname, '../data/cines.json');
const UA = 'infoSalamanca-bot/1.0 (+https://infosalamanca.duckdns.org)';
const TTL = 3 * 60 * 60 * 1000;
const DAYS = 7;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let cache = null;
let cachedAt = 0;
let building = null;

async function get(url) {
  const res = await axios.get(url, { timeout: 15000, responseType: 'arraybuffer', headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9' } });
  const charset = (/charset=([\w-]+)/i.exec(res.headers['content-type'] || '') || [])[1] || 'utf-8';
  await sleep(300);
  return new TextDecoder(/8859|latin/i.test(charset) ? 'latin1' : charset).decode(res.data);
}

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
// "LOS MISERABLES" → "Los miserables"; los títulos con minúsculas se dejan como vienen
const titleCase = (s) => {
  const t = clean(s);
  if (/[a-záéíóúñ]/.test(t)) return t;
  const low = t.toLowerCase();
  return low.charAt(0).toUpperCase() + low.slice(1);
};
const pad = (n) => String(n).padStart(2, '0');
const localIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Fecha y hora locales (Europe/Madrid) → "2026-11-14T19:30"
const at = (dateIso, hhmm) => `${dateIso}T${hhmm}`;

const GENEROS = { Drama: 'Drama', History: 'Historia', Comedy: 'Comedia', Action: 'Acción', Adventure: 'Aventura', Animation: 'Animación',
  Family: 'Familia', Fantasy: 'Fantasía', Horror: 'Terror', Thriller: 'Suspense', Romance: 'Romance', 'Science Fiction': 'Ciencia ficción',
  Documentary: 'Documental', Music: 'Música', Musical: 'Musical', Crime: 'Crimen', Mystery: 'Misterio', War: 'Bélica', Biography: 'Biografía' };

// ---------- Van Dyck (plataforma de Cines Verdi) ----------
async function fromVerdi(base) {
  const html = await get(`${base}/cartelera`);
  const NAV = new Set(['cartelera', 'proximamente', 'noticias', 'especiales', 'newsletter', 'precios', 'contacto', 'donde-estamos',
    'preguntas-frecuentes', 'politica-de-cookies', 'politica-de-privacidad', 'bono-cultural', 'cine-senior', 'favicon.ico']);
  const slugs = [...new Set([...html.matchAll(/href="\/([a-z0-9-]+)"/g)].map(m => m[1]))].filter(s => !NAV.has(s)).slice(0, 45);
  const films = [];
  for (const slug of slugs) {
    let page;
    try { page = await get(`${base}/${slug}`); } catch { continue; }
    for (const block of page.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
      let data;
      try { data = JSON.parse(block[1]); } catch { continue; }
      const nodes = data['@graph'] || [data];
      for (const n of nodes) {
        if (n['@type'] !== 'Movie' || !Array.isArray(n.event) || !n.event.length) continue;
        const sesiones = n.event.filter(e => e.startDate).map(e => ({
          inicio: String(e.startDate).slice(0, 16),
          version: /original|VOSE/i.test(e.inLanguage || '') ? 'VOSE' : null,
          entradas: e.offers?.url || e.url || null
        }));
        if (!sesiones.length) continue;
        films.push({
          titulo: clean(n.name),
          url: n.url || `${base}/${slug}`,
          cartel: typeof n.image === 'string' ? n.image : n.image?.url || null,
          duracion: Number((/PT(\d+)M/.exec(n.duration || '') || [])[1]) || null,
          calificacion: n.contentRating || null,
          generos: [].concat(n.genre || []).map(g => GENEROS[g] || g).slice(0, 3),
          sesiones
        });
      }
    }
  }
  return films;
}

// ---------- Megarama ----------
async function fromMegarama(base) {
  const first = await get(`${base}/ES/43/los-horarios-cine-salamanca.html`);
  const days = [...new Set([...first.matchAll(/relJour="(\d{4}-\d{2}-\d{2})"/g)].map(m => m[1]))];
  const today = localIso(new Date());
  const wanted = days.filter(d => d >= today).slice(0, DAYS);
  const byTitle = new Map();
  for (const day of wanted) {
    let html;
    try { html = await get(`${base}/ES/ajax/cine/megarama.horaires?jourSel=${day}`); } catch { continue; }
    const $ = cheerio.load(html);
    $('.miniTitre').each((_, el) => {
      const titulo = titleCase($(el).text());
      // El bloque de la película: desde su título hasta el siguiente
      const zone = $(el).closest('.horaireZoning');
      const block = zone.length ? zone : $(el).closest('.row');
      const times = [];
      block.find('.BTHoraire a').each((__, a) => {
        const h = clean($(a).find('.heure').text()).replace('h', ':');
        if (!/^\d{1,2}:\d{2}$/.test(h)) return;
        times.push({
          inicio: at(day, h.padStart(5, '0')),
          version: /VO/.test(clean($(a).find('.version').text())) ? 'VOSE' : null,
          entradas: $(a).attr('href') || null
        });
      });
      if (!times.length) return;
      const film = byTitle.get(titulo) || { titulo, url: null, cartel: null, duracion: null, calificacion: null, generos: [], sesiones: [] };
      const link = block.find('a[href*="fiche-film-cinema"]').attr('href');
      if (link) film.url = link;
      const src = block.find('img.afficheGdImg').first().attr('data-original');
      if (src && !film.cartel) film.cartel = new URL(src, base).href;
      film.calificacion = film.calificacion || clean(block.find('.badge-avertissement').first().text()) || null;
      film.sesiones.push(...times);
      byTitle.set(titulo, film);
    });
  }
  return [...byTitle.values()];
}

// ---------- Multicines Béjar (y Guijuelo) ----------
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function dateFromShort(text) {
  // "sáb | 14 nov" → fecha más próxima en adelante (puede ser del año que viene en diciembre)
  const m = /(\d{1,2})\s+([a-záéíóú]{3})/i.exec(text);
  if (!m) return null;
  const month = MESES.indexOf(m[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  if (month < 0) return null;
  const now = new Date();
  let d = new Date(now.getFullYear(), month, Number(m[1]));
  if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60)) d = new Date(now.getFullYear() + 1, month, Number(m[1]));
  return localIso(d);
}
async function fromMulticinesBejar(url) {
  const $ = cheerio.load(await get(url));
  const films = [];
  $('h3.fw-light').each((_, h3) => {
    const titulo = titleCase($(h3).text());
    const col = $(h3).closest('.col-12');
    const row = col.closest('.row');
    const sesiones = [];
    col.find('.box_ticket').each((__, box) => {
      const day = dateFromShort(clean($(box).find('.date_schedule').text()));
      const h = (/(\d{1,2}:\d{2})/.exec(clean($(box).find('.hour_schedule').text())) || [])[1];
      if (day && h) sesiones.push({ inicio: at(day, h.padStart(5, '0')), version: null, entradas: null });
    });
    if (!sesiones.length) return;
    const link = $(h3).closest('a').attr('href');
    const img = row.find('img').first().attr('src');
    films.push({
      titulo,
      url: link ? new URL(link, url).href : null,
      cartel: img ? new URL(img, url).href : null,
      duracion: null,
      calificacion: null,
      generos: [],
      sesiones
    });
  });
  return films;
}

const FETCHERS = { verdi: fromVerdi, megarama: fromMegarama, multicinesbejar: fromMulticinesBejar };

// Solo sesiones de hoy en adelante y de los próximos 7 días, ordenadas
function tidy(films) {
  const now = new Date();
  const from = `${localIso(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const until = localIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + DAYS));
  return films
    .map(f => ({ ...f, sesiones: f.sesiones.filter(s => s.inicio >= from && s.inicio.slice(0, 10) < until).sort((a, b) => a.inicio.localeCompare(b.inicio)) }))
    .filter(f => f.sesiones.length)
    .sort((a, b) => a.sesiones[0].inicio.localeCompare(b.sesiones[0].inicio));
}

async function build() {
  const { cines } = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const out = [];
  for (const c of cines) {
    const { fuente, ...info } = c;
    const item = { ...info, fuente: fuente ? fuente.url : null, peliculas: [], estado: fuente ? 'ok' : 'sin cartelera en línea' };
    if (fuente && FETCHERS[fuente.tipo]) {
      try {
        item.peliculas = tidy(await FETCHERS[fuente.tipo](fuente.url));
        if (!item.peliculas.length) item.estado = 'sin sesiones anunciadas';
      } catch (err) {
        console.error(`Cartelera de ${c.nombre}:`, err.message);
        item.estado = 'no disponible ahora';
      }
    }
    out.push(item);
  }
  return { actualizado: new Date().toISOString(), cines: out };
}

// Cartelera (de la caché si tiene menos de 3 horas; si una actualización falla, se sirve la anterior)
async function cartelera() {
  if (cache && Date.now() - cachedAt < TTL) return cache;
  if (!building) {
    building = build().then(data => { cache = data; cachedAt = Date.now(); return data; })
      .finally(() => { building = null; });
  }
  if (cache) return cache; // mientras se rehace, la anterior
  return building;
}

module.exports = { cartelera, _test: { fromVerdi, fromMegarama, fromMulticinesBejar, dateFromShort } };
