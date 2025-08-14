const express = require('express');
const router = express.Router();
const axios = require('axios');
const NodeCache = require('node-cache');
const fs = require('fs');
const path = require('path');
const { scrapeEventsDiputacion, scrapeEventDetailDiputacion } = require('../helpers/diputacionScraper');
// TTL en segundos (por ejemplo, 1 hora)
const cache = new NodeCache({ stdTTL: 3600 });

/**
 * Obtiene eventos de JCYL para un municipio específico
 * @param {string} townId - Código INE del municipio
 * @returns {Array} Array de eventos de JCYL
 */
async function getJCYLEvents(townId) {
  try {
    // Leer códigos postales para este INE
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
      return [];
    }

    // Fetch eventos de JCYL para cada código postal
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

    const jcylResults = await Promise.all(eventPromises);
    return jcylResults.flat();
    
  } catch (error) {
    console.error('Error obteniendo eventos JCYL:', error.message);
    return [];
  }
}

// GET /api/towns/:townId/events (fetchTownEvents)
router.get('/:townId/events', async (req, res) => {
  const { townId } = req.params;
  const cacheKey = `townEvents_${townId}`;
  
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    // Obtener eventos JCYL para el municipio
    const jcylEvents = await getJCYLEvents(townId);
    
    cache.set(cacheKey, jcylEvents);
    res.json(jcylEvents);
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
  
  console.log(`🔍 Solicitando productos para empresa ID: ${idEmpresa}`);
  
  // Intentar devolver de caché
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`📦 Devolviendo desde caché para empresa ${idEmpresa}`);
    return res.json(cached);
  }

  try {
    const productos = await getTierraSaborProducts(idEmpresa);
    
    // Guardar en caché por 2 horas (productos cambian menos frecuentemente)
    cache.set(cacheKey, productos, 7200);
    
    console.log(`✅ Devolviendo ${productos.length} productos para empresa ${idEmpresa}`);
    res.json({
      success: true,
      count: productos.length,
      idEmpresa: idEmpresa,
      data: productos
    });
  } catch (error) {
    console.error('❌ Error obteniendo productos de Tierra de Sabor:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error obteniendo productos de Tierra de Sabor', 
      details: error.message,
      idEmpresa: idEmpresa
    });
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
    console.log(`🔍 Buscando productos para establecimiento: ${establecimiento}`);
    
    const baseUrl = 'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/productos-de-la-marca-tierra-de-sabor/records';
    // Encodear correctamente: id_empresa = 1007 -> id_empresa%20%3D%20{id}
    const whereClause = encodeURIComponent(`idempresa = ${establecimiento}`);
    const fullUrl = `${baseUrl}?where=${whereClause}&limit=${limit}`;
    
    console.log(`📡 URL completa: ${fullUrl}`);
    
    const response = await axios.get(fullUrl);
    console.log(`📊 Respuesta recibida:`, response.data);

    if (response.data && response.data.results.length > 0) {
      const productos = response.data.results.map(item => {

        return {
          id: item.idproducto || null,
          nombre: item.producto || item.nombre_producto || 'Producto sin nombre',
          seccion: item.seccion,
          categoria: item.categoria,
          variedad: item.variedad,
          figurascalidad: item.figurascalidad,
          idempresa: item.idempresa
        };
      });
      
      console.log(`✅ ${productos.length} productos encontrados`);
      return productos;
    }
    
    console.log(`⚠️ No se encontraron resultados en response.data.results`);
    return [];
  } catch (error) {
    console.error('❌ Error obteniendo productos de Tierra de Sabor:', error.message);
    console.error('Detalles del error:', error.response?.data || error);
    return [];
  }
}

