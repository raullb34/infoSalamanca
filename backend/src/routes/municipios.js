const express = require('express');
const router = express.Router();
const axios = require('axios');
const NodeCache = require('node-cache');
const fs = require('fs');
const path = require('path');
const { scrapeEventsDiputacion, scrapeEventDetailDiputacion } = require('../helpers/diputacionScraper');
const municipalInfoService = require('../services/municipalInfoService');
const { upcomingSorted } = require('../helpers/eventDates');
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

// GET /api/towns/bibliobus/points - Obtener relación de puntos de servicio móvil (bibliobuses) en Salamanca
router.get('/bibliobus/points', async (req, res) => {
  const { maxPages = 10 } = req.query;
  const pageSize = 80; // < 100 por requisito
  const cacheKey = `bibliobus-points-salamanca-${pageSize}-${maxPages}`;

  console.log('🚌 Solicitando puntos de bibliobuses de Salamanca');

  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('📦 Devolviendo puntos de bibliobuses desde caché');
    return res.json(cached);
  }

  try {
    // Mapa municipio -> cod_ine
    const inePath = path.resolve(__dirname, '../helpers/ine-codigopostal.json');
    const raw = fs.readFileSync(inePath, 'utf8');
    const ineJson = JSON.parse(raw);
    const municipioToIne = new Map();
    ineJson.forEach(item => {
      const name = (item.Municipio || '').toString().trim().toUpperCase();
      if (name && !municipioToIne.has(name)) {
        municipioToIne.set(name, item.CodMunicipio.toString());
      }
    });

    const baseUrl = 'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/relacion-de-puntos-de-servicio-movil-de-los-bibliobuses-de-castilla-y-leon/records';

    let all = [];
    let offset = 0;
    let page = 0;
    console.log(`📡 Descargando bibliobuses (puntos) por páginas: pageSize=${pageSize}, maxPages=${maxPages}`);
    while (page < parseInt(maxPages)) {
      // No refina por provincia (no soportado). Se filtrará por CP -> INE posteriormente
      const url = `${baseUrl}?limit=${pageSize}&offset=${offset}`;
      console.log(`📡 Fetch page ${page + 1}: ${url}`);
      const response = await axios.get(url);
      const results = response.data?.results || [];
      all = all.concat(results);
      if (results.length < pageSize) {
        console.log(`📥 Página final recibida (size=${results.length}).`);
        break;
      }
      page += 1;
      offset += pageSize;
    }

    // Transformar y filtrar a Salamanca usando el código postal del punto
    const cpToMunicipio = new Map();
    ineJson.forEach(item => {
      const cp = item.CodigoPostal;
      if (!cpToMunicipio.has(cp)) {
        cpToMunicipio.set(cp, { municipio: item.Municipio, cod_ine: item.CodMunicipio.toString() });
      }
    });

    const parseFechas = (fechasStr) => {
      if (!fechasStr || typeof fechasStr !== 'string') return []
      const parts = fechasStr.split(/[#;,]+/).map(s => s.trim()).filter(Boolean)
      const dates = []
      for (const p of parts) {
        // formatos esperados: dd/MM/yyyy
        const m = p.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
        if (m) {
          const dd = parseInt(m[1], 10)
          const mm = parseInt(m[2], 10) - 1
          const yyyy = parseInt(m[3], 10)
          const d = new Date(yyyy, mm, dd)
          if (!isNaN(d.getTime())) dates.push(d)
        }
      }
      return dates
    }

    const getNextDate = (dates) => {
      if (!dates || dates.length === 0) return null
      const today = new Date()
      today.setHours(0,0,0,0)
      const future = dates.filter(d => d.getTime() >= today.getTime())
      if (future.length === 0) return null
      future.sort((a,b) => a - b)
      return future[0]
    }

    const formatDia = (dateObj, periodicidadText) => {
      if (dateObj) {
        const dd = String(dateObj.getDate()).padStart(2,'0')
        const mm = String(dateObj.getMonth()+1).padStart(2,'0')
        const yyyy = dateObj.getFullYear()
        const dow = dateObj.toLocaleDateString('es-ES', { weekday: 'long' })
        return `${dd}/${mm}/${yyyy} (${dow})`
      }
      if (periodicidadText) {
        // Ej: "Mensual (jueves)" -> jueves
        const m = periodicidadText.match(/\(([^)]+)\)/)
        return m ? m[1] : periodicidadText
      }
      return ''
    }

    const buildHora = (llegada, salida) => {
      const inStr = (llegada || '').toString().trim()
      const outStr = (salida || '').toString().trim()
      if (inStr && outStr) return `${inStr}-${outStr}`
      return inStr || outStr || ''
    }

    const items = all
      .map(item => {
        // Intentar detectar campo de CP en múltiples variantes
        const rawCp = item.cp ?? item.codigo_postal ?? item.codigopostal ?? item.c_postal ?? item.codigoPostal ?? item.cp_punto ?? item.codigo_postal_punto ?? item.cp_localidad ?? null;
        let cp = rawCp != null ? parseInt(rawCp, 10) : null;
        
        // Si no hay CP, intentar inferir del municipio
        let mapped = (cp && cpToMunicipio.has(cp)) ? cpToMunicipio.get(cp) : null;
        
        if (!mapped && item.municipio) {
          // Buscar por nombre de municipio
          const muniNombre = item.municipio.toString().trim().toUpperCase();
          const foundIne = ineJson.find(ine => ine.Municipio.toUpperCase() === muniNombre);
          if (foundIne) {
            mapped = { municipio: foundIne.Municipio, cod_ine: foundIne.CodMunicipio.toString() };
            cp = foundIne.CodigoPostal;
          }
        }

        const municipioNombre = mapped?.municipio || (item.municipio || item.localidad || item.poblacion || '').toString();
        const localidad = (item.localidad || item.pedania || item.entidad || '').toString();
        // Calcular día y hora a partir de campos: periodicidad, horallegada, horasalida, fechasparadas_nuevo
        const periodicidad = (item.periodicidad || '').toString();
        const fechasParadasStr = (item.fechasparadas_nuevo || item.fechas || item.fechas_paradas || '').toString();
        const llegada = item.horallegada || item.hora_llegada || item.hora || item.horario || item.hora_visita || '';
        const salida = item.horasalida || item.hora_salida || '';
        const fechas = parseFechas(fechasParadasStr);
        const nextDate = getNextDate(fechas);
        const dia = formatDia(nextDate, periodicidad);
        const hora = buildHora(llegada, salida);
        const bibliobus = (item.bibliobus || item.numero_bibliobus || item.ruta || '').toString();
        const lugar = (item.lugar || item.punto_servicio || item.ubicacion || '').toString();

        const cod_ine = mapped?.cod_ine || null;

        return {
          municipio: municipioNombre,
          cod_ine,
          cp,
          localidad,
          lugar,
          dia,
          hora,
          bibliobus,
          llegada: llegada?.toString() || '',
          salida: salida?.toString() || '',
          nextDate: nextDate ? nextDate.toISOString() : null
        };
      })
      // Quedarse solo con los que mapean a un CP salmantino (INE presente)
      .filter(it => !!it.cod_ine);

    // Agrupar por municipio
    const groupsMap = new Map();
    items.forEach(it => {
      const key = it.cod_ine || it.municipio;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          municipio: it.municipio,
          cod_ine: it.cod_ine,
          count: 0,
          stops: []
        });
      }
      const g = groupsMap.get(key);
      g.count += 1;
      g.stops.push({
        localidad: it.localidad,
        lugar: it.lugar,
        dia: it.dia,
        hora: it.hora,
        bibliobus: it.bibliobus
      });
    });

    const grouped = Array.from(groupsMap.values()).sort((a, b) =>
      (a.municipio || '').localeCompare(b.municipio || '', 'es', { sensitivity: 'base' })
    );

    // Agrupar por ruta de bibliobús con TODAS las paradas
    const rutasMap = new Map();
    items.forEach(it => {
      const ruta = it.bibliobus || 'Sin ruta';
      if (!rutasMap.has(ruta)) {
        rutasMap.set(ruta, { ruta, stops: [] });
      }
      rutasMap.get(ruta).stops.push({
        municipio: it.municipio,
        cod_ine: it.cod_ine,
        localidad: it.localidad,
        lugar: it.lugar,
        dia: it.dia,
        hora: it.hora,
        nextDate: it.nextDate,
        cp: it.cp
      });
    });

    const groupedByRuta = Array.from(rutasMap.values()).map(r => {
      // Ordenar paradas por fecha
      const stopsWithDates = r.stops.filter(s => s.nextDate).sort((a,b) => new Date(a.nextDate) - new Date(b.nextDate));
      const stopsWithoutDates = r.stops.filter(s => !s.nextDate);
      const sortedStops = [...stopsWithDates, ...stopsWithoutDates];
      
      return {
        ruta: r.ruta,
        stopsCount: r.stops.length,
        stops: sortedStops, // TODAS las paradas ordenadas
        nextStop: stopsWithDates.length > 0 ? stopsWithDates[0] : null
      }
    }).sort((a,b) => {
      // Ordenar rutas numéricamente si es posible
      const numA = parseInt(a.ruta.match(/\d+/)?.[0] || '999', 10);
      const numB = parseInt(b.ruta.match(/\d+/)?.[0] || '999', 10);
      if (numA !== numB) return numA - numB;
      return a.ruta.localeCompare(b.ruta);
    });

    const payload = {
      success: true,
      count: items.length,
      groupsCount: grouped.length,
      data: items,
      groupedByMunicipio: grouped,
      groupedByRuta,
      pageCount: page + 1,
      timestamp: new Date().toISOString()
    };

    cache.set(cacheKey, payload, 21600); // 6 horas
    console.log(`✅ Devolviendo ${items.length} puntos en ${grouped.length} municipios`);
    return res.json(payload);
  } catch (error) {
    console.error('❌ Error obteniendo puntos de bibliobuses:', error.message || error);
    return res.status(500).json({
      success: false,
      error: 'Error obteniendo puntos de bibliobuses',
      details: error.message
    });
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
    
    // Transform POIs to extract municipio from poblacion JSON string
    const transformedPois = allPois.map(poi => {
      if (poi.poblacion && typeof poi.poblacion === 'string') {
        try {
          const poblacionData = JSON.parse(poi.poblacion);
          return {
            ...poi,
            poblacion: poblacionData.municipio || poblacionData.localidad || poi.poblacion
          };
        } catch (e) {
          // If parsing fails, keep original value
          return poi;
        }
      }
      return poi;
    });
    
    cache.set(cacheKey, transformedPois);
    res.json(transformedPois);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching POIs', details: error.message });
  }
});


