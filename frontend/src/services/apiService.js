import axios from 'axios'

// Configuración base de axios
const api = axios.create({
  baseURL: '/api', // Proxy configurado en Vite
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
  // Obtener información de un municipio
  async getTownInfo(townId) {
    try {
      const response = await api.get(`/towns/${townId}/info`)
      console.log('API Response:', response)
      return response.data.results[0] || {}
    } catch (error) {
      // Fallback: usar datos mock mientras se implementa el backend
      return getMockTownInfo(townId)
    }
  },

  // Obtener eventos de un municipio
  async getTownEvents(townId) {
    try {
      const response = await api.get(`/towns/${townId}/events`)
      return response.data
    } catch (error) {
      // Fallback: usar datos mock
      return getMockTownEvents(townId)
    }
  },

  // Obtener puntos de interés de un municipio
  async getTownPointsOfInterest(townId) {
    try {
      const response = await api.get(`/towns/${townId}/pois`)
      return response.data
    } catch (error) {
      // Fallback: usar datos mock
      return getMockTownPOI(townId)
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

// Datos mock para desarrollo (mientras se implementa el backend)
function getMockTownInfo(townId) {
  const mockData = {
    'salamanca': {
      superficie: '39.56',
      poblacion: '144866',
      altitud: '798',
      descripcion: 'Salamanca es una ciudad histórica española, capital de la provincia homónima, conocida por su universidad y patrimonio arquitectónico.'
    },
    'alba_de_tormes': {
      superficie: '28.34',
      poblacion: '5186',
      altitud: '822',
      descripcion: 'Alba de Tormes es un municipio español de la provincia de Salamanca, famoso por ser el lugar donde murió Santa Teresa de Jesús.'
    }
  }

  return mockData[townId] || {
    superficie: 'N/A',
    poblacion: 'N/A',
    altitud: 'N/A',
    descripcion: 'Información no disponible en este momento.'
  }
}

function getMockTownEvents(townId) {
  const mockEvents = [
    {
      id: 1,
      title: 'Feria de San Juan',
      date: '2025-06-24',
      time: '10:00',
      location: 'Plaza Mayor',
      category: 'Feria',
      description: 'Celebración tradicional con actividades para toda la familia.'
    },
    {
      id: 2,
      title: 'Concierto de música clásica',
      date: '2025-07-15',
      time: '20:30',
      location: 'Iglesia Principal',
      category: 'Música',
      description: 'Concierto benéfico de la orquesta local.'
    }
  ]

  return mockEvents
}

function getMockTownPOI(townId) {
  const mockPOI = [
    {
      id: 1,
      name: 'Iglesia Parroquial',
      description: 'Iglesia de estilo románico del siglo XII.',
      address: 'Plaza de la Iglesia, s/n'
    },
    {
      id: 2,
      name: 'Mirador del pueblo',
      description: 'Punto panorámico con vistas espectaculares.',
      address: 'Cerro de las Cruces'
    },
    {
      id: 3,
      name: 'Museo Local',
      description: 'Museo con la historia y tradiciones del municipio.',
      address: 'Calle Mayor, 15'
    }
  ]

  return mockPOI
}

export default api