// GET /api/towns/teatro - Obtener eventos de teatro de toda la provincia de Salamanca
router.get('/teatro', async (req, res) => {
  const cacheKey = 'teatroEvents';
  
  console.log('🎭 Solicitando eventos de teatro de Salamanca');
  
  // Intentar devolver de caché
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('📦 Devolviendo eventos de teatro desde caché');
    return res.json(cached);
  }

  try {
    const url = 'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/eventos-de-la-agenda-cultural-categorizados-y-geolocalizados/records?limit=100&refine=nombre_provincia%3A%22Salamanca%22&refine=categoria%3A%22Espect%C3%A1culos%22';
    
    console.log(`📡 URL: ${url}`);
    
    const response = await axios.get(url);
    console.log(`📊 Respuesta recibida:`, response.data);

    if (response.data && response.data.results) {
      const eventos = response.data.results.map(item => {
        return {
          id: item.id || null,
          titulo: item.titulo || item.nombre || 'Evento sin título',
          fecha_inicio: item.fecha_inicio,
          fecha_fin: item.fecha_fin,
          categoria: item.categoria,
          subcategoria: item.subcategoria,
          descripcion: item.descripcion,
          lugar: item.lugar,
          direccion: item.direccion,
          municipio: item.municipio,
          nombre_provincia: item.nombre_provincia,
          cp: item.cp,
          telefono: item.telefono,
          email: item.email,
          web: item.web,
          precio: item.precio,
          organizador: item.organizador,
          coordenadas: item.coordenadas,
          source: 'jcyl_teatro'
        };
      });
      
      // Guardar en caché por 30 minutos (eventos pueden cambiar)
      cache.set(cacheKey, eventos, 1800);
      
      console.log(`✅ Devolviendo ${eventos.length} eventos de teatro`);
      res.json({
        success: true,
        count: eventos.length,
        categoria: 'Espectáculos/Teatro',
        data: eventos
      });
    } else {
      console.log('⚠️ No se encontraron eventos de teatro');
      res.json({
        success: true,
        count: 0,
        categoria: 'Espectáculos/Teatro',
        data: []
      });
    }
  } catch (error) {
    console.error('❌ Error obteniendo eventos de teatro:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error obteniendo eventos de teatro', 
      details: error.message,
      categoria: 'Espectáculos/Teatro'
    });
  }
});

// GET /api/towns/list - Obtener lista de todos los municipios de Salamanca
router.get('/list', async (req, res) => {
  const cacheKey = 'municipiosList';
  
  console.log('🏘️ Solicitando lista de municipios de Salamanca');
  
  // Intentar devolver de caché
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('📦 Devolviendo lista de municipios desde caché');
    return res.json(cached);
  }

  try {
    // Leer el archivo JSON con los códigos INE y municipios
    const inePath = path.resolve(__dirname, '../helpers/ine-codigopostal.json');
    const raw = fs.readFileSync(inePath, 'utf8');
    const data = JSON.parse(raw);
    
    // Crear un mapa único de municipios (evitar duplicados)
    const municipiosMap = new Map();
    
    data.forEach(item => {
      if (!municipiosMap.has(item.CodMunicipio)) {
        municipiosMap.set(item.CodMunicipio, {
          id: item.CodMunicipio.toString(),
          name: item.Municipio,
          province: 'Salamanca'
        });
      }
    });
    
    // Convertir Map a Array y ordenar alfabéticamente
    const municipios = Array.from(municipiosMap.values()).sort((a, b) => 
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    );
    
    // Guardar en caché por 24 horas (los municipios no cambian)
    cache.set(cacheKey, municipios, 86400);
    
    console.log(`✅ Devolviendo ${municipios.length} municipios`);
    res.json({
      success: true,
      count: municipios.length,
      data: municipios
    });
  } catch (error) {
    console.error('❌ Error obteniendo lista de municipios:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error obteniendo lista de municipios', 
      details: error.message
    });
  }
});

// ==========================================
// RUTAS DE EVENTOS DIPUTACIÓN
// ==========================================

// GET /api/towns/diputacion/events - Obtener eventos de la Diputación
router.get('/diputacion/events', async (req, res) => {
  const { municipio, maxPages = 42 } = req.query;  // Por defecto 42 páginas
  const cacheKey = `diputacion-events-${municipio || 'all'}-${maxPages}`;
  
  console.log(`🏛️ Solicitando eventos Diputación ${municipio ? `para ${municipio}` : '(todos)'} - ${maxPages} páginas`)
  
  // Intentar devolver de caché (30 minutos para eventos)
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('📦 Devolviendo eventos Diputación desde caché');
    return res.json(cached);
  }

  try {
    const events = await scrapeEventsDiputacion(municipio, parseInt(maxPages));
    
    const response = {
      success: true,
      count: events.length,
      data: events,
      source: 'diputacion',
      municipio: municipio || 'todos',
      maxPages: parseInt(maxPages),
      timestamp: new Date().toISOString()
    };
    
    // Guardar en caché por 30 minutos
    cache.set(cacheKey, response, 1800);
    
    console.log(`✅ Devolviendo ${events.length} eventos de Diputación`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error obteniendo eventos Diputación:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error obteniendo eventos de la Diputación', 
      details: error.message
    });
  }
});

