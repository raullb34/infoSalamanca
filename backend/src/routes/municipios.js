const express = require('express');
const router = express.Router();
const axios = require('axios');
const NodeCache = require('node-cache');
const fs = require('fs');
const path = require('path');
// TTL en segundos (por ejemplo, 1 hora)
const cache = new NodeCache({ stdTTL: 3600 });

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
    const inePath = path.resolve(__dirname, '../helpers/ine-codigopostal.json');
    let codigosPostales = [];
    let townName = '';
    
    try {
      const raw = fs.readFileSync(inePath, 'utf8');
      const json = JSON.parse(raw);
      
      const townData = json.find(item => item.CodMunicipio == townId);
      if (townData) {
        townName = townData.Municipio;
        codigosPostales = json.filter(item => item.CodMunicipio == townId).map(item => item.CodigoPostal);
      }
    } catch (e) {
      console.error('Error reading ine-codigopostal.json:', e);
    }
    
    if (!codigosPostales.length) {
      return res.json([]);
    }

    // 1. Fetch events from JCYL for each postal code
    const eventPromises = codigosPostales.map(async (cp) => {
      const url = `https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/eventos-de-la-agenda-cultural-categorizados-y-geolocalizados/records?limit=20&refine=nombre_provincia%3A%22Salamanca%22&refine=cp%3A%22${cp}%22`;
      try {
        const response = await axios.get(url);
        const events = response.data.results || [];
        // Añadir fuente a cada evento de JCYL
        return events.map(event => ({
          ...event,
          source: 'jcyl'
        }));
      } catch (err) {
        console.error(`Error fetching events for CP ${cp}:`, err.message);
        return [];
      }
    });

    // 2. Fetch events from Diputación - COMENTADO TEMPORALMENTE
    let diputacionEvents = [];
    /*
    try {
      if (townName) {
        const townNameUpper = townName.toUpperCase();
        const diputacionData = await getDataFromDiputacion(townNameUpper, 100, 0);
        
        if (diputacionData && diputacionData.result && diputacionData.result.records) {
          const records = diputacionData.result.records;
          
          // Formatear eventos de Diputación para que coincidan con la estructura de JCYL
          diputacionEvents = records.map(record => ({
            id: record._id,
            titulo: record.EVENTO || record.TITULO || 'Sin título',
            fecha_inicio: record.FECHA_INICIO,
            fecha_fin: record.FECHA_FIN,
            categoria: record.CATEGORIA || record.TIPO || 'Sin categoría',
            descripcion: record.DESCRIPCION || record.RESUMEN || '',
            lugar: record.LUGAR || record.UBICACION || '',
            municipio: record.MUNICIPIO || townName,
            source: 'diputacion',
            // Mantener los datos originales por si se necesitan
            _original: record
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching events from Diputación:', err.message);
    }
    */

    // 3. Combinar todos los eventos
    const jcylResults = await Promise.all(eventPromises);
    const allJcylEvents = jcylResults.flat();
    const allEvents = [...allJcylEvents, ...diputacionEvents];
    
    cache.set(cacheKey, allEvents);
    res.json(allEvents);
  } catch (error) {
    console.error('Error fetching events:', error.message);
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

// GET /api/towns/codigo-postal/:codigoPostal/ine - Convertir código postal a código INE
router.get('/codigo-postal/:codigoPostal/ine', async (req, res) => {
  const { codigoPostal } = req.params;
  const cacheKey = `codigoPostalToINE_${codigoPostal}`;
  
  // Intentar devolver de caché
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const inePath = path.resolve(__dirname, '../helpers/ine-codigopostal.json');
    
    const raw = fs.readFileSync(inePath, 'utf8');
    const json = JSON.parse(raw);
    
    // Convertir el código postal a número para comparar
    const codigoPostalNumerico = parseInt(codigoPostal, 10);
    
    // Buscar el código postal en el JSON
    const municipio = json.find(item => item.CodigoPostal === codigoPostalNumerico);
    
    if (municipio) {
      const result = { codigoINE: municipio.CodMunicipio };
      cache.set(cacheKey, result);
      res.json(result);
    } else {
      res.status(404).json({ error: `No se encontró código INE para el código postal ${codigoPostal}` });
    }
  } catch (error) {
    console.error('Error convirtiendo código postal a INE:', error);
    res.status(500).json({ error: 'Error convirtiendo código postal a INE', details: error.message });
  }
});

