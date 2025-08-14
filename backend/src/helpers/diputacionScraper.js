const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'http://www.lasalina.es/agenda.html';

// Cache para almacenar todos los eventos
let eventsCache = null;
let lastCacheUpdate = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos en milisegundos

/**
 * Obtiene todos los eventos de la Diputación y los cachea
 * @param {number} maxPages - Máximo número de páginas a procesar (por defecto 42)
 * @returns {Array} Array de todos los eventos
 */
async function getAllEventsDiputacion(maxPages = 42) {
  console.log(`🔍 Obteniendo TODOS los eventos de Diputación Salamanca (max ${maxPages} páginas)`);
  
  const events = [];
  let currentPage = 1;
  const processedIds = new Set();
  let consecutiveEmptyPages = 0;
  const maxEmptyPages = 3;
  
  try {
    while (currentPage <= maxPages && consecutiveEmptyPages < maxEmptyPages) {
      const url = `${BASE_URL}?area=&nPagina=${currentPage}`;
      console.log(`🔍 Scrapeando página ${currentPage}: ${url}`);
      
      try {
        const response = await axios.get(url, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        console.log(`📄 Respuesta recibida para página ${currentPage} (${response.data.length} caracteres)`);
        
        const $ = cheerio.load(response.data);
        const pageEvents = [];
        
        // Buscar elementos con clases que empiecen con "evento"
        const eventoElements = $('[class^="evento"]').toArray();
        
        for (const element of eventoElements) {
          const $element = $(element);
          const className = $element.attr('class') || '';
          
          // Ignorar eventoTitle ya que no es un evento real
          if (className !== 'eventoTitle') {
            const titleLink = $element.find('a').first();
            
            if (titleLink.length && titleLink.attr('href')) {
              const href = titleLink.attr('href');
              const activityIdMatch = href.match(/id_actividad=(\d+)/);
              
              if (activityIdMatch) {
                const activityId = activityIdMatch[1];
                
                // Verificar si ya procesamos este evento
                if (processedIds.has(activityId)) {
                  console.log(`⚠️ Evento duplicado ignorado: ${activityId}`);
                  continue;
                }
                
                processedIds.add(activityId);
                
                // Extraer la categoría de la clase
                const categoryMatch = className.match(/^evento\s+(.+)/);
                const category = categoryMatch ? categoryMatch[1].trim() : 'General';
                
                const eventData = extractEventFromElement($, $element, activityId, category);
                if (eventData) {
                  // Obtener detalles completos del evento
                  const detailedEvent = await getEventDetails(eventData);
                  if (detailedEvent) {
                    pageEvents.push(detailedEvent);
                    console.log(`✅ Evento completo añadido: "${detailedEvent.titulo}" (ID: ${activityId})`);
                  } else {
                    pageEvents.push(eventData);
                    console.log(`✅ Evento básico añadido: "${eventData.titulo}" (ID: ${activityId})`);
                  }
                }
              }
            }
          }
        }
        
        // Si no encontramos eventos con selectores específicos, usar método fallback
        if (pageEvents.length === 0) {
          console.log('🔄 Usando método fallback para buscar eventos...');
          
          const h4Elements = $('h4').toArray();
          
          for (const element of h4Elements) {
            const $title = $(element);
            const titleLink = $title.find('a');
            
            if (titleLink.length && titleLink.attr('href')) {
              const href = titleLink.attr('href');
              const activityIdMatch = href.match(/id_actividad=(\d+)/);
              
              if (activityIdMatch) {
                const activityId = activityIdMatch[1];
                
                // Verificar si ya procesamos este evento
                if (processedIds.has(activityId)) {
                  console.log(`⚠️ Evento duplicado ignorado: ${activityId}`);
                  continue;
                }
                
                processedIds.add(activityId);
                
                const eventData = extractEventFromH4Element($, $title, activityId);
                if (eventData) {
                  // Obtener detalles completos del evento
                  const detailedEvent = await getEventDetails(eventData);
                  if (detailedEvent) {
                    pageEvents.push(detailedEvent);
                    console.log(`✅ Evento completo añadido (fallback): "${detailedEvent.titulo}" (ID: ${activityId})`);
                  } else {
                    pageEvents.push(eventData);
                    console.log(`✅ Evento básico añadido (fallback): "${eventData.titulo}" (ID: ${activityId})`);
                  }
                }
              }
            }
          }
        }
        
        console.log(`📄 Página ${currentPage}: ${pageEvents.length} eventos encontrados`);
        events.push(...pageEvents);
        
        // Controlar páginas vacías consecutivas
        if (pageEvents.length === 0) {
          consecutiveEmptyPages++;
          console.log(`⚠️ Página ${currentPage} vacía (${consecutiveEmptyPages}/${maxEmptyPages} consecutivas)`);
        } else {
          consecutiveEmptyPages = 0;
        }
        
        // Solo terminar si tenemos muchas páginas vacías consecutivas
        if (consecutiveEmptyPages >= maxEmptyPages) {
          console.log(`🏁 ${maxEmptyPages} páginas vacías consecutivas, finalizando scraping`);
          break;
        }
        
        currentPage++;
        
        // Pequeña pausa entre peticiones para ser respetuosos
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (pageError) {
        console.error(`❌ Error en página ${currentPage}:`, pageError.message);
        consecutiveEmptyPages++;
        currentPage++;
      }
    }
    
    console.log(`✅ Scraping completado: ${events.length} eventos obtenidos en total`);
    return events;
    
  } catch (error) {
    console.error('❌ Error general en scraping Diputación:', error.message);
    return [];
  }
}

/**
 * Obtiene detalles completos de un evento específico
 * @param {Object} eventData - Datos básicos del evento
 * @returns {Object|null} Datos completos del evento
 */
async function getEventDetails(eventData) {
  try {
    console.log(`🔍 Obteniendo detalles del evento: ${eventData.titulo}`);
    
    // Construir URL de detalles
    const detailUrl = `http://www.lasalina.es/agenda.html?tipo=detalle&id_actividad=${eventData.id_actividad}&area=`;
    
    const response = await axios.get(detailUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Extraer imagen principal - buscar el enlace de JavaScript que muestra la imagen
    let imagen = null;
    const imageScript = $('a[href*="verImagen"]').attr('href') || '';
    if (imageScript) {
      const imageMatch = imageScript.match(/verImagen\('([^']+)'\)/);
      if (imageMatch) {
        imagen = imageMatch[1];
      }
    }
    
    // Si no encuentra imagen con verImagen, buscar otras imágenes
    if (!imagen) {
      const imgElement = $('img[src*="documentacion"], img[src*="AgendaActividades"]').first();
      if (imgElement.length) {
        let imgSrc = imgElement.attr('src');
        if (imgSrc) {
          imagen = imgSrc.startsWith('http') ? imgSrc : `http://www.lasalina.es${imgSrc}`;
        }
      }
    }
    
    // Extraer descripción - buscar el texto después del título
    let descripcion = '';
    const contentText = $('body').text();
    
    // Buscar descripción después del título del evento
    const titleRegex = new RegExp(eventData.titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const titleIndex = contentText.search(titleRegex);
    
    if (titleIndex !== -1) {
      // Extraer texto después del título
      const afterTitle = contentText.substring(titleIndex + eventData.titulo.length);
      
      // Buscar párrafos significativos
      const paragraphs = afterTitle.split(/\n+|\. /).filter(p => 
        p.trim().length > 50 && 
        !p.includes('Compartir') && 
        !p.includes('Etiquetas') &&
        !p.includes('Te interesa') &&
        !p.includes('CARGANDO')
      );
      
      if (paragraphs.length > 0) {
        descripcion = paragraphs[0].trim();
        // Limpiar texto
        descripcion = descripcion.replace(/\s+/g, ' ').trim();
      }
    }
    
    // Extraer fecha específica
    let fechaCompleta = eventData.fecha;
    const fechaMatch = contentText.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (fechaMatch) {
      fechaCompleta = fechaMatch[1];
    }
    
    // Extraer hora
    let hora = '';
    const horaMatch = contentText.match(/(\d{1,2}:\d{2})\s*horas?/i);
    if (horaMatch) {
      hora = horaMatch[1] + ' horas';
    }
    
    // Extraer lugar específico
    let lugar = eventData.municipio || 'Salamanca';
    const lugarMatch = contentText.match(/Lugar:\s*([^☍\n]+)/);
    if (lugarMatch) {
      lugar = lugarMatch[1].trim();
    }
    
    // Extraer precio/entrada
    let precio = 'Consultar';
    if (contentText.includes('Entrada libre')) {
      precio = 'Entrada libre';
    } else if (contentText.includes('Gratuito') || contentText.includes('Gratis')) {
      precio = 'Gratuito';
    } else {
      const precioMatch = contentText.match(/Precio:\s*([^,\n]+)|Entrada:\s*([^,\n]+)|(\d+(?:,\d+)?)\s*€/);
      if (precioMatch) {
        precio = precioMatch[1] || precioMatch[2] || precioMatch[3] + '€';
      }
    }
    
    // Extraer municipio más específico
    let municipio = eventData.municipio;
    const municipioMatch = contentText.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?=\s+\d{2}:\d{2}|\s+Entrada|\s+VER MAPA)/);
    if (municipioMatch) {
      municipio = municipioMatch[0].trim();
    }
    
    // Extraer URL web si existe
    let web = null;
    const webLink = $('a[href*="http"]:contains("Web")').attr('href');
    if (webLink) {
      web = webLink;
    }
    
    // Pequeña pausa para no sobrecargar el servidor
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      ...eventData,
      descripcion: descripcion || 'Descripción no disponible',
      imagen: imagen,
      precio: precio,
      lugar: lugar,
      municipio: municipio,
      fecha: fechaCompleta,
      hora: hora,
      web: web,
      url_detalle: detailUrl
    };
    
  } catch (error) {
    console.error(`❌ Error obteniendo detalles del evento ${eventData.id_actividad}:`, error.message);
    return null;
  }
}

/**
 * Verifica si el caché es válido
 * @returns {boolean} True si el caché es válido
 */
function isCacheValid() {
  if (!eventsCache || !lastCacheUpdate) {
    return false;
  }
  
  const now = Date.now();
  return (now - lastCacheUpdate) < CACHE_DURATION;
}

/**
 * Actualiza el caché con todos los eventos
 * @param {boolean} forceUpdate - Forzar actualización aunque el caché sea válido
 */
async function updateCache(forceUpdate = false) {
  if (!forceUpdate && isCacheValid()) {
    console.log('📋 Caché válido, usando eventos almacenados');
    return;
  }
  
  console.log('🔄 Actualizando caché de eventos...');
  const allEvents = await getAllEventsDiputacion();
  
  eventsCache = allEvents;
  lastCacheUpdate = Date.now();
  
  console.log(`💾 Caché actualizado con ${allEvents.length} eventos`);
}

/**
 * Obtiene eventos filtrados por municipio desde el caché
 * @param {string} municipio - Nombre del municipio (opcional)
 * @returns {Array} Array de eventos filtrados
 */
async function scrapeEventsDiputacion(municipio = null) {
  try {
    // Asegurar que el caché está actualizado
    await updateCache();
    
    if (!eventsCache) {
      console.log('❌ No hay eventos en caché');
      return [];
    }
    
    // Si no se especifica municipio, devolver todos los eventos
    if (!municipio) {
      console.log(`📋 Devolviendo ${eventsCache.length} eventos (sin filtro de municipio)`);
      return eventsCache;
    }
    
    // Filtrar eventos por municipio
    const filteredEvents = eventsCache.filter(event => 
      event.municipio && event.municipio.toUpperCase().includes(municipio.toUpperCase())
    );
    
    console.log(`📋 Eventos filtrados para ${municipio}: ${filteredEvents.length} de ${eventsCache.length} total`);
    return filteredEvents;
    
  } catch (error) {
    console.error('❌ Error obteniendo eventos desde caché:', error.message);
    return [];
  }
}

/**
 * Extrae datos de evento de un elemento específico
 * @param {Object} $ - Instancia de Cheerio
 * @param {Object} element - Elemento jQuery
 * @param {string} activityId - ID de la actividad
 * @param {string} category - Categoría del evento extraída de la clase CSS
 * @returns {Object|null} Datos del evento
 */
function extractEventFromElement($, element, activityId, category = 'General') {
  try {
    const $el = $(element);
    
    // Buscar título y enlace - puede estar en el elemento actual o en un hijo
    let titleLink = $el.find('a').first();
    if (!titleLink.length) {
      // Si no hay enlace en el elemento, buscar en elementos hermanos o cercanos
      titleLink = $el.next().find('a').first();
      if (!titleLink.length) {
        titleLink = $el.parent().find('a').first();
      }
    }
    
    if (!titleLink.length || !titleLink.attr('href')) {
      return null;
    }
    
    const href = titleLink.attr('href');
    const title = titleLink.text().trim();
    
    if (!title) {
      return null; // No procesar eventos sin título
    }
    
    // Buscar fecha y ubicación en el contenido del elemento y elementos cercanos
    const $container = $el.closest('.evento, [class*="evento"]').length ? $el.closest('.evento, [class*="evento"]') : $el;
    let elementText = $container.text();
    
    // También buscar en elementos hermanos
    const $siblings = $container.siblings();
    $siblings.each((i, sibling) => {
      elementText += ' ' + $(sibling).text();
    });
    
    // Patrones de fecha más específicos
    const dateMatch = elementText.match(/(\d{1,2}\s+(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)[^\d]*\d{4})/i) || 
                     elementText.match(/(\d{1,2}\s+(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)[^\d]*\d{4})/i) ||
                     elementText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    
    // Patrones de ubicación más específicos
    const locationMatch = elementText.match(/\(([^)]+)\)/) || 
                         elementText.match(/en\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+)/) ||
                         elementText.match(/Lugar:\s*([^,\n]+)/);
    
    // Buscar imagen en el contenedor
    const img = $container.find('img').first();
    let imageUrl = '';
    if (img.length && img.attr('src')) {
      imageUrl = img.attr('src');
      if (imageUrl.startsWith('/')) {
        imageUrl = 'http://www.lasalina.es' + imageUrl;
      }
    }
    
    // Extraer municipio de la ubicación
    let municipio = '';
    if (locationMatch && locationMatch[1]) {
      municipio = locationMatch[1].trim();
      // Limpiar el municipio de palabras comunes
      municipio = municipio.replace(/^(en|de|del|la|el)\s+/i, '').trim();
    }
    
    return {
      id: `dip_${activityId}`,
      id_actividad: activityId,
      titulo: title,
      fecha_texto: dateMatch ? dateMatch[1] : '',
      ubicacion: locationMatch ? locationMatch[0] : '',
      municipio: municipio,
      imagen: imageUrl,
      url_detalle: `http://www.lasalina.es/agenda.html?tipo=detalle&id_actividad=${activityId}&area=`,
      source: 'diputacion',
      categoria: category  // Usar la categoría extraída de la clase CSS
    };
    
  } catch (error) {
    console.error('Error extrayendo evento de elemento:', error.message);
    return null;
  }
}

