import axios from 'axios'

// Configuración dinámica para producción y desarrollo
const isProduction = import.meta.env.PROD
const isDevelopment = import.meta.env.DEV

// URLs para diferentes entornos
const getApiBaseUrl = () => {
  if (isProduction) {
    // En producción, usar rutas relativas que nginx manejará
    return '/api'
  } else {
    // En desarrollo, usar variables de entorno o localhost
    const backendHost = import.meta.env.VITE_BACKEND_HOST || 'localhost'
    const backendPort = import.meta.env.VITE_BACKEND_PORT || '4000'
    return `http://${backendHost}:${backendPort}/api`
  }
}

// DEPRECATED: Langflow ha sido reemplazado por el servicio LangChain integrado
// Las llamadas al chat ahora van a /api/chat del backend
const getLangflowUrl = () => {
  if (isProduction) {
    return '/api'
  } else {
    const backendHost = import.meta.env.VITE_BACKEND_HOST || 'localhost'
    const backendPort = import.meta.env.VITE_BACKEND_PORT || '4000'
    return `http://${backendHost}:${backendPort}/api`
  }
}

const apiBaseUrl = getApiBaseUrl()
export const langflowBaseUrl = getLangflowUrl()

console.log('🌐 API Configuration:', {
  mode: isProduction ? 'production' : 'development',
  apiBaseUrl,
  langflowBaseUrl
})

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const apiService = {
  // Obtener INE de municipios Tierra de Sabor
  async getTierraSaborIds() {
    try {
      const response = await api.get('/gastro');
      return response.data
    } catch (error) {
      return [];
    }
  },

  // Un productor Tierra de Sabor con todos sus productos (null si falla)
  async getTierraSaborProducer(idempresa) {
    try {
      const response = await api.get(`/gastro/${idempresa}`)
      return response.data
    } catch (error) {
      console.error('Error obteniendo el productor Tierra de Sabor:', error)
      return null
    }
  },

  // Foto de Wikimedia Commons de un monumento (null si no hay una que encaje)
  async getPlacePhoto({ lat, lon, nombre, pueblo }) {
    try {
      const response = await api.get('/fotos/lugar', { params: { lat, lon, nombre, pueblo } })
      return response.data?.foto || null
    } catch {
      return null
    }
  },

  // Cines de la provincia (o de un municipio) con su cartelera de los próximos días
  async getCines(ine = null) {
    try {
      const response = await api.get('/cines', { params: ine ? { ine } : {} })
      return response.data?.cines || []
    } catch (error) {
      console.error('Error obteniendo la cartelera de cines:', error)
      return []
    }
  },

  // Convertir código postal a código INE de municipio
  async getCodigoINEFromCodigoPostal(codigoPostal) {
    console.log(`Convirtiendo código postal: ${codigoPostal}`)
    try {
      const response = await api.get(`/towns/codigo-postal/${codigoPostal}/ine`)
      return response.data.codigoINE
    } catch (error) {
      console.error(`Error convirtiendo código postal ${codigoPostal}:`, error)
      return null
    }
  },

  // Obtener información de un municipio
  async getTownInfo(townId) {
    try {
      const response = await api.get(`/towns/${townId}/info`)
      return response.data
    } catch (error) {
      // Sin datos inventados: la ficha dirá que no hay información
      console.error(`Error fetching town info for ${townId}:`, error)
      return null
    }
  },

  // Obtener productos de Tierra de Sabor por ID de empresa
  async getTierraSaborProducts(establishmentId) {
    try {
      console.log(`🔍 Obteniendo productos para empresa ID: ${establishmentId}`)
      const response = await api.get(`/towns/tierra-sabor/${establishmentId}`)
      
      if (response.data && response.data.success) {
        console.log(`✅ ${response.data.count} productos encontrados`)
        return response.data.data || []
      } else if (response.data && Array.isArray(response.data)) {
        // Formato de respuesta anterior (por compatibilidad)
        return response.data
      } else {
        console.warn('⚠️ No se encontraron productos')
        return []
      }
    } catch (error) {
      // Nunca productos inventados: se atribuirían a una empresa real
      console.error('❌ Error fetching Tierra de Sabor products:', error)
      return []
    }
  },

  // Obtener eventos de un municipio
  async getTownEvents(townId) {
    try {
      const response = await api.get(`/towns/${townId}/events/combined`)
      return response.data
    } catch (error) {
      console.error(`Error fetching events for ${townId}:`, error)
      return []
    }
  },

  // Obtener puntos de interés de un municipio
  async getTownPointsOfInterest(townId) {
    try {
      const response = await api.get(`/towns/${townId}/pois`)
      return response.data
    } catch (error) {
      console.error(`Error fetching POIs for ${townId}:`, error)
      return []
    }
  },

  // Buscar municipios
  async searchTowns(query) {
    try {
      const response = await api.get(`/towns/search?q=${encodeURIComponent(query)}`)
      return response.data
    } catch (error) {
      console.error('Error searching towns:', error)
      return []
    }
  }
}

