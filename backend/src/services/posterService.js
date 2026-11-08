// Carteles de fiestas: alta de candidatos, aprobación y copia local de la imagen.
const crypto = require('crypto');
const dns = require('dns').promises;
const fs = require('fs');
const net = require('net');
const path = require('path');
const axios = require('axios');
const FestivalPoster = require('../models/festivalPoster');

const POSTERS_DIR = process.env.POSTERS_DIR || path.resolve(__dirname, '../../uploads/posters');
const PUBLIC_PREFIX = '/api/posters/img/';
const MAX_BYTES = 15 * 1024 * 1024;
const USER_AGENT = 'infoSalamanca-bot/1.0 (+https://infosalamanca.duckdns.org)';

// ---------- Enlaces ----------

function sourceOf(url) {
  const host = new URL(url).hostname.replace(/^(www|m|web|mbasic)\./, '');
  if (/(^|\.)facebook\.com$|(^|\.)fb\.(com|watch)$/.test(host)) return 'facebook';
  if (/(^|\.)instagram\.com$/.test(host)) return 'instagram';
  return 'web';
}

// Quita parámetros de seguimiento para que el mismo enlace no se guarde dos veces
function normalizeUrl(raw) {
  const u = new URL(String(raw).trim());
  if (!/^https?:$/.test(u.protocol)) throw new Error('Solo enlaces http(s)');
  u.hash = '';
  for (const k of [...u.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|mibextid|__cft__|__tn__|ref|rdid|igsh|share_url)/i.test(k)) u.searchParams.delete(k);
  }
  if (sourceOf(u.href) === 'facebook') {
    u.hostname = 'www.facebook.com';
    // ".../posts/titulo-de-la-publicacion/1541597191342088/" → ".../posts/1541597191342088":
    // el incrustado de Facebook solo reconoce la forma corta
    const m = u.pathname.match(/^\/([^/]+)\/posts\/(?:[^/]+\/)?(\d+|pfbid\w+)\/?$/);
    if (m) { u.pathname = `/${m[1]}/posts/${m[2]}`; u.search = ''; }
  }
  return u.href;
}

// ---------- Descargas seguras (no se puede pedir nada de la red interna) ----------

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

async function assertPublicUrl(url) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error('Solo enlaces http(s)');
  const addrs = await dns.lookup(u.hostname, { all: true });
  if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) throw new Error(`Dirección no permitida: ${u.hostname}`);
}

// GET con redirecciones revisadas una a una
async function safeGet(url, { responseType = 'text', maxBytes = MAX_BYTES, timeout = 20000 } = {}) {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicUrl(current);
    const res = await axios.get(current, {
      responseType, timeout, maxRedirects: 0, maxContentLength: maxBytes,
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'es-ES,es;q=0.9' },
      validateStatus: s => s < 400
    });
    if (res.status >= 300 && res.headers.location) {
      current = new URL(res.headers.location, current).href;
      continue;
    }
    return { data: res.data, headers: res.headers, url: current };
  }
  throw new Error('Demasiadas redirecciones');
}

// ---------- Imagen propia: copia (máx. 1600 px) y miniatura (480 px), en WebP ----------

async function storeImage(imageUrl, codIne, year) {
  const { data, headers } = await safeGet(imageUrl, { responseType: 'arraybuffer' }).catch(err => {
    const code = err.response?.status;
    throw new Error(code ? `No se pudo descargar la imagen (error ${code})` : err.message);
  });
  const sharp = require('sharp'); // solo se carga al aprobar
  const type = String(headers['content-type'] || '');
  if (!/^image\//.test(type) || /svg/.test(type)) throw new Error(`No es una imagen válida (${type || 'sin tipo'})`);
  const input = Buffer.from(data);
  const meta = await sharp(input).metadata();
  if (!meta.width || meta.width < 200) throw new Error('Imagen demasiado pequeña para ser un cartel');

  fs.mkdirSync(POSTERS_DIR, { recursive: true });
  const id = crypto.createHash('sha1').update(input).digest('hex').slice(0, 10);
  const base = `${codIne}-${year || 'sin-anio'}-${id}`;
  await sharp(input).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 }).toFile(path.join(POSTERS_DIR, `${base}.webp`));
  await sharp(input).rotate().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 75 }).toFile(path.join(POSTERS_DIR, `${base}-thumb.webp`));
  return { image: `${PUBLIC_PREFIX}${base}.webp`, thumb: `${PUBLIC_PREFIX}${base}-thumb.webp` };
}

