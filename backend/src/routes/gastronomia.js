const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');
const axios = require('axios');

// Cache de 1 hora
const cache = new NodeCache({ stdTTL: 3600 });

// Municipios de Tierra de Sabor (IDs INE)
const tierraSaborIds = [
'37009'
];

// Endpoint principal: devuelve datos gastronómicos de los municipios Tierra de Sabor
router.get('/', async (req, res) => {
  const cacheKey = 'gastro_tierra_sabor';
  if (cache.has(cacheKey)) {
    return res.json(cache.get(cacheKey));
  }

  try {
    // Ejemplo: para cada municipio, pedir info a la API de la Junta (ajusta endpoint real)
    const results = await Promise.all(
      tierraSaborIds.map(async (ine) => {
        const url = `https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/empresas-acogidas-a-la-marca-tierra-de-sabor/records?refine=provincia%3ASALAMANCA`;
        try {
          const response = await axios.get(url);
          return response.data.results;
        } catch (err) {
          return null;
        }
      })
    );
    const filtered = results.filter(Boolean);
    cache.set(cacheKey, filtered);
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo datos gastronómicos', details: err.message });
  }
});

module.exports = router;