// GET /api/towns/:townId/info
// GET /api/towns/:townId/historia - Resumen e historia desde Wikipedia
// (src/data/historia.json, lo genera scripts/build-historia.js)
let historiaData = null;
router.get('/:townId/historia', (req, res) => {
  if (!historiaData) {
    historiaData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/historia.json'), 'utf8'));
  }
  const ine = String(req.params.townId).split('_')[0];
  const entry = historiaData[ine];
  if (!entry) return res.status(404).json({ error: 'Sin historia para este municipio' });
  res.set('Cache-Control', 'public, max-age=86400');
  res.json(entry);
});

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

// GET /api/towns/libraries - Obtener bibliotecas, bibliobuses y puntos móviles (provincia Salamanca)
router.get('/libraries', async (req, res) => {
  const { maxPages = 10 } = req.query;
  const pageSize = 80; // mantener por debajo de 100
  const cacheKey = `libraries-salamanca-${pageSize}-${maxPages}`;

  console.log('📚 Solicitando bibliotecas y bibliobuses de Salamanca');

  // Intentar devolver de caché (6 horas)
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('📦 Devolviendo bibliotecas desde caché');
    return res.json(cached);
  }

  try {
    // Cargar el JSON de códigos INE para mapear nombres -> cod_ine
    const inePath = path.resolve(__dirname, '../helpers/ine-codigopostal.json');
    const raw = fs.readFileSync(inePath, 'utf8');
    const ineJson = JSON.parse(raw);

    // Crear mapa de municipio (upper) -> cod_ine
    const municipioToIne = new Map();
    ineJson.forEach(item => {
      const name = (item.Municipio || '').toString().trim().toUpperCase();
      if (name && !municipioToIne.has(name)) {
        municipioToIne.set(name, item.CodMunicipio.toString());
      }
    });

    const baseUrl = 'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/bibliotecas-bibliobuses-y-puntos-de-servicio-movil-geolocalizados/records';

    let allResults = [];
    let offset = 0;
    let page = 0;
    console.log(`📡 Descargando bibliotecas por páginas: pageSize=${pageSize}, maxPages=${maxPages}`);
    while (page < parseInt(maxPages)) {
      const url = `${baseUrl}?limit=${pageSize}&offset=${offset}&refine=provincia%3A%22Salamanca%22`;
      console.log(`📡 Fetch page ${page + 1}: ${url}`);
      const response = await axios.get(url);
      const results = response.data?.results || [];
      allResults = allResults.concat(results);
      if (results.length < pageSize) {
        console.log(`📥 Página final recibida (size=${results.length}).`);
        break;
      }
      page += 1;
      offset += pageSize;
    }

    // Transformar resultados
    const items = allResults.map(item => {
      // Campos defensivos según dataset
      const nombre = item.nombre || item.nombre_biblioteca || item.denominacion || 'Biblioteca/Bibliobús';
      const tipo = item.tipo_servicio || item.tipo || item.naturaleza || 'desconocido';
      const municipioNombre = (item.municipio || item.localidad || item.poblacion || '').toString();
      const coords = item.coordenadas || item.geo_point_2d || item.localizacion || null;
      const lon = Array.isArray(coords) ? coords[0] : coords?.lon || coords?.[1] || null; // dataset puede venir como [lon,lat] o {lon,lat}
      const lat = Array.isArray(coords) ? coords[1] : coords?.lat || coords?.[0] || null;

      const muniKey = municipioNombre.trim().toUpperCase();
      const cod_ine = municipioToIne.get(muniKey) || null;

      // Clasificar servicio móvil (bibliobús / servicio móvil) vs físico
      const t = `${tipo} ${nombre}`.toLowerCase();
      const isMobile = /bus|biblio\s*bus|m[óo]vil|movil/.test(t) || /servicio\s*m[óo]vil/.test(t);

      return {
        nombre,
        tipo,
        isMobile,
        municipio: municipioNombre,
        cod_ine,
        coordenadas: (lat && lon) ? { lat, lon } : null
      };
    });

    // Municipios únicos con servicio
    const muniMap = new Map();
    const physicalSet = new Set();
    const mobileSet = new Set();
    items.forEach(it => {
      if (it.cod_ine) {
        if (!muniMap.has(it.cod_ine)) {
          muniMap.set(it.cod_ine, { cod_ine: it.cod_ine, name: it.municipio });
        }
        if (it.isMobile) mobileSet.add(it.cod_ine);
        else physicalSet.add(it.cod_ine);
      }
    });
    const municipiosWithService = Array.from(muniMap.values());
    const municipiosMobile = Array.from(mobileSet).map(cod_ine => ({ cod_ine, name: muniMap.get(cod_ine)?.name || '' }));
    const municipiosPhysical = Array.from(physicalSet).map(cod_ine => ({ cod_ine, name: muniMap.get(cod_ine)?.name || '' }));

    const payload = {
      success: true,
      count: items.length,
      municipiosCount: municipiosWithService.length,
      municipiosWithService,
      municipiosMobile,
      municipiosPhysical,
      data: items,
      timestamp: new Date().toISOString()
    };

    // Cachear por 6 horas
    cache.set(cacheKey, payload, 21600);
    console.log(`✅ Devolviendo ${items.length} recursos en ${municipiosWithService.length} municipios (páginas: ${page + 1})`);
    return res.json(payload);
  } catch (error) {
    console.error('❌ Error obteniendo bibliotecas/bibliobuses:', error.message || error);
    return res.status(500).json({
      success: false,
      error: 'Error obteniendo bibliotecas y bibliobuses',
      details: error.message
    });
  }
});

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
    // Cargar el JSON de códigos postales a municipios
    const inePath = path.resolve(__dirname, '../helpers/ine-codigopostal.json');
    const raw = fs.readFileSync(inePath, 'utf8');
    const cpToMunicipioMap = JSON.parse(raw);
    
    const url = 'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/eventos-de-la-agenda-cultural-categorizados-y-geolocalizados/records?limit=100&refine=nombre_provincia%3A%22Salamanca%22&refine=categoria%3A%22Espect%C3%A1culos%22';
    
    console.log(`📡 URL: ${url}`);
    
    const response = await axios.get(url);
    console.log(`📊 Respuesta recibida:`, response.data);

    if (response.data && response.data.results) {
      const eventos = response.data.results.map(item => {
        // Buscar el nombre del municipio usando el código postal
        let nombreMunicipio = item.municipio || '';
        if (item.cp && !nombreMunicipio) {
          const cpNumerico = parseInt(item.cp, 10);
          const municipioData = cpToMunicipioMap.find(m => m.CodigoPostal === cpNumerico);
          if (municipioData) {
            nombreMunicipio = municipioData.Municipio;
          }
        }
        
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
          municipio: nombreMunicipio,
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
    return res.json(upcomingSorted(cached));
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
       // diputacionEvents = await scrapeEventsDiputacion(townName); // Sin límite de páginas, usará 42 por defecto
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
    
    // Array directo, solo eventos de hoy en adelante y ordenados por fecha
    res.json(upcomingSorted(allEvents));
    
  } catch (error) {
    console.error('❌ Error obteniendo eventos combinados:', error);
    res.status(500).json({ 
      error: 'Error obteniendo eventos combinados', 
      details: error.message
    });
  }
});