// GET /api/towns/diputacion/events/:activityId - Obtener detalle de un evento específico
router.get('/diputacion/events/:activityId', async (req, res) => {
  const { activityId } = req.params;
  const cacheKey = `diputacion-event-detail-${activityId}`;
  
  console.log(`🏛️ Solicitando detalle evento Diputación ${activityId}`);
  
  // Intentar devolver de caché (1 hora para detalles)
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('📦 Devolviendo detalle evento desde caché');
    return res.json(cached);
  }

  try {
    const eventDetail = await scrapeEventDetailDiputacion(activityId);
    
    if (!eventDetail) {
      return res.status(404).json({
        success: false,
        error: 'Evento no encontrado'
      });
    }
    
    const response = {
      success: true,
      data: eventDetail,
      source: 'diputacion',
      timestamp: new Date().toISOString()
    };
    
    // Guardar en caché por 1 hora
    cache.set(cacheKey, response, 3600); 
    
    console.log(`✅ Devolviendo detalle evento ${activityId}`);
    res.json(response);
    
  } catch (error) {
    console.error(`❌ Error obteniendo detalle evento ${activityId}:`, error);
    res.status(500).json({ 
      success: false,
      error: 'Error obteniendo detalle del evento', 
      details: error.message
    });
  }
});

// GET /api/towns/:townId/events/combined - Obtener eventos combinados (JCYL + Diputación)
router.get('/:townId/events/combined', async (req, res) => {
  const { townId } = req.params;
  const cacheKey = `combined-events-${townId}`;
  
  console.log(`🔄 Solicitando eventos combinados para ${townId}`);
  
  // Intentar devolver de caché (20 minutos)
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('📦 Devolviendo eventos combinados desde caché');
    return res.json(cached);
  }

  try {
    // Obtener nombre del municipio para el scraper de Diputación
    let townName = '';
    try {
      const inePath = path.resolve(__dirname, '../helpers/ine-codigopostal.json');
      const raw = fs.readFileSync(inePath, 'utf8');
      const json = JSON.parse(raw);
      const townData = json.find(item => item.CodMunicipio == townId);
      if (townData) {
        townName = townData.Municipio;
      }
    } catch (e) {
      console.error('Error reading town name:', e);
    }
    
    // Obtener eventos JCYL (usando función existente)
    let jcylEvents = [];
    try {
      jcylEvents = await getJCYLEvents(townId);
      console.log(`✅ JCYL Events obtenidos: ${jcylEvents.length}`);
    } catch (jcylError) {
      console.warn('⚠️ Error obteniendo eventos JCYL:', jcylError.message);
    }
    
    // Obtener eventos Diputación para el municipio
    let diputacionEvents = [];
    try {
      if (townName) {
        diputacionEvents = await scrapeEventsDiputacion(townName); // Sin límite de páginas, usará 42 por defecto
        console.log(`✅ Diputación Events obtenidos: ${diputacionEvents.length}`);
      }
    } catch (dipError) {
      console.warn('⚠️ Error obteniendo eventos Diputación:', dipError.message);
    }
    
    // Combinar todos los eventos en un solo array (como espera el frontend)
    const allEvents = [
      ...jcylEvents,  // Ya tienen source: 'jcyl'
      ...diputacionEvents  // Ya tienen source: 'diputacion'
    ];
    
    console.log(`📊 Total eventos combinados: ${allEvents.length} (JCYL: ${jcylEvents.length}, Diputación: ${diputacionEvents.length})`);
    
    // Guardar en caché por 20 minutos
    cache.set(cacheKey, allEvents, 1200);
    
    // Devolver en el formato que espera el frontend (array directo, como la ruta original)
    res.json(allEvents);
    
  } catch (error) {
    console.error('❌ Error obteniendo eventos combinados:', error);
    res.status(500).json({ 
      error: 'Error obteniendo eventos combinados', 
      details: error.message
    });
  }
});

module.exports = router;
