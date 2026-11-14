// Conector Meteoclimatic (red colaborativa; Meteoclimatic, Societat d'Estudis del Temps i el Clima).
// Condiciones verificadas en noviembre de 2026:
//  - Licencia del sitio y de los datos que aportan las estaciones: Creative Commons BY-NC-ND 3.0
//    (aviso legal https://www.meteoclimatic.net/index/wp/legal_es.html). Uso no comercial con atribución,
//    sin obras derivadas: se puede mostrar tal cual, pero NO redistribuir normalizado (CSV/JSON, Junta).
//  - robots.txt prohíbe a los robots /feed/ (donde están los RSS/XML). Por eso el acceso es configurable:
//      METEOCLIMATIC_ACCESO=off   (por defecto) no se consulta nada
//      METEOCLIMATIC_ACCESO=feed  RSS por provincia: SOLO con autorización escrita de Meteoclimatic
//      METEOCLIMATIC_ACCESO=mapa  tabla pública /mapinfo/ESCYL (permitida por robots.txt), 1 petición cada 30 min
// Formato del RSS documentado en https://www.meteoclimatic.net/index/wp/rss_es.html (bloque de datos
// codificado dentro de <content> entre comentarios HTML).
const axios = require('axios');
const cheerio = require('cheerio');
const { observation, toNumber } = require('../normalize');

const UA = 'infoSalamanca-bot/1.0 (+https://infosalamanca.duckdns.org)';
const MAP_URL = 'https://www.meteoclimatic.net/mapinfo/ESCYL';
const FEED_URL = 'https://www.meteoclimatic.net/feed/rss/ESCYL37';
const PREFIX = 'ESCYL37'; // estaciones de la provincia de Salamanca

const access = () => (['feed', 'mapa'].includes(process.env.METEOCLIMATIC_ACCESO) ? process.env.METEOCLIMATIC_ACCESO : 'off');
const enabled = () => access() !== 'off';

const get = (url) => axios.get(url, { timeout: 30000, responseType: 'arraybuffer', headers: { 'User-Agent': UA } })
  .then(r => Buffer.from(r.data).toString(/iso-8859|latin1|windows-1252/i.test(r.headers['content-type'] || '') ? 'latin1' : 'utf8'));

// "1.017" (millares) y "13,8" (decimal) → número; "x" o vacío → null
const num = (raw) => {
  const s = String(raw ?? '').trim();
  if (!s || /^x$/i.test(s)) return null;
  return toNumber(s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
};
const DIRS = { N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5, S: 180, SSW: 202.5, SSO: 202.5, SW: 225, SO: 225, WSW: 247.5, OSO: 247.5, W: 270, O: 270, WNW: 292.5, ONO: 292.5, NW: 315, NO: 315, NNW: 337.5, NNO: 337.5 };

// Medianoche de Madrid (inicio del "hoy" de máximas, mínimas y lluvia del día) para un instante
function madridMidnight(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(date).map(x => [x.type, x.value]));
  const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
  const offset = local - Math.floor(date.getTime() / 60000) * 60000;
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day) - offset);
}

// Valores de una estación → observaciones comunes. `dayStart`: inicio de los acumulados del día
function toObservations(code, v, observedAt, { approximateTime = false } = {}) {
  const station = `meteoclimatic:${code}`;
  const dayStart = madridMidnight(observedAt);
  const sinceMidnight = Math.max(0, Math.round((observedAt - dayStart) / 60000));
  const rows = [
    ['temperature', v.t, '°C', 'instant', 0],
    ['temperature_max', v.tmax, '°C', 'max', sinceMidnight],
    ['temperature_min', v.tmin, '°C', 'min', sinceMidnight],
    ['relative_humidity', v.h, '%', 'instant', 0],
    ['pressure_msl', v.b, 'hPa', 'instant', 0],
    ['wind_speed', v.w, 'km/h', 'instant', 0],
    ['wind_direction', v.wdir, '°', 'instant', 0],
    ['wind_gust', v.wmax, 'km/h', 'max', sinceMidnight],
    ['precipitation', v.p, 'mm', 'sum', sinceMidnight]
  ];
  return rows.filter(r => r[1] !== null && r[1] !== undefined).map(([variable, value, unit, aggregation, minutes]) => {
    const o = observation({ station, variable, value, unit, aggregation, observedAt, intervalMinutes: minutes, source: 'meteoclimatic' });
    if (approximateTime) o.approximateTime = true; // la tabla no da la hora de cada estación
    return o;
  });
}