// ==========================================
// RUTAS DE INFORMACIÓN MUNICIPAL
// ==========================================

// GET /api/towns/:townId/municipal-info - Obtener información administrativa y cultural del municipio
router.get('/:townId/municipal-info', async (req, res) => {
  const { townId } = req.params;
  const cacheKey = `municipal-info-${townId}`;
  
  console.log(`🏛️ Solicitando información municipal para ${townId}`);
  
  // Intentar devolver de caché (1 hora)
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('📦 Devolviendo información municipal desde caché');
    return res.json(cached);
  }

  try {
    const info = await municipalInfoService.getMunicipalInfo(townId);
    
    if (!info) {
      return res.status(404).json({
        success: false,
        error: 'Información municipal no encontrada'
      });
    }
    
    const plainInfo = info.toObject ? info.toObject() : info;
    console.log('📋 Info convertido a objeto plano:', JSON.stringify(plainInfo, null, 2).substring(0, 500));
    
    const response = {
      success: true,
      data: plainInfo,
      timestamp: new Date().toISOString()
    };
    
    // Guardar en caché por 1 hora
    cache.set(cacheKey, response, 3600);
    
    console.log(`✅ Devolviendo información municipal de ${townId}`);
    res.json(response);
    
  } catch (error) {
    console.error(`❌ Error obteniendo información municipal:`, error);
    res.status(500).json({ 
      success: false,
      error: 'Error obteniendo información municipal', 
      details: error.message
    });
  }
});

