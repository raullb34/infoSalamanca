// GET /api/gastro: productores Tierra de Sabor de Salamanca con dónde venden.
// Lee la colección tierraSabor (scripts/build-tierra-sabor.js --load-only); sin base de datos, el JSON
// src/data/tierra-sabor.json; y si tampoco, directamente la Junta (todas las páginas, no solo 100).
// Mantiene los campos antiguos (nombre_comercial, c_p, web…) para el panel y el mapa.
const express = require('express');
const fs = require('fs');
const path = require('path');
const NodeCache = require('node-cache');
const axios = require('axios');
const mongoose = require('mongoose');
const TierraSabor = require('../models/tierraSabor');

const router = express.Router();
const cache = new NodeCache({ stdTTL: 3600 });
const JSON_FILE = path.resolve(__dirname, '../data/tierra-sabor.json');

// Ficha para el frontend: los campos de siempre y los nuevos de venta
const toItem = (e) => ({
  idempresa: e.idempresa,
  nombre_comercial: e.nombre,
  direccion: e.direccion,
  c_p: e.cp,
  localidad: e.localidad,
  cod_ine: e.cod_ine,
  // Solo se enlaza la web si funciona
  web: e.web?.estado === 'ok' ? (e.web.final || e.web.url) : null,
  web_estado: e.web?.estado || 'sin web',
  venta: {
    online: e.venta?.online || null,
    dondeComprar: e.venta?.dondeComprar || null,
    telefono: e.venta?.telefono || null,
    email: e.venta?.email || null,
    horario: e.venta?.horario || null,
    redes: e.venta?.redes instanceof Map ? Object.fromEntries(e.venta.redes) : (e.venta?.redes || {})
  },
  secciones: e.secciones || [],
  num_productos: (e.productos || []).length,
  heart_of_spain: !!e.heart_of_spain
});

async function fromJcyl() {
  const out = [];
  for (let offset = 0; offset < 2000; offset += 100) {
    const url = `https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/empresas-acogidas-a-la-marca-tierra-de-sabor/records?refine=provincia%3ASALAMANCA&limit=100&offset=${offset}`;
    const { data } = await axios.get(url, { timeout: 20000 });
    out.push(...(data?.results || []));
    if ((data?.results || []).length < 100) break;
  }
  return out;
}

router.get('/', async (req, res) => {
  const cacheKey = 'gastro_tierra_sabor';
  if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));
  try {
    let items = null;
    if (mongoose.connection.readyState === 1) {
      const docs = await TierraSabor.find().sort({ nombre: 1 }).lean();
      if (docs.length) items = docs.map(toItem);
    }
    if (!items && fs.existsSync(JSON_FILE)) {
      items = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8')).empresas.map(toItem);
    }
    if (!items) items = await fromJcyl();
    cache.set(cacheKey, items);
    res.json(items);
  } catch (err) {
    console.error('Error en gastronomía:', err.message);
    res.status(500).json({ error: 'Error obteniendo datos gastronómicos' });
  }
});

// GET /api/gastro/:id: un productor con todos sus productos (la API de la Junta solo daba 50)
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador no válido' });
  const cacheKey = `gastro_${id}`;
  if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));
  try {
    let e = null;
    if (mongoose.connection.readyState === 1) e = await TierraSabor.findOne({ idempresa: id }).lean();
    if (!e && fs.existsSync(JSON_FILE)) {
      e = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8')).empresas.find(x => x.idempresa === id) || null;
    }
    if (!e) return res.status(404).json({ error: 'Productor no encontrado' });
    const item = {
      ...toItem(e),
      productos: (e.productos || []).map(p => ({
        id: p.id, nombre: p.nombre, marca: p.marca, seccion: p.seccion,
        categoria: p.categoria, variedad: p.variedad, calidad: p.calidad
      }))
    };
    cache.set(cacheKey, item);
    res.json(item);
  } catch (err) {
    console.error('Error en productor Tierra de Sabor:', err.message);
    res.status(500).json({ error: 'Error obteniendo el productor' });
  }
});

module.exports = router;
