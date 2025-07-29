const express = require('express');
const router = express.Router();
const axios = require('axios');
const NodeCache = require('node-cache');

// TTL en segundos (por ejemplo, 1 hora)
const cache = new NodeCache({ stdTTL: 3600 });
const ine_prefix = '../helpers/ine-codigopostal.json';

// GET /api/towns/:townId/events (fetchTownEvents)
router.get('/:townId/events', async (req, res) => {
  const { townId } = req.params;
  const cacheKey = `townEvents_${townId}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  try {
    // Read postal codes for this INE
    const fs = require('fs');
    const path = require('path');
    const inePath = path.resolve(__dirname, '../helpers/ine-codigopostal.json');
    let codigosPostales = [];
    try {
      const raw = fs.readFileSync(inePath, 'utf8');
      const json = JSON.parse(raw);
      codigosPostales = json.filter(item => item.CodMunicipio == townId).map(item => item.CodigoPostal);
    } catch (e) {
      console.error('Error reading ine-codigopostal.json:', e);
    }
    if (!codigosPostales.length) {
      return res.json([]);
    }
    // Fetch events for each postal code
    const eventPromises = codigosPostales.map(async (cp) => {
      const url = `https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/eventos-de-la-agenda-cultural-categorizados-y-geolocalizados/records?limit=20&refine=nombre_provincia%3A%22Salamanca%22&refine=cp%3A%22${cp}%22`;
      try {
        const response = await axios.get(url);
        return response.data.results || [];
      } catch (err) {
        console.error(`Error fetching events for CP ${cp}:`, err.message);
        return [];
      }
    });
    const results = await Promise.all(eventPromises);
    const allEvents = results.flat();
    cache.set(cacheKey, allEvents);
    res.json(allEvents);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching events', details: error.message });
  }
});

// GET /api/towns/:townId/pois (fetchTownPoi)
router.get('/:townId/pois', async (req, res) => {
  const { townId } = req.params;
  const cacheKey = `townPois_${townId}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  try {
    // Read postal codes for this INE
    const fs = require('fs');
    const path = require('path');
    const inePath = path.resolve(__dirname, '../helpers/ine-codigopostal.json');
    let codigosPostales = [];
    try {
      const raw = fs.readFileSync(inePath, 'utf8');
      const json = JSON.parse(raw);
      codigosPostales = json.filter(item => item.CodMunicipio == townId).map(item => item.CodigoPostal);
    } catch (e) {
      console.error('Error reading ine-codigopostal.json:', e);
    }
    if (!codigosPostales.length) {
      return res.json([]);
    }
    // Fetch POIs for each postal code
    const poiPromises = codigosPostales.map(async (cp) => {
      const url = `https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/relacion-monumentos/records?refine=poblacion_provincia%3ASalamanca&refine=codigopostal%3A${cp}`;
      try {
        const response = await axios.get(url);
        return response.data.results || [];
      } catch (err) {
        console.error(`Error fetching POIs for CP ${cp}:`, err.message);
        return [];
      }
    });
    const results = await Promise.all(poiPromises);
    const allPois = results.flat();
    cache.set(cacheKey, allPois);
    res.json(allPois);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching POIs', details: error.message });
  }
});


// GET /api/towns/:townId/info
router.get('/:townId/info', async (req, res) => {
  const { townId } = req.params;
  const cacheKey = `townInfo_${townId}`;

  // 1. Intentar devolver de caché
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    // 2. Llamar a la API externa
    const url = `https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/registro-de-municipios-de-castilla-y-leon/records?order_by=municipio&limit=10&refine=provincia%3A%22SALAMANCA%22&refine=cod_provincia%3A%2237%22&refine=cod_ine%3A%22${townId}%22`;
    const response = await axios.get(url);
    const data = response.data;
    // Leer el JSON de códigos postales
    const fs = require('fs');
    const path = require('path');
    const inePath = path.resolve(__dirname, '../helpers/ine-codigopostal.json');
    let codigosPostales = [];
    try {
      const raw = fs.readFileSync(inePath, 'utf8');
      const json = JSON.parse(raw);
      // Buscar el cod_ine en la respuesta de la API externa
      let codIne = null;
      if (data.results && data.results[0] && data.results[0].cod_ine) {
        codIne = data.results[0].cod_ine;
      } else if (data.cod_ine) {
        codIne = data.cod_ine;
      }
      if (codIne) {
        codigosPostales = json.filter(item => item.CodMunicipio == codIne).map(item => item.CodigoPostal);
      }
    } catch (e) {
      console.error('Error leyendo ine-codigopostal.json:', e);
    }
    data.results[0].cod_postal = codigosPostales;
    // 3. Guardar en caché y devolver
    cache.set(cacheKey, data);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo información del municipio', details: error.message });
  }
});

module.exports = router;