// GET /api/towns/:townId/festivals - Obtener fiestas del municipio
router.get('/:townId/festivals', async (req, res) => {
  const { townId } = req.params;
  const cacheKey = `festivals-${townId}`;
  
  console.log(`🎉 Solicitando fiestas para ${townId}`);
  
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const info = await municipalInfoService.getMunicipalInfo(townId);
    
    if (!info) {
      return res.json({
        success: true,
        count: 0,
        data: []
      });
    }
    
    // Convert Mongoose subdocuments to plain objects
    const festivals = info.patron_festivals?.map(f => f.toObject ? f.toObject() : f) || [];
    
    const response = {
      success: true,
      count: festivals.length,
      data: festivals,
      municipality_name: info.municipality_name
    };
    
    cache.set(cacheKey, response, 3600);
    res.json(response);
    
  } catch (error) {
    console.error(`❌ Error obteniendo fiestas:`, error);
    res.status(500).json({ 
      success: false,
      error: 'Error obteniendo fiestas', 
      details: error.message
    });
  }
});

// GET /api/towns/:townId/festivals/posters - Obtener carteles de fiestas
router.get('/:townId/festivals/posters', async (req, res) => {
  const { townId } = req.params;
  const { festival, year } = req.query;
  const cacheKey = `festival-posters-${townId}-${festival || 'all'}-${year || 'all'}`;
  
  console.log(`🎨 Solicitando carteles de fiestas para ${townId}`);
  
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const posters = await municipalInfoService.getFestivalPosters(
      townId,
      festival,
      year ? parseInt(year) : null
    );
    
    const response = {
      success: true,
      count: posters.length,
      data: posters,
      filters: {
        festival: festival || null,
        year: year ? parseInt(year) : null
      }
    };
    
    cache.set(cacheKey, response, 3600);
    res.json(response);
    
  } catch (error) {
    console.error(`❌ Error obteniendo carteles:`, error);
    res.status(500).json({ 
      success: false,
      error: 'Error obteniendo carteles de fiestas', 
      details: error.message
    });
  }
});