function removeStoredImages(poster) {
  for (const p of [poster.image, poster.thumb]) {
    if (!p || !p.startsWith(PUBLIC_PREFIX)) continue;
    const file = path.join(POSTERS_DIR, path.basename(p));
    fs.rm(file, { force: true }, () => {});
  }
}

// ---------- Altas y revisión ----------

// Guarda un candidato si ese enlace no estaba ya (no toca los ya revisados)
async function addCandidate(data) {
  const source_url = normalizeUrl(data.source_url);
  const doc = {
    cod_ine: String(data.cod_ine),
    municipality_name: data.municipality_name,
    year: data.year || undefined,
    source: sourceOf(source_url),
    source_url,
    // De Facebook/Instagram solo se guarda el enlace: la ficha incrusta la publicación
    image_url: data.image_url && sourceOf(source_url) === 'web' ? new URL(data.image_url, source_url).href : null,
    title: data.title ? String(data.title).slice(0, 300) : undefined,
    snippet: data.snippet ? String(data.snippet).slice(0, 600) : undefined,
    found_by: data.found_by || 'manual',
    query: data.query,
    score: data.score
  };
  const res = await FestivalPoster.updateOne(
    { cod_ine: doc.cod_ine, source_url, image_url: doc.image_url },
    { $setOnInsert: doc },
    { upsert: true }
  );
  return { created: res.upsertedCount > 0, source_url, image_url: doc.image_url };
}

async function approve(id, { year, image_url } = {}) {
  const poster = await FestivalPoster.findById(id);
  if (!poster) throw new Error('Cartel no encontrado');
  if (year) poster.year = Number(year);
  if (!poster.year) throw new Error('Falta el año del cartel');
  if (image_url && poster.source === 'web') poster.image_url = new URL(image_url, poster.source_url).href;
  if (poster.source === 'web') {
    if (!poster.image_url) throw new Error('Falta la URL de la imagen del cartel');
    removeStoredImages(poster);
    Object.assign(poster, await storeImage(poster.image_url, poster.cod_ine, poster.year));
  }
  poster.status = 'approved';
  poster.reviewed_at = new Date();
  await poster.save();
  return poster.toObject();
}

async function reject(id) {
  const poster = await FestivalPoster.findByIdAndUpdate(id, { status: 'rejected', reviewed_at: new Date() }, { new: true }).lean();
  if (!poster) throw new Error('Cartel no encontrado');
  return poster;
}

async function remove(id) {
  const poster = await FestivalPoster.findByIdAndDelete(id).lean();
  if (poster) removeStoredImages(poster);
  return poster;
}

const list = (status = 'pending') =>
  FestivalPoster.find(status === 'all' ? {} : { status }).sort({ score: -1, found_at: -1 }).limit(500).lean();

// Carteles aprobados de un pueblo, el más reciente primero (lo que ve la ficha)
const forTown = (codIne) =>
  FestivalPoster.find({ cod_ine: String(codIne), status: 'approved' })
    .sort({ year: -1, reviewed_at: -1 })
    .select('year source source_url image thumb title')
    .lean();

module.exports = {
  POSTERS_DIR, USER_AGENT, sourceOf, normalizeUrl, isPrivateIp, safeGet,
  addCandidate, approve, reject, remove, list, forTown
};
