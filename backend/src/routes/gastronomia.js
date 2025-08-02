const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');
const axios = require('axios');

// Cache de 1 hora
const cache = new NodeCache({ stdTTL: 3600 });

// Municipios de Tierra de Sabor (IDs INE)
const tierraSaborIds = [];

// Endpoint principal: devuelve datos gastronómicos de los municipios Tierra de Sabor
router.get('/', async (req, res) => {
  const cacheKey = 'gastro_tierra_sabor';
  if (cache.has(cacheKey)) {
    return res.json(cache.get(cacheKey));
  }

  try {
    // Hacer una sola llamada a la API sin filtrar por municipio específico
    const url = `https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/empresas-acogidas-a-la-marca-tierra-de-sabor/records?refine=provincia%3ASALAMANCA&limit=100`;
    console.log('Llamando a URL:', url);
    
    const response = await axios.get(url);
    console.log('Respuesta recibida, status:', response.status);
    console.log('Número de registros:', response.data?.results?.length || 0);
    
    const results = response.data?.results || [];
    cache.set(cacheKey, results);
    res.json(results);
  } catch (err) {
    console.error('Error en gastronomía:', err.message);
    res.status(500).json({ error: 'Error obteniendo datos gastronómicos', details: err.message });
  }
});

module.exports = router;