// POST /api/towns/:townId/festivals/:festivalName/posters - Añadir cartel de fiesta
router.post('/:townId/festivals/:festivalName/posters', async (req, res) => {
  const { townId, festivalName } = req.params;
  const posterData = req.body;
  
  console.log(`🎨 Añadiendo cartel de ${festivalName} para ${townId}`);
  
  try {
    // Validar datos requeridos
    if (!posterData.year || !posterData.image_url) {
      return res.status(400).json({
        success: false,
        error: 'Faltan datos requeridos: year e image_url son obligatorios'
      });
    }
    
    const info = await municipalInfoService.addFestivalPoster(
      townId,
      decodeURIComponent(festivalName),
      posterData
    );
    
    // Limpiar caché relacionado
    cache.del(`festival-posters-${townId}-${festivalName}-all`);
    cache.del(`festival-posters-${townId}-all-all`);
    cache.del(`festivals-${townId}`);
    cache.del(`municipal-info-${townId}`);
    
    console.log(`✅ Cartel añadido exitosamente`);
    res.json({
      success: true,
      message: 'Cartel añadido exitosamente',
      data: info
    });
    
  } catch (error) {
    console.error(`❌ Error añadiendo cartel:`, error);
    res.status(500).json({ 
      success: false,
      error: 'Error añadiendo cartel de fiesta', 
      details: error.message
    });
  }
});

