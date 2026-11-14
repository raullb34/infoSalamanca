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
const DETAIL = /medallon|detalle|retablo|interior|capitel|escudo|sepulcro|inscripci|pintura|boveda|artesonado|reja|pila|lapida|tumba|organo|claustro|techo|puerta|ventana|relieve/;
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

  try {
    const { data } = await axios.get('https://commons.wikimedia.org/w/api.php', {
      timeout: 10000,
      headers: { 'User-Agent': UA },
      params: {
        action: 'query', format: 'json', generator: 'geosearch', ggscoord: `${lat}|${lon}`, ggsradius: 300,
        ggslimit: 40, ggsnamespace: 6, prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: 960
      }
    });
    const pages = Object.values(data?.query?.pages || {}).sort((a, b) => a.index - b.index); // de más cerca a más lejos
    const ok = pages.filter(p => {
      const ii = p.imageinfo?.[0];
      if (!ii || !/^image\/(jpeg|png|webp)/.test(ii.mime)) return false;
      if (!LICENSE_OK.test(strip(ii.extmetadata?.LicenseShortName?.value))) return false;
      return matches(plain(p.title));
    });
    // Mejor el edificio entero que un detalle (un capitel, un retablo, el interior…)
    const hit = ok.find(p => !DETAIL.test(plain(p.title))) || ok[0];
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