/**
 * Extrae datos de evento usando el método H4 (fallback)
 * @param {Object} $ - Instancia de Cheerio
 * @param {Object} $title - Elemento título
 * @param {string} activityId - ID de la actividad
 * @returns {Object} Datos del evento
 */
function extractEventFromH4Element($, $title, activityId) {
  const titleLink = $title.find('a');
  const title = titleLink.text().trim();
  
  // Buscar información adicional en los elementos siguientes
  let $next = $title.next();
  let dateText = '';
  let locationText = '';
  let imageUrl = '';
  
  // Buscar hasta 5 elementos siguientes para encontrar fecha y ubicación
  for (let i = 0; i < 5 && $next.length; i++) {
    const text = $next.text().trim();
    
    // Buscar patrones de fecha
    if (text.match(/\d{1,2}\s+(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)/i)) {
      dateText = text;
    }
    
    // Buscar ubicación (texto que contiene paréntesis o nombres de municipios conocidos)
    if (text.includes('(') && text.includes(')') && !dateText.includes(text)) {
      locationText = text;
    }
    
    // Buscar imagen
    const img = $next.find('img');
    if (img.length && img.attr('src')) {
      imageUrl = img.attr('src');
      if (imageUrl.startsWith('/')) {
        imageUrl = 'http://www.lasalina.es' + imageUrl;
      }
    }
    
    $next = $next.next();
  }
  
  // Extraer municipio de la ubicación
  const municipioMatch = locationText.match(/\(([^)]+)\)/);
  const eventMunicipio = municipioMatch ? municipioMatch[1].trim() : '';
  
  return {
    id: `dip_${activityId}`,
    id_actividad: activityId,
    titulo: title,
    fecha_texto: dateText,
    ubicacion: locationText,
    municipio: eventMunicipio,
    imagen: imageUrl,
    url_detalle: `http://www.lasalina.es/agenda.html?tipo=detalle&id_actividad=${activityId}&area=`,
    source: 'diputacion',
    categoria: 'Cultura'
  };
}