// DELETE /api/towns/:townId/festivals/:festivalName/posters/:year - Eliminar cartel de fiesta
router.delete('/:townId/festivals/:festivalName/posters/:year', async (req, res) => {
  const { townId, festivalName, year } = req.params;
  
  console.log(`🗑️ Eliminando cartel de ${festivalName} año ${year} para ${townId}`);
  
  try {
    const info = await municipalInfoService.deleteFestivalPoster(
      townId,
      decodeURIComponent(festivalName),
      parseInt(year)
    );
    
    // Limpiar caché relacionado
    cache.del(`festival-posters-${townId}-${festivalName}-all`);
    cache.del(`festival-posters-${townId}-all-all`);
    cache.del(`festivals-${townId}`);
    cache.del(`municipal-info-${townId}`);
    
    console.log(`✅ Cartel eliminado exitosamente`);
    res.json({
      success: true,
      message: 'Cartel eliminado exitosamente',
      data: info
    });
    
  } catch (error) {
    console.error(`❌ Error eliminando cartel:`, error);
    res.status(500).json({ 
      success: false,
      error: 'Error eliminando cartel de fiesta', 
      details: error.message
    });
  }
});

// GET /api/towns/upcoming-festivals - Obtener próximas fiestas de todos los municipios
router.get('/upcoming-festivals', async (req, res) => {
  const { limit = 10 } = req.query;
  const cacheKey = `upcoming-festivals-${limit}`;
  
  console.log(`📅 Solicitando próximas ${limit} fiestas`);
  
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const festivals = await municipalInfoService.getUpcomingFestivals(parseInt(limit));
    
    const response = {
      success: true,
      count: festivals.length,
      data: festivals,
      timestamp: new Date().toISOString()
    };
    
    // Caché por 6 horas
    cache.set(cacheKey, response, 21600);
    res.json(response);
    
  } catch (error) {
    console.error(`❌ Error obteniendo próximas fiestas:`, error);
    res.status(500).json({ 
      success: false,
      error: 'Error obteniendo próximas fiestas', 
      details: error.message
    });
  }
});

// GET /api/towns/all-festivals - Obtener todas las fiestas patronales con datos de municipios
router.get('/all-festivals', async (req, res) => {
  const cacheKey = 'all-festivals';
  
  console.log('🎉 Solicitando todas las fiestas patronales');
  
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('📦 Devolviendo todas las fiestas desde caché');
    return res.json(cached);
  }

  try {
    const allFestivals = await municipalInfoService.getAllFestivalsWithDaysUntil();
    
    const response = {
      success: true,
      count: allFestivals.length,
      data: allFestivals,
      timestamp: new Date().toISOString()
    };
    
    // Caché por 1 hora
    cache.set(cacheKey, response, 3600);
    
    console.log(`✅ Devolviendo ${allFestivals.length} municipios con fiestas`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error obteniendo todas las fiestas:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error obteniendo todas las fiestas patronales', 
      details: error.message
    });
  }
});

// PUT /api/towns/:townId/contact - Actualizar información de contacto
router.put('/:townId/contact', async (req, res) => {
  const { townId } = req.params;
  const contactInfo = req.body;
  
  console.log(`📞 Actualizando contacto para ${townId}`);
  
  try {
    const info = await municipalInfoService.updateContactInfo(townId, contactInfo);
    
    // Limpiar caché
    cache.del(`municipal-info-${townId}`);
    
    console.log(`✅ Contacto actualizado exitosamente`);
    res.json({
      success: true,
      message: 'Información de contacto actualizada',
      data: info
    });
    
  } catch (error) {
    console.error(`❌ Error actualizando contacto:`, error);
    res.status(500).json({ 
      success: false,
      error: 'Error actualizando información de contacto', 
      details: error.message
    });
  }
});

module.exports = router;