// ---------- Tabla pública /mapinfo/ESCYL ----------
// Columnas: estado, observatorio, altitud, T (act, máx, mín), H (act, máx, mín), barómetro (act, máx, mín),
// viento (act "11 W", máx), precipitación (hoy, año), índice
function parseMapTable(html) {
  const $ = cheerio.load(html);
  const stations = [];
  const values = [];
  $('a[href^="/perfil/"]').each((_, a) => {
    const code = ($(a).attr('href') || '').split('/').pop();
    if (!code.startsWith(PREFIX)) return;
    const cells = $(a).closest('tr').find('td').toArray().map(td => $(td));
    if (cells.length < 17) return;
    const text = cells.map(c => c.text().replace(/\s+/g, ' ').trim());
    const online = cells[0].find('[class*="sem_ok"]').length > 0;
    const wind = /^(\d+(?:,\d+)?)\s*([A-Z]+)?/.exec(text[12]) || [];
    stations.push({ code, name: text[1], altitude: num(text[2]), online });
    values.push({ code, online, v: { t: num(text[3]), tmax: num(text[4]), tmin: num(text[5]), h: num(text[6]), b: num(text[9]), w: num(wind[1]), wdir: wind[2] ? DIRS[wind[2]] ?? null : null, wmax: num(text[13]), p: num(text[14]) } });
  });
  return { stations, values };
}

// ---------- RSS (formato documentado) ----------
// [[<código;(T;Tmax;Tmin);(H;Hmax;Hmin);(B;Bmax;Bmin);(W;Wmax);(P);Nombre>]] dentro de cada <item>, con su <pubDate>
function parseFeed(xml) {
  const out = [];
  for (const item of String(xml).split(/<item>/i).slice(1)) {
    const pub = /<pubDate>([^<]+)<\/pubDate>/i.exec(item);
    const at = pub ? new Date(pub[1]) : null;
    const re = /\[\[<([A-Z]{5}\d{13}[A-Z]);\(([^)]*)\);\(([^)]*)\);\(([^)]*)\);\s*\(([^)]*)\);\(([^)]*)\);([^>]*)>\]\]/g;
    let m;
    while ((m = re.exec(item))) {
      const [t, tmax, tmin] = m[2].split(';').map(num);
      const [h] = m[3].split(';').map(num);
      const [b] = m[4].split(';').map(num);
      const [w, wmax] = m[5].split(';').map(num);
      const [p] = m[6].split(';').map(num);
      out.push({ code: m[1], name: m[7].trim(), at: at && !Number.isNaN(at.getTime()) ? at : null, v: { t, tmax, tmin, h, b, w, wdir: null, wmax, p } });
    }
  }
  return out;
}

// Catálogo: nombre y altitud de la tabla pública; la ubicación es la del municipio (aproximada)
async function fetchStations() {
  if (!enabled()) throw Object.assign(new Error('Meteoclimatic desactivado (METEOCLIMATIC_ACCESO=off)'), { code: 'NO_KEY' });
  const { stations } = parseMapTable(await get(MAP_URL));
  return stations.map(s => ({ code: s.code, name: s.name, altitude: s.altitude }));
}

async function fetchLatest(now = new Date()) {
  if (!enabled()) throw Object.assign(new Error('Meteoclimatic desactivado (METEOCLIMATIC_ACCESO=off)'), { code: 'NO_KEY' });
  if (access() === 'feed') {
    return parseFeed(await get(FEED_URL)).filter(r => r.at && r.code.startsWith(PREFIX)).flatMap(r => toObservations(r.code, r.v, r.at));
  }
  // Tabla: solo estaciones en línea; hora = la de la consulta redondeada a 10 min, marcada como aproximada
  const at = new Date(Math.floor(now.getTime() / 600000) * 600000);
  const { values } = parseMapTable(await get(MAP_URL));
  return values.filter(r => r.online).flatMap(r => toObservations(r.code, r.v, at, { approximateTime: true }));
}

module.exports = {
  id: 'meteoclimatic',
  capabilities: ['stations', 'observations'],
  access,
  enabled,
  fetchStations,
  fetchLatest,
  _test: { parseMapTable, parseFeed, toObservations, num, madridMidnight }
};