// Información municipal (contacto, fiestas, etc.)
apiService.getMunicipalInfo = async function(townId) {
  try {
    // Add cache buster to force fresh data
    const cacheBuster = Date.now();
    const response = await api.get(`/towns/${townId}/municipal-info?_t=${cacheBuster}`)
    console.log('🏛️ Raw API response:', response.data)
    if (response.data && response.data.success) {
      console.log('✅ Returning municipal data:', response.data.data)
      return response.data.data
    }
    return null
  } catch (error) {
    console.error(`Error fetching municipal info for ${townId}:`, error)
    return null
  }
}

// Resumen e historia del municipio (Wikipedia, ya limpia en el backend)
apiService.getTownHistoria = async function(townId) {
  try {
    const response = await api.get(`/towns/${townId}/historia`)
    return response.data
  } catch (error) {
    return null
  }
}

// Lonja de Salamanca: productos con su último precio, y el histórico de hasta 4 con su análisis
apiService.getLonjaProducts = async function() {
  try {
    const response = await api.get('/lonja/productos', { timeout: 60000 })
    return response.data
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'No se han podido cargar las cotizaciones de la Lonja.' }
  }
}
apiService.getLonjaSeries = async function(ids) {
  try {
    const response = await api.get(`/lonja/series?ids=${encodeURIComponent(ids.join(','))}`, { timeout: 60000 })
    return response.data
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'No se han podido cargar las cotizaciones de la Lonja.' }
  }
}

// Asistente (SaLLMantino): pregunta + últimas intervenciones → { answer, sources, towns, mode }
// Los errores (límite de preguntas, sin conexión) vuelven con su mensaje para mostrarlo en el chat
apiService.askAssistant = async function(question, history = []) {
  try {
    const response = await api.post('/chat', { question, history }, { timeout: 45000 })
    return response.data
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'No he podido conectar. Inténtalo de nuevo en un momento.' }
  }
}

// Carteles de fiestas aprobados de un municipio (el más reciente primero)
apiService.getTownPosters = async function(townId) {
  try {
    const response = await api.get(`/posters/town/${townId}`)
    return response.data?.data || []
  } catch (error) {
    return []
  }
}

apiService.getMunicipalFestivals = async function(townId) {
  try {
    const response = await api.get(`/towns/${townId}/festivals`)
    return response.data
  } catch (error) {
    console.error(`Error fetching festivals for ${townId}:`, error)
    return { success: true, count: 0, data: [] }
  }
}

// Obtener todas las fiestas patronales de todos los municipios
apiService.getAllFestivalsWithMunicipalities = async function() {
  try {
    const response = await api.get('/towns/all-festivals')
    return response.data
  } catch (error) {
    console.error('Error fetching all festivals:', error)
    return { success: true, count: 0, data: [] }
  }
}

// Obtener bibliotecas, bibliobuses y puntos móviles (provincia Salamanca)
apiService.getLibraries = async function(params = {}) {
  try {
    const { maxPages } = params
    const query = typeof maxPages !== 'undefined' ? `?maxPages=${encodeURIComponent(maxPages)}` : ''
    const response = await api.get(`/towns/libraries${query}`)
    return response.data
  } catch (error) {
    console.error('Error fetching libraries/bibliobuses:', error)
    return { success: true, count: 0, municipiosCount: 0, municipiosWithService: [], data: [] }
  }
}

// Obtener puntos de servicio móvil de bibliobuses (Salamanca)
apiService.getBibliobusPoints = async function(params = {}) {
  try {
    const { maxPages } = params
    const query = typeof maxPages !== 'undefined' ? `?maxPages=${encodeURIComponent(maxPages)}` : ''
    const response = await api.get(`/towns/bibliobus/points${query}`)
    return response.data
  } catch (error) {
    console.error('Error fetching bibliobus points:', error)
    return { success: true, count: 0, groupsCount: 0, groupedByMunicipio: [], data: [] }
  }
}

// Agregar la función de teatro al objeto apiService
apiService.getTeatroEvents = async function() {
  try {
    console.log('🎭 Solicitando eventos de teatro...');
    const response = await api.get('/towns/teatro');
    console.log('✅ Eventos de teatro recibidos:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error obteniendo eventos de teatro:', error);
    throw error;
  }
}

// Agregar la función para obtener lista de municipios al objeto apiService
apiService.getMunicipiosList = async function() {
  try {
    console.log('🏘️ Solicitando lista de municipios...');
    const response = await api.get('/towns/list');
    console.log('✅ Lista de municipios recibida:', response.data);
    return response.data.data || response.data || [];
  } catch (error) {
    console.error('❌ Error obteniendo lista de municipios:', error);
    throw error;
  }
}

export default api