/**
 * Obtiene detalles completos de un evento específico
 * @param {string} activityId - ID de la actividad
 * @returns {Object} Detalles del evento
 */
async function scrapeEventDetailDiputacion(activityId) {
  try {
    const url = `http://www.lasalina.es/agenda.html?tipo=detalle&id_actividad=${activityId}&area=`;
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    const title = $('h2').first().text().trim();
    const date = $('h2').siblings().first().text().trim();
    
    let location = '';
    let description = '';
    let organizer = '';
    
    // Buscar información en el contenido principal
    $('p, div').each((index, element) => {
      const text = $(element).text().trim();
      
      if (text.includes('SALAMANCA') || text.includes('Jardines') || text.includes('Plaza')) {
        if (!location) location = text;
      }
      
      if (text.length > 100 && !description) {
        description = text;
      }
      
      if (text.includes('Ayuntamiento') || text.includes('Fundación')) {
        organizer = text;
      }
    });
    
    return {
      id: `dip_${activityId}`,
      titulo: title,
      fecha: date,
      ubicacion: location,
      descripcion: description,
      organizador: organizer,
      url: url,
      source: 'diputacion'
    };
    
  } catch (error) {
    console.error(`Error obteniendo detalles del evento ${activityId}:`, error.message);
    return null;
  }
}

/**
 * Fuerza la actualización del caché
 */
async function refreshCache() {
  console.log('🔄 Forzando actualización del caché...');
  await updateCache(true);
}

/**
 * Obtiene información del estado del caché
 */
function getCacheInfo() {
  return {
    hasCache: !!eventsCache,
    eventCount: eventsCache ? eventsCache.length : 0,
    lastUpdate: lastCacheUpdate,
    isValid: isCacheValid(),
    timeUntilExpiry: lastCacheUpdate ? CACHE_DURATION - (Date.now() - lastCacheUpdate) : 0
  };
}

module.exports = {
  scrapeEventsDiputacion,
  getAllEventsDiputacion,
  scrapeEventDetailDiputacion,
  refreshCache,
  getCacheInfo
};
