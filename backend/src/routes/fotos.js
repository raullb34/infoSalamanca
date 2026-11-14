// GET /api/fotos/lugar?lat=&lon=&nombre=&pueblo=
// La mejor foto libre de un monumento, con criterios objetivos:
//   1. Candidatas: la imagen principal de su artículo en Wikipedia (la eligen los editores), las fotos de
//      Wikimedia Commons geolocalizadas a menos de 300 m y las que salen buscando "nombre + pueblo".
//      Todas tienen que nombrar el monumento en el título (o ser la de su artículo).
//   2. Puntuación: artículo de Wikipedia, "Featured picture" / "Quality image" de Commons, resolución,
//      formato apaisado, cercanía; restan los detalles (retablos, capiteles, interiores…).
// Sin coincidencia clara no devuelve nada: mejor sin foto que con la de otro edificio.
const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');

const router = express.Router();
const cache = new NodeCache({ stdTTL: 7 * 24 * 3600, maxKeys: 5000 });
const UA = 'infoSalamanca-bot/1.0 (+https://infosalamanca.duckdns.org)';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const WIKI = 'https://es.wikipedia.org/w/api.php';

const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Palabras que no distinguen un monumento de otro
const GENERIC = new Set(('de del la las los el y e en san santa santo santos nuestra senora iglesia parroquial ermita convento ' +
  'monasterio casa palacio plaza torre puente castillo capilla catedral basilica templo santuario colegio hospital antiguo antigua ' +
  'conjunto restos ruinas mm sta sto calle edificio fachada portada').split(' '));
const strip = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
// Fotos que no enseñan el monumento: vistas tomadas desde él, objetos, esculturas, retratos, mapas
const NOT_IT = /\bdesde\b|\bfrom\b|tocador|pulpito|estatua|escultura|retrato|talla|mapa|plano|grabado|postal/;
// Partes del monumento: valen, pero mejor el edificio entero
const DETAIL = ['medallon', 'detalle', 'retablo', 'capitel', 'escudo', 'sepulcro', 'inscripci', 'pintura', 'boveda', 'artesonado', 'reja', 'pila', 'lapida', 'tumba', 'organo', 'techo', 'puerta', 'ventana', 'relieve', 'altar', 'cristo', 'virgen', 'imagen', 'paso', 'procesion', 'nazareno', 'placa', 'prendimiento', 'semana santa', 'cofradia', 'belen', 'cartel']
// Fotos antiguas (el año va en el título): valen si no hay otra
const OLD = /\b(1[6-8][0-9][0-9]|19[0-5][0-9])\b/;
const INSIDE = /interior|claustro|\bnave\b|\bcoro\b|inside/;
const LICENSE_OK = /^(cc0|cc[- ]by|public domain|pd)/i;
const QUALITY = { 'Category:Featured pictures on Wikimedia Commons': 6, 'Category:Quality images': 4 };

