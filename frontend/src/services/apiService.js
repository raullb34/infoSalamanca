import axios from 'axios'

// Usar variables de entorno de Vite para el backend
const backendHost = import.meta.env.VITE_BACKEND_HOST || 'localhost';
const backendPort = import.meta.env.VITE_BACKEND_PORT || '4000';
const apiBaseUrl = `http://${backendHost}:${backendPort}/api`;

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
      console.error(`Error fetching town info for ${townId}:`, error)
      // Fallback: usar datos mock
      return getMockTownInfo(townId)
    }
  },

  // Obtener productos de Tierra de Sabor por establecimiento
  async getTierraSaborProducts(establishmentName) {
    try {
      // Intentar diferentes endpoints posibles
      const endpoints = [
        `/gastro/productos/${encodeURIComponent(establishmentName)}`,
        `/tierra-sabor/productos/${encodeURIComponent(establishmentName)}`,
        `/towns/tierra-sabor/${encodeURIComponent(establishmentName)}`
      ]
      
      for (const endpoint of endpoints) {
        try {
          const response = await api.get(endpoint)
          if (response.data && response.data.length > 0) {
            return response.data
          }
        } catch (endpointError) {
          console.log(`Endpoint ${endpoint} no disponible, probando siguiente...`)
        }
      }
      
      // Si no hay datos reales, devolver productos mock
      return this.getMockTierraSaborProducts(establishmentName)
    } catch (error) {
      console.error('Error fetching Tierra de Sabor products:', error)
      return this.getMockTierraSaborProducts(establishmentName)
    }
  },

  // Obtener productos mock de Tierra de Sabor
  getMockTierraSaborProducts(establishmentName) {
    const mockProducts = [
      {
        id: 1,
        nombre: 'Jamón Ibérico de Bellota',
        categoria: 'Embutidos',
        descripcion: `Jamón ibérico de bellota de la casa ${establishmentName}`,
        precio: '89.50 €/kg',
        imagen: '/assets/icons/tierra-sabor.svg'
      },
      {
        id: 2,
        nombre: 'Queso de Cabra Curado',
        categoria: 'Lácteos',
        descripcion: `Queso artesanal de cabra curado, especialidad de ${establishmentName}`,
        precio: '18.90 €/pieza',
        imagen: '/assets/icons/tierra-sabor.svg'
      },
      {
        id: 3,
        nombre: 'Miel de Encina',
        categoria: 'Apicultura',
        descripcion: `Miel natural de encina, producción local de ${establishmentName}`,
        precio: '12.50 €/500g',
        imagen: '/assets/icons/tierra-sabor.svg'
      },
      {
        id: 4,
        nombre: 'Aceite de Oliva Virgen Extra',
        categoria: 'Aceites',
        descripcion: `Aceite de oliva virgen extra, primera presión en frío de ${establishmentName}`,
        precio: '15.75 €/750ml',
        imagen: '/assets/icons/tierra-sabor.svg'
      }
    ]
    
    return mockProducts
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
      latitud: '40.9701',
      longitud: '-5.6635',
      densidad: '3661.7',
      cod_postal: ['37001', '37002', '37003', '37004', '37005', '37006', '37007', '37008'],
      mancomunidades: 'Mancomunidad de Municipios de la Zona de Salamanca',
      comarca: 'Campo de Salamanca',
      descripcion: 'Salamanca es una ciudad histórica española, capital de la provincia homónima, conocida por su universidad y patrimonio arquitectónico.'
    },
    'alba_de_tormes': {
      superficie: '28.34',
      poblacion: '5186',
      altitud: '822',
      latitud: '40.8200',
      longitud: '-5.5100',
      densidad: '183.0',
      cod_postal: ['37800'],
      mancomunidades: 'Mancomunidad Alba de Tormes',
      comarca: 'Comarca de Alba de Tormes',
      descripcion: 'Alba de Tormes es un municipio español de la provincia de Salamanca, famoso por ser el lugar donde murió Santa Teresa de Jesús.'
    }
  }

  return mockData[townId] || {
    superficie: '25.50',
    poblacion: '1200',
    altitud: '800',
    latitud: '40.8500',
    longitud: '-5.5500',
    densidad: '47.1',
    cod_postal: ['37XXX'],
    mancomunidades: 'Mancomunidad de la Provincia de Salamanca',
    comarca: 'Comarca de Salamanca',
    descripcion: 'Municipio de la provincia de Salamanca con rica historia y tradiciones.'
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
