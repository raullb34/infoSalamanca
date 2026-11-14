// GET /api/fotos/lugar?lat=&lon=&nombre=&pueblo=
// Foto de Wikimedia Commons de un monumento: busca imágenes geolocalizadas a menos de 300 m y se queda con
// la más cercana cuyo título nombre el monumento. Sin coincidencia clara no devuelve nada (mejor sin foto
// que con la de otro edificio). Devuelve autor y licencia para mostrarlos.
const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');

const router = express.Router();
const cache = new NodeCache({ stdTTL: 7 * 24 * 3600, maxKeys: 5000 });
const UA = 'infoSalamanca-bot/1.0 (+https://infosalamanca.duckdns.org)';

const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Palabras que no distinguen un monumento de otro
const GENERIC = new Set(('de del la las los el y e en san santa santo santos nuestra senora iglesia parroquial ermita convento ' +
  'monasterio casa palacio plaza torre puente castillo capilla catedral basilica templo santuario colegio hospital antiguo antigua ' +
  'conjunto restos ruinas mm sta sto calle edificio fachada portada').split(' '));
const strip = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
// Fotos que no enseñan el monumento: vistas tomadas desde él, objetos, esculturas, retratos, mapas
const NOT_IT = /\bdesde\b|\bfrom\b|tocador|pulpito|estatua|escultura|retrato|talla|mapa|plano|grabado|postal/;
const DETAIL = /medallon|detalle|retablo|interior|capitel|escudo|sepulcro|inscripci|pintura|boveda|artesonado|reja|pila|lapida|tumba|organo|claustro|techo|puerta|ventana|relieve/;
function distanceKm(a, b, c, d) {
  const r = Math.PI / 180;
  const x = (d - b) * r * Math.cos(((a + c) / 2) * r);
  const y = (c - a) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}
const LICENSE_OK = /^(cc0|cc[- ]by|public domain|pd)/i;

function keyWords(nombre, pueblo) {
  const town = new Set(plain(pueblo).split(/[^a-z0-9ñ]+/));
  return [...new Set(plain(nombre).split(/[^a-z0-9ñ]+/).filter(w => w.length > 3 && !GENERIC.has(w) && !town.has(w)))];
}

router.get('/lugar', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const nombre = String(req.query.nombre || '').slice(0, 200);
  const pueblo = String(req.query.pueblo || '').slice(0, 100);
  // Solo coordenadas de la provincia (más o menos): evita usar esto como proxy para cualquier sitio
  if (!(lat > 40 && lat < 41.6 && lon > -7.1 && lon < -5) || !nombre) return res.status(400).json({ error: 'Parámetros no válidos' });

  const key = `${lat.toFixed(5)},${lon.toFixed(5)},${plain(nombre)}`;
  if (cache.has(key)) return res.json(cache.get(key));

  // "Monasterio de San Leonardo / Seminario de San Jerónimo": vale con que encaje uno de los nombres
  const parts = nombre.split(/\s*\/\s*|\s*\(/).map(n => keyWords(n, pueblo)).filter(w => w.length);
  if (!parts.length) { cache.set(key, { foto: null }); return res.json({ foto: null }); }
  const matches = (title) => parts.some(words => words.filter(w => title.includes(w)).length >= Math.min(2, words.length));

  const usable = (p) => {
    if (NOT_IT.test(plain(p.title))) return false;
    const ii = p.imageinfo?.[0];
    if (!ii || !/^image\/(jpeg|png|webp)/.test(ii.mime)) return false;
    return LICENSE_OK.test(strip(ii.extmetadata?.LicenseShortName?.value));
  };
  // Mejor el edificio entero que un detalle (un capitel, un retablo, el interior…)
  const best = (list) => list.find(p => !DETAIL.test(plain(p.title))) || list[0];
  const commons = (params) => axios.get('https://commons.wikimedia.org/w/api.php', {
    timeout: 10000,
    headers: { 'User-Agent': UA },
    params: { action: 'query', format: 'json', prop: 'imageinfo|coordinates', iiprop: 'url|extmetadata|mime', iiurlwidth: 960, ...params }
  }).then(r => Object.values(r.data?.query?.pages || {}).sort((a, b) => a.index - b.index));

  try {
    // 1) Fotos geolocalizadas a menos de 300 m, de más cerca a más lejos
    const near = await commons({ generator: 'geosearch', ggscoord: `${lat}|${lon}`, ggsradius: 300, ggslimit: 40, ggsnamespace: 6 });
    let hit = best(near.filter(p => usable(p) && matches(plain(p.title))));

    // 2) Si no, búsqueda por nombre y pueblo: la foto tiene que estar a menos de 2 km o nombrar el pueblo
    if (!hit) {
      const townWords = plain(pueblo).split(/[^a-z0-9ñ]+/).filter(w => w.length > 3 && !GENERIC.has(w));
      const q = `${nombre.split(/\s*\/\s*|\s*\(/)[0]} ${pueblo}`.trim();
      const found = await commons({ generator: 'search', gsrsearch: `${q} filetype:bitmap`, gsrnamespace: 6, gsrlimit: 15 });
      hit = best(found.filter(p => {
        if (!usable(p) || !matches(plain(p.title))) return false;
        const c = p.coordinates?.[0];
        if (c) return distanceKm(lat, lon, c.lat, c.lon) < 2;
        return townWords.some(w => plain(p.title).includes(w));
      }));
    }
    const ii = hit?.imageinfo?.[0];
    const foto = ii ? {
      src: ii.thumburl,
      page: ii.descriptionurl,
      title: hit.title.replace(/^File:/, ''),
      author: strip(ii.extmetadata?.Artist?.value).slice(0, 120) || 'Autor desconocido',
      license: strip(ii.extmetadata?.LicenseShortName?.value),
      licenseUrl: ii.extmetadata?.LicenseUrl?.value || null
    } : null;
    cache.set(key, { foto });
    res.json({ foto });
  } catch (err) {
    console.error('Foto de monumento:', err.message);
    res.json({ foto: null }); // sin foto, la ficha se muestra igual
  }
});

module.exports = router;
