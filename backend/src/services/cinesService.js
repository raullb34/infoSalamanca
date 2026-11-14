// Cartelera de los cines de la provincia, leída de la web de cada cine (no hay datos abiertos de cines).
//  - verdi (Van Dyck): cada película tiene sus sesiones en JSON-LD (schema.org ScreeningEvent)
//  - megarama: la página de horarios da las sesiones de un día; se pide cada día de la semana
//  - multicinesbejar (Béjar y Guijuelo): bloques de película con "sáb | 14 nov" y "19:30h"
// Se guarda 3 horas en memoria; peticiones de una en una con pausa, y con nuestro User-Agent.
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const tls = require('tls');

const DATA = path.resolve(__dirname, '../data/cines.json');
const UA = 'infoSalamanca-bot/1.0 (+https://infosalamanca.duckdns.org)';
const TTL = 3 * 60 * 60 * 1000;
const DAYS = 14; // los cines pequeños programan los fines de semana con dos semanas de antelación
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

// ---------- Kinetike (venta de entradas del Teatro Cine Calderón, Peñaranda) ----------
// Aplicación ASP.NET: la portada lista las películas a la venta; cada película tiene una página con sus días,
// y las horas de cada día salen al pulsar su botón "SESIONES" (un POST con el __VIEWSTATE de la página).
// Su servidor no manda el certificado raíz intermedio que Node 18 no trae (Sectigo R46): se añade la versión
// firmada por USERTrust (certs/), sin desactivar la verificación
const KINETIKE_AGENT = new https.Agent({
  ca: [...tls.rootCertificates, fs.readFileSync(path.resolve(__dirname, '../../certs/sectigo-r46-usertrust.pem'), 'utf8')]
});
async function fromKinetike(initUrl) {
  const base = new URL('.', initUrl).href;
  const cine = new URL(initUrl).searchParams.get('cine');
  let cookie = '';
  const req = async (url, form) => {
    const res = await axios({
      url, method: form ? 'post' : 'get', timeout: 20000, responseType: 'text', maxRedirects: 3, httpsAgent: KINETIKE_AGENT,
      data: form ? new URLSearchParams(form).toString() : undefined,
      headers: { 'User-Agent': UA, ...(cookie ? { Cookie: cookie } : {}), ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }
    });
    const set = res.headers['set-cookie'];
    if (set) cookie = [...new Set([...cookie.split('; ').filter(Boolean), ...set.map(c => c.split(';')[0])])].join('; ');
    await sleep(400);
    return String(res.data);
  };
  const home = cheerio.load(await req(initUrl));
  const films = [];
  home('.panel_peli').each((_, el) => {
    const input = home(el).find('input[type="image"]');
    const id = (/idPelicula=(\d+)/.exec(input.attr('onclick') || '') || [])[1];
    const src = input.attr('src');
    films.push({
      id,
      titulo: titleCase(input.attr('alt') || home(el).find('.info_negrita').text()),
      url: initUrl,
      cartel: src ? new URL(src, base).href : null,
      duracion: Number((/(\d+)\s*min/.exec(home(el).find('.infoPeliSesion').text()) || [])[1]) || null,
      calificacion: (/Clasificacion(\d+|TP)/i.exec(home(el).find('.infoPeliSesionRight img').attr('src') || '') || [])[1] || null,
      generos: [],
      sesiones: []
    });
  });
  for (const f of films.filter(x => x.id).slice(0, 15)) {
    const url = `${base}sesionesFuturas.aspx?idPelicula=${f.id}&cine=${encodeURIComponent(cine)}`;
    let page;
    try { page = await req(url); } catch { continue; }
    const days = [...page.matchAll(/(\d{2})\/(\d{2})\/(\d{4})<\/span><\/div><div[^>]*><input type="submit" name="(\d+)" value="SESIONES"/g)];
    for (const d of days.slice(0, DAYS)) {
      const $ = cheerio.load(page);
      const form = {};
      $('input[type="hidden"]').each((__, h) => { form[$(h).attr('name')] = $(h).attr('value') || ''; });
      form[d[4]] = 'SESIONES';
      let res;
      try { res = await req(url, form); } catch (err) { if (process.env.DEBUG) console.log('kinetike POST', err.message); continue; }
      // El bloque del día va hasta el siguiente día ("shadow-lg") o el final del formulario
      const block = (res.split(`id="PanelSesiones${d[4]}"`)[1] || '').split(/shadow-lg|<\/form>/)[0];
      for (const t of block.matchAll(/value="(\d{1,2}:\d{2})"/g)) {
        f.sesiones.push({ inicio: `${d[3]}-${d[2]}-${d[1]}T${t[1].padStart(5, '0')}`, version: null, entradas: initUrl });
      }
      page = res; // el siguiente POST va con el __VIEWSTATE de esta respuesta
    }
  }
  return films.map(({ id, ...f }) => f);
}