function distanceKm(a, b, c, d) {
  const r = Math.PI / 180;
  const x = (d - b) * r * Math.cos(((a + c) / 2) * r);
  const y = (c - a) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

function keyWords(nombre, pueblo) {
  const town = new Set(plain(pueblo).split(/[^a-z0-9ñ]+/));
  return [...new Set(plain(nombre).split(/[^a-z0-9ñ]+/).filter(w => w.length > 3 && !GENERIC.has(w) && !town.has(w)))];
}

const get = (url, params) => axios.get(url, { timeout: 10000, headers: { 'User-Agent': UA }, params: { action: 'query', format: 'json', ...params } })
  .then(r => Object.values(r.data?.query?.pages || {}));
// Datos de Commons de cada imagen: miniatura, licencia, tamaño, coordenadas y si es foto destacada o de calidad
const IMG = { prop: 'imageinfo|coordinates|categories', iiprop: 'url|extmetadata|mime|size', iiurlwidth: 1280, clcategories: Object.keys(QUALITY).join('|'), cllimit: 'max' };

router.get('/lugar', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const nombre = String(req.query.nombre || '').slice(0, 200);
  const pueblo = String(req.query.pueblo || '').slice(0, 100);
  // Solo coordenadas de la provincia (más o menos): evita usar esto como proxy para cualquier sitio
  if (!(lat > 40 && lat < 41.6 && lon > -7.1 && lon < -5) || !nombre) return res.status(400).json({ error: 'Parámetros no válidos' });

  const key = `${lat.toFixed(5)},${lon.toFixed(5)},${plain(nombre)},${plain(pueblo)}`;
  if (cache.has(key)) return res.json(cache.get(key));

  // "Monasterio de San Leonardo / Seminario de San Jerónimo": vale con que encaje uno de los nombres.
  // Lo que va entre paréntesis suele ser el pueblo ("(Alba de Tormes)"): no sirve para reconocer la foto
  const names = nombre.replace(/\([^)]*\)?/g, ' ').split(/\s*\/\s*/).filter(n => n.trim());
  const townWords = plain(pueblo).split(/[^a-z0-9ñ]+/).filter(w => w.length > 3 && !GENERIC.has(w));
  const hasTown = (t) => townWords.length > 0 && townWords.every(w => t.includes(w));
  // Palabras que distinguen el monumento. Si el nombre solo tiene genéricas ("Catedral de Ciudad Rodrigo"),
  // valen esas, pero entonces la foto tiene que nombrar también el pueblo
  const parts = names.map(n => {
    const own = keyWords(n, pueblo);
    if (own.length) return { words: own, needTown: false };
    const generic = plain(n).split(/[^a-z0-9ñ]+/).filter(w => w.length > 4 && GENERIC.has(w) && !townWords.includes(w));
    return { words: generic, needTown: true };
  }).filter(p => p.words.length);
  if (!parts.length) { cache.set(key, { foto: null }); return res.json({ foto: null }); }
  // Coincidencia: dos palabras propias; o, en nombres cortos, la última (el nombre propio: "Montarco") y el
  // pueblo ("Palacio de Montarco. Ciudad Rodrigo"). Así "Mercado de San Juan" no se queda con el Mercado Central
  const matchCount = (title, strict = false) => Math.max(...parts.map(({ words, needTown }) => {
    const n = words.filter(w => title.includes(w)).length;
    if (!n) return 0;
    if (needTown) return hasTown(title) ? n : 0;
    if (n >= Math.min(2, words.length)) return n;
    if (strict) return 0;
    return words.length <= 2 && title.includes(words[words.length - 1]) && hasTown(title) ? n : 0;
  }));
  // Un detalle cuenta en contra salvo que sea el propio monumento ("Ermita del Cristo")
  const nameP = plain(nombre);
  const isDetail = (t) => DETAIL.some(w => t.includes(w) && !nameP.includes(w));

  try {
    const firstName = names[0] || nombre;
    const [near, found, articles] = await Promise.all([
      get(COMMONS, { generator: 'geosearch', ggscoord: `${lat}|${lon}`, ggsradius: 300, ggslimit: 40, ggsnamespace: 6, ...IMG }),
      get(COMMONS, { generator: 'search', gsrsearch: `${firstName} ${pueblo} filetype:bitmap`, gsrnamespace: 6, gsrlimit: 20, ...IMG }),
      get(WIKI, { generator: 'geosearch', ggscoord: `${lat}|${lon}`, ggsradius: 600, ggslimit: 20, prop: 'pageimages', piprop: 'name' }).catch(() => [])
    ]);

    // Imagen principal del artículo de Wikipedia del monumento (el título del artículo tiene que nombrarlo
    // sin dudas: "El Castañar" no es la plaza de toros de El Castañar)
    const article = articles.filter(a => a.pageimage && matchCount(plain(a.title), true))
      .sort((a, b) => matchCount(plain(b.title), true) - matchCount(plain(a.title), true))[0];
    const wikiFile = article ? (await get(COMMONS, { titles: `File:${article.pageimage}`, ...IMG }).catch(() => []))[0] : null;

    const seen = new Set();
    const scored = [];
    const consider = (p, origin) => {
      if (!p || seen.has(p.title)) return;
      seen.add(p.title);
      const ii = p.imageinfo?.[0];
      if (!ii || !/^image\/(jpeg|png|webp)/.test(ii.mime)) return;
      if (!LICENSE_OK.test(strip(ii.extmetadata?.LicenseShortName?.value))) return;
      const t = plain(p.title);
      if (NOT_IT.test(t)) return;
      const matched = matchCount(t);
      const c = p.coordinates?.[0];
      const dist = c ? distanceKm(lat, lon, c.lat, c.lon) : null;
      if (origin !== 'wikipedia') {
        if (!matched) return;
        // Las de la búsqueda por nombre: geolocalizadas cerca o, si no tienen coordenadas, que nombren el
        // monumento sin dudas y el pueblo ("Salamanca - Monasterio de Santa María de la Vega 1.jpg")
        if (origin === 'busqueda' && !(dist !== null ? dist < 2 : matchCount(t, true) >= 2 && hasTown(t))) return;
      }
      const mp = (ii.width * ii.height) / 1e6;
      let score = 0;
      if (origin === 'wikipedia') score += 6;
      for (const cat of p.categories || []) score += QUALITY[cat.title] || 0;
      score += Math.min(3, mp / 4); // resolución (hasta 12 Mpx)
      score += ii.width >= ii.height * 1.15 ? 1.5 : ii.height > ii.width * 1.3 ? -0.5 : 0; // apaisada
      score += matched * 0.5;
      if (dist !== null) score += Math.max(0, 1 - dist / 0.5); // cuanto más cerca, mejor
      if (isDetail(t)) score -= 4;
      if (OLD.test(t)) score -= 8;
      if (INSIDE.test(t)) score -= 3;
      if (ii.width < 800) score -= 2;
      scored.push({ p, score, origin });
    };
    consider(wikiFile, 'wikipedia');
    near.forEach(p => consider(p, 'cerca'));
    found.forEach(p => consider(p, 'busqueda'));

    const best = scored.sort((a, b) => b.score - a.score)[0];
    if (process.env.DEBUG_FOTOS) console.log(nombre, JSON.stringify(parts), article?.title, scored.slice(0, 5).map(x => `${x.score.toFixed(1)} ${x.origin} ${x.p.title}`))
    const ii = best?.p.imageinfo?.[0];
    const foto = ii ? {
      src: ii.thumburl,
      width: ii.thumbwidth,
      height: ii.thumbheight,
      page: ii.descriptionurl,
      title: best.p.title.replace(/^File:/, ''),
      author: strip(ii.extmetadata?.Artist?.value).slice(0, 120) || 'Autor desconocido',
      license: strip(ii.extmetadata?.LicenseShortName?.value),
      licenseUrl: ii.extmetadata?.LicenseUrl?.value || null,
      origin: best.origin
    } : null;
    cache.set(key, { foto });
    res.json({ foto });
  } catch (err) {
    console.error('Foto de monumento:', err.message);
    res.json({ foto: null }); // sin foto, la ficha se muestra igual
  }
});

module.exports = router;