// GET /api/towns/tierra-sabor/:idEmpresa - Obtener productos de Tierra de Sabor por ID de empresa
router.get('/tierra-sabor/:idEmpresa', async (req, res) => {
  const { idEmpresa } = req.params;
  const cacheKey = `tierraSabor_${idEmpresa}`;
  
  // Intentar devolver de caché
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const productos = await getTierraSaborProducts(idEmpresa);
    
    // Guardar en caché por 2 horas (productos cambian menos frecuentemente)
    cache.set(cacheKey, productos, 7200);
    res.json(productos);
  } catch (error) {
    console.error('Error obteniendo productos de Tierra de Sabor:', error);
    res.status(500).json({ error: 'Error obteniendo productos de Tierra de Sabor', details: error.message });
  }
});


// Función comentada temporalmente debido a problemas con la API de Diputación
async function getDataFromDiputacion(town, limit = 100, offset = 0, fecha = null) {
  // API de Diputación deshabilitada temporalmente
  return { result: { records: [] } };
  
  /*
  try {
    // Calcular el rango de fechas: desde hoy hasta 3 meses después
    const fechaInicio = new Date();
    const fechaFin = new Date();
    fechaFin.setMonth(fechaFin.getMonth() + 3);
    
    const fechaInicioStr = fechaInicio.toISOString().split('T')[0] + 'T00:00:00';
    const fechaFinStr = fechaFin.toISOString().split('T')[0] + 'T23:59:59';
    
    const url = 'https://datosabiertossalamanca.es/api/3/action/datastore_search';
    
    const requestBody = {
      resource_id: "f1457e41-9ea3-4dae-8f5f-31a2b419b5fd",
      q: "",
      filters: {},
      limit: limit,
      offset: offset
    };

    if (town) {
      requestBody.filters.MUNICIPIO = [town];
    }

    requestBody.sql = `SELECT * FROM "f1457e41-9ea3-4dae-8f5f-31a2b419b5fd" WHERE "FECHA_INICIO" >= '${fechaInicioStr}' AND "FECHA_INICIO" <= '${fechaFinStr}'${town ? ` AND "MUNICIPIO" = '${town}'` : ''} LIMIT ${limit} OFFSET ${offset}`;

    const response = await axios.post(url, requestBody, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return response.data;
    
  } catch (error) {
    console.error('Error llamando a la API de Diputación:', error.message);
    throw error;
  }
  */
}

// Función para obtener productos de Tierra de Sabor por establecimiento
async function getTierraSaborProducts(establecimiento, limit = 50) {
  try {
    const url = 'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/productos-de-la-marca-tierra-de-sabor/records';
    
    const params = new URLSearchParams({
      limit: limit.toString(),
      refine: `id_empresa:"${establecimiento}"`
    });
    
    const response = await axios.get(`${url}?${params}`);
    
    if (response.data && response.data.results) {
      return response.data.results.map(item => ({
        id: item.record.recordid,
        nombre: item.record.fields.producto || 'Producto sin nombre',
        establecimiento: item.record.fields.empresa || item.record.fields.establecimiento,
        municipio: item.record.fields.municipio,
        provincia: item.record.fields.provincia,
        telefono: item.record.fields.telefono,
        email: item.record.fields.email,
        web: item.record.fields.web,
        direccion: item.record.fields.direccion,
        codigo_postal: item.record.fields.codigo_postal,
        categoria: item.record.fields.categoria_producto || item.record.fields.categoria,
        descripcion: item.record.fields.descripcion,
        coordenadas: item.record.fields.coordenadas,
        id_empresa: item.record.fields.id_empresa
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error obteniendo productos de Tierra de Sabor:', error.message);
    return [];
  }
}

module.exports = router;