// ---------- Cine Juventud (Ciudad Rodrigo) ----------
// La portada pone "CARTELERA DEL 14 AL 16 DE NOVIEMBRE" y, por película, su cartel y "Sa 17:30 Do 17:30".
// El título solo está en el nombre del cartel ("ruega_por_nosotras_109431"): se busca entre las películas
// que echan esta semana los otros cines y, si no está, se deja el del archivo.
const DIAS = { lu: 1, ma: 2, mi: 3, mx: 3, ju: 4, vi: 5, sa: 6, do: 0 };
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const plainText = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
async function fromCineJuventud(url, known = []) {
  const html = await get(url);
  const $ = cheerio.load(html);
  const head = /CARTELERA DEL (\d{1,2})(?: DE ([A-ZÁÉÍÓÚ]+))? AL (\d{1,2}) DE ([A-ZÁÉÍÓÚ]+)/i.exec($.text());
  if (!head) return [];
  const now = new Date();
  const endMonth = MESES_LARGOS.indexOf(plainText(head[4]));
  const startMonth = head[2] ? MESES_LARGOS.indexOf(plainText(head[2])) : endMonth;
  let start = new Date(now.getFullYear(), startMonth, Number(head[1]));
  if (start < new Date(now.getFullYear(), now.getMonth() - 2, 1)) start = new Date(now.getFullYear() + 1, startMonth, Number(head[1]));
  // Fechas del fin de semana anunciado, por día de la semana
  const dates = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (d.getMonth() === endMonth && d.getDate() > Number(head[3])) break;
    dates[d.getDay()] = localIso(d);
  }
  const knownPlain = known.map(k => ({ t: k.titulo, cartel: k.cartel, p: plainText(k.titulo).replace(/[^a-z0-9]+/g, ' ').trim() }));
  const seen = new Set();
  const films = [];
  $('.vc_single_image-img').each((_, img) => {
    const src = $(img).attr('src') || '';
    const name = (src.split('/').pop() || '').replace(/\.\w+$/, '').replace(/-\d+x\d+(-\d+)?$/, '').replace(/[_-]\d{3,}.*$/, '');
    const column = $(img).closest('.wpb_column');
    const text = clean(column.find('.qode-accordion-content-inner').text());
    const times = [...text.matchAll(/\b(Lu|Ma|Mi|Mx|Ju|Vi|Sa|Do)\w*\.?\s+(\d{1,2}:\d{2})/gi)];
    if (!times.length || seen.has(name)) return; // sin horas (p. ej. el cartel de un festival)
    seen.add(name);
    const words = plainText(name).replace(/[^a-z0-9]+/g, ' ').trim();
    const match = knownPlain.find(k => k.p.startsWith(words) || (words.length > 4 && k.p.includes(words)));
    const titulo = match ? match.t : words.charAt(0).toUpperCase() + words.slice(1);
    const sesiones = times.map(([, d, h]) => dates[DIAS[d.toLowerCase().slice(0, 2)]] && ({
      inicio: `${dates[DIAS[d.toLowerCase().slice(0, 2)]]}T${h.padStart(5, '0')}`, version: null, entradas: null
    })).filter(Boolean);
    // Su web no deja enseñar sus carteles desde otra página: el de la misma película en otro cine
    films.push({ titulo, url, cartel: match?.cartel || null, duracion: null, calificacion: null, generos: [], sesiones });
  });
  return films;
}

const FETCHERS = { verdi: fromVerdi, megarama: fromMegarama, multicinesbejar: fromMulticinesBejar, kinetike: fromKinetike, cinejuventud: fromCineJuventud };

// Solo sesiones de ahora en adelante y de los próximos DAYS días, ordenadas
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
  // Los que no dan el título (Cine Juventud) van al final, para buscarlo entre los de los demás
  const order = [...cines].sort((a, b) => (a.fuente?.tipo === 'cinejuventud') - (b.fuente?.tipo === 'cinejuventud'));
  for (const c of order) {
    const { fuente, ...info } = c;
    const item = { ...info, fuente: fuente ? fuente.url : null, peliculas: [], estado: fuente ? 'ok' : 'sin cartelera en línea' };
    if (fuente && FETCHERS[fuente.tipo]) {
      try {
        const known = out.flatMap(o => o.peliculas.map(p => ({ titulo: p.titulo, cartel: p.cartel }))).filter(k => k.cartel);
        item.peliculas = tidy(await FETCHERS[fuente.tipo](fuente.url, known));
        if (!item.peliculas.length) item.estado = 'sin sesiones anunciadas';
      } catch (err) {
        console.error(`Cartelera de ${c.nombre}:`, err.message);
        item.estado = 'no disponible ahora';
      }
    }
    out.push(item);
  }
  // En el orden del archivo
  const pos = new Map(cines.map((c, i) => [c.id, i]));
  out.sort((a, b) => pos.get(a.id) - pos.get(b.id));
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

module.exports = { cartelera, _test: { fromVerdi, fromMegarama, fromMulticinesBejar, fromKinetike, fromCineJuventud, dateFromShort } };
