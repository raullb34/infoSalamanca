<template>
  <div class="filter-content">
    <h2>{{ currentFilterTitle }}</h2>
  
    <!-- Loader mientras carga -->
    <div v-if="isLoading" class="loading-container">
      <div class="spinner"></div>
      <p>Cargando resultados...</p>
    </div>
    
    <!-- Lista de resultados de filtros -->
    <div v-else class="filter-results">
      <!-- Resultados Tierra de Sabor -->
      <div v-if="activeFilter === 'tierraSabor' && tierraSaborResults.length > 0">
        <div 
          v-for="(item, index) in sortedTierraSaborResults"
          :key="index"
          class="filter-item tierra-sabor-item"
          @click="showTierraSaborProducts(item)"
        >
          <div class="item-header">
            <h4>{{ item.nombre_comercial || item.razon_social || 'Sin nombre' }}</h4>
            <span class="item-category" v-if="item.web">
              <a :href="formatWebUrl(item.web)" target="_blank" rel="noopener noreferrer">Ir a la Web</a>
            </span>
            <span class="item-category" v-else>Tierra de Sabor</span>
          </div>
          <div class="item-details">
            <p v-if="item.direccion"><strong>📍</strong> {{ item.direccion }}</p>
            <p v-if="item.localidad"><strong>🏘️</strong> {{ item.localidad }}</p>
          </div>
        </div>
      </div>

      <!-- Resultados Teatro -->
      <div v-if="activeFilter === 'teatro' && teatroResults.length > 0">
        <div 
          v-for="(item, index) in sortedTeatroResults"
          :key="index"
          class="filter-item teatro-item"
          @click="showItemDetails(item)"
        >
          <div class="item-header">
            <h4>{{ item.titulo || 'Sin título' }}</h4>
            <span class="item-category">Teatro</span>
          </div>
          <div class="item-details">
            <p v-if="item.municipio || item.poblacion"><strong>🏘️</strong> {{ item.municipio || item.poblacion }}</p>
            <p v-if="item.fecha_inicio"><strong>📅</strong> {{ formatDateRange(item.fecha_inicio, item.fecha_fin) }}</p>
            <p v-if="item.lugar"><strong>📍</strong> {{ item.lugar }}</p>
            <p v-if="item.precio"><strong>💰</strong> {{ formatPrice(item.precio) }}</p>
          </div>
        </div>
      </div>

      <!-- Resultados Pantallas -->
      <div v-if="activeFilter === 'pantallas' && pantallasResults.length > 0">
        <div 
          v-for="(item, index) in sortedPantallasResults"
          :key="index"
          class="filter-item pantallas-item"
          @click="showItemDetails(item)"
        >
          <div class="item-header">
            <h4>{{ item.titulo || 'Sin título' }}</h4>
            <span class="item-category">Cine</span>
          </div>
          <div class="item-details">
            <p v-if="item.fecha"><strong>📅</strong> {{ formatDate(item.fecha) }}</p>
            <p v-if="item.lugar"><strong>📍</strong> {{ item.lugar }}</p>
            <p v-if="item.genero"><strong>🎬</strong> {{ item.genero }}</p>
          </div>
        </div>
      </div>

      <!-- Resultados Exposición -->
      <div v-if="activeFilter === 'exposicion' && exposicionResults.length > 0">
        <div 
          v-for="(item, index) in sortedExposicionResults"
          :key="index"
          class="filter-item exposicion-item"
          @click="showItemDetails(item)"
        >
          <div class="item-header">
            <h4>{{ item.titulo || 'Sin título' }}</h4>
            <span class="item-category">Exposición</span>
          </div>
          <div class="item-details">
            <p v-if="item.fecha_inicio"><strong>📅</strong> {{ formatDate(item.fecha_inicio) }} - {{ formatDate(item.fecha_fin) }}</p>
            <p v-if="item.lugar"><strong>📍</strong> {{ item.lugar }}</p>
            <p v-if="item.descripcion"><strong>ℹ️</strong> {{ truncateText(item.descripcion, 100) }}</p>
          </div>
        </div>
      </div>

      <!-- Resultados Fiestas Patronales -->
      <div v-if="activeFilter === 'fiestasPatronales' && fiestasPatronalesResults.length > 0">
        <div 
          v-for="(item, index) in sortedFiestasPatronalesResults"
          :key="index"
          class="filter-item fiestas-item"
          :class="getFestivalColorClass(item.daysUntil)"
          @click="showItemDetails(item)"
        >
          <div class="item-header">
            <h4>{{ item.municipality_name || 'Sin nombre' }}</h4>
            <span class="item-category festival-badge" :class="getFestivalBadgeClass(item.daysUntil)">
              {{ getFestivalText(item.daysUntil) }}
            </span>
          </div>
          <div class="item-details">
            <p v-if="item.festival_name"><strong>🎉</strong> {{ item.festival_name }}</p>
            <p v-if="item.celebration_dates"><strong>📅</strong> {{ formatFestivalDates(item.celebration_dates) }}</p>
            <p class="days-countdown">
              <strong>⏱️</strong> 
              <span v-if="item.daysUntil === 0">¡Hoy son las fiestas!</span>
              <span v-else-if="item.daysUntil === 1">Falta {{ item.daysUntil }} día</span>
              <span v-else>Faltan {{ item.daysUntil}} días</span>
            </p>
          </div>
        </div>
      </div>

      
      
      <div v-if="activeFilter === 'bibliotecas'">
        <!-- Rutas de Bibliobús con TODAS las paradas -->
        <div v-if="sortedBibliobusRoutes.length > 0" class="bibliobus-routes-section">
          <h3 class="section-title">📚 Rutas de Bibliobús</h3>
          
          <div 
            v-for="(route, ri) in sortedBibliobusRoutes"
            :key="route.ruta || ri"
            class="route-accordion"
          >
            <div 
              class="route-header"
              @click="toggleRoute(route.ruta)"
              :class="{ 'active': expandedRoutes.has(route.ruta) }"
            >
              <div class="route-title">
                <span class="route-icon">🚌</span>
                <h4>{{ route.ruta }}</h4>
                <span class="stops-count">{{ route.stopsCount }} paradas</span>
              </div>
              <div class="route-next" v-if="route.nextStop">
                <span class="next-label">Próxima:</span>
                <span class="next-date">{{ route.nextStop.dia }}</span>
              </div>
              <span class="arrow" :class="{ 'expanded': expandedRoutes.has(route.ruta) }">▼</span>
            </div>
            
            <transition name="slide">
              <div v-if="expandedRoutes.has(route.ruta)" class="route-stops">
                <div 
                  v-for="(stop, si) in route.stops"
                  :key="si"
                  class="stop-card"
                  :class="{ 'next-stop': si === 0 && stop.nextDate }"
                >
                  <div class="stop-number">{{ si + 1 }}</div>
                  <div class="stop-content">
                    <div class="stop-header">
                      <h5>{{ stop.municipio }}</h5>
                      <span v-if="si === 0 && stop.nextDate" class="next-badge">Próxima</span>
                    </div>
                    <div class="stop-details">
                      <p v-if="stop.localidad">
                        <strong>🏘️</strong> {{ stop.localidad }}
                      </p>
                      <p v-if="stop.lugar">
                        <strong>📍</strong> {{ stop.lugar }}
                      </p>
                      <p v-if="stop.dia" class="stop-date">
                        <strong>📅</strong> {{ stop.dia }}
                      </p>
                      <p v-if="stop.hora" class="stop-time">
                        <strong>⏰</strong> {{ stop.hora }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </transition>
          </div>
        </div>

        <!-- Separador -->
        <div v-if="sortedBibliobusRoutes.length > 0 && groupedBibliobus.length > 0" class="section-divider"></div>

        <!-- Puntos agrupados por municipio -->
        <div v-if="groupedBibliobus.length > 0">
          <h3 class="section-title">🏘️ Puntos por Municipio</h3>
          <div 
            v-for="(group, gi) in groupedBibliobus"
            :key="group.cod_ine || group.municipio || gi"
            class="filter-item bibliobus-item"
          >
            <div class="item-header">
              <h4>{{ group.municipio || 'Municipio' }}</h4>
              <span class="item-category">{{ group.count }} puntos</span>
            </div>
            <div class="item-details">
              <ul>
                <li v-for="(stop, si) in group.stops" :key="si">
                  <span v-if="stop.localidad"><strong>🏘️</strong> {{ stop.localidad }}</span>
                  <span v-if="stop.lugar"> · <strong>📍</strong> {{ stop.lugar }}</span>
                  <span v-if="stop.dia"> · <strong>📅</strong> {{ stop.dia }}</span>
                  <span v-if="stop.hora"> · <strong>⏰</strong> {{ stop.hora }}</span>
                  <span v-if="stop.bibliobus"> · <strong>🚌</strong> {{ stop.bibliobus }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>      <!-- Mensaje cuando no hay resultados -->
      <div v-if="!hasResults && !isLoading" class="no-results">
        <p>No se encontraron resultados para este filtro</p>
      </div>

      <!-- Mensaje cuando no hay filtro activo -->
      <div v-if="activeFilter === null && !isLoading" class="no-filter">
        <p>Selecciona un filtro en la leyenda para ver los resultados</p>
      </div>
    </div>

    <!-- Botón para limpiar filtros -->
    <button 
      v-if="activeFilter" 
      @click="clearFilter"
      class="btn btn-danger mt-3"
    >
      Limpiar Filtro
    </button>
  </div>

  <!-- Banner de productos Tierra de Sabor -->
  <div v-if="showProductsBanner" class="products-banner-overlay" @click="closeProductsBanner">
    <div class="products-banner" @click.stop>
      <div class="products-banner-header">
        <h3>{{ selectedEstablishment?.nombre_comercial || selectedEstablishment?.razon_social }}</h3>
        <button class="close-btn" @click="closeProductsBanner">&times;</button>
      </div>
      <div class="products-banner-content">
        <div v-if="loadingProducts" class="loading-container">
          <div class="spinner"></div>
          <p>Cargando productos...</p>
        </div>
        <div v-else-if="tierraSaborProducts.length > 0" class="products-grid">
          <div v-for="product in tierraSaborProducts" :key="product.id" class="product-card">
            <h4>{{ product.nombre }}</h4>
            <p v-if="product.categoria" class="product-category">{{ product.categoria }}</p>
            <p v-if="product.descripcion" class="product-description">{{ truncateText(product.descripcion, 150) }}</p>
            <div class="product-contact">
              <p v-if="product.telefono"><strong>📞</strong> {{ product.telefono }}</p>
              <p v-if="product.email"><strong>✉️</strong> {{ product.email }}</p>
              <p v-if="product.web"><strong>🌐</strong> <a :href="formatWebUrl(product.web)" target="_blank">Ver web</a></p>
            </div>
          </div>
        </div>
        <div v-else class="no-products">
          <p>No se encontraron productos para este establecimiento</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import axios from 'axios'
import { apiService } from '@/services/apiService'

export default {
  name: 'FilterResults',
  props: {
    activeFilter: {
      type: String,
      default: null
    },
    tierraSaborResults: {
      type: Array,
      default: () => []
    },
    teatroResults: {
      type: Array,
      default: () => []
    },
    pantallasResults: {
      type: Array,
      default: () => []
    },
    exposicionResults: {
      type: Array,
      default: () => []
    },
    fiestasPatronalesResults: {
      type: Array,
      default: () => []
    },
    bibliobusGroups: {
      type: Array,
      default: () => []
    },
    bibliobusRoutes: {
      type: Array,
      default: () => []
    },
    isLoading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['clearFilter', 'itemSelected'],
  setup(props, { emit }) {
    // Variables reactivas para el banner de productos
    const showProductsBanner = ref(false)
    const selectedEstablishment = ref(null)
    const tierraSaborProducts = ref([])
    const loadingProducts = ref(false)
    
    // Estado para rutas expandidas (acordeón)
    const expandedRoutes = ref(new Set())
    
    const toggleRoute = (routeName) => {
      if (expandedRoutes.value.has(routeName)) {
        expandedRoutes.value.delete(routeName)
      } else {
        expandedRoutes.value.add(routeName)
      }
      // Forzar reactividad
      expandedRoutes.value = new Set(expandedRoutes.value)
    }
    
    const currentFilterTitle = computed(() => {
      switch (props.activeFilter) {
        case 'tierraSabor':
          return '🍯 Tierra de Sabor'
        case 'teatro':
          return '🎭 Teatro'
        case 'pantallas':
          return '🎬 Pantallas'
        case 'exposicion':
          return '🖼️ Exposiciones'
        case 'fiestasPatronales':
          return '🎉 Fiestas Patronales'
        case 'bibliotecas':
          return '📚 Bibliotecas y Bibliobuses'
        default:
          return 'Nada por aquí de momento'
      }
    })

    const hasResults = computed(() => {
      if (!props.activeFilter) return false
      switch (props.activeFilter) {
        case 'tierraSabor':
          return props.tierraSaborResults.length > 0
        case 'teatro':
          return props.teatroResults.length > 0
        case 'pantallas':
          return props.pantallasResults.length > 0
        case 'exposicion':
          return props.exposicionResults.length > 0
        case 'fiestasPatronales':
          return props.fiestasPatronalesResults.length > 0
        case 'bibliotecas':
          return (props.bibliobusGroups.length > 0) || (props.bibliobusRoutes && props.bibliobusRoutes.length > 0)
        default:
          return false
      }
    })

    const clearFilter = () => {
      emit('clearFilter')
    }

    const showItemDetails = (item) => {
      emit('itemSelected', item)
    }

    const showTierraSaborProducts = async (establishment) => {
      selectedEstablishment.value = establishment
      showProductsBanner.value = true
      loadingProducts.value = true
      tierraSaborProducts.value = []

      try {
        const establishmentId = establishment.id || establishment.idempresa
        if (establishmentId) {
          console.log('Cargando productos para ID:', establishmentId)
          const products = await apiService.getTierraSaborProducts(establishmentId)
          tierraSaborProducts.value = products || []
          console.log('Productos cargados:', products)
        } else {
          console.warn('No se encontró ID del establecimiento')
          tierraSaborProducts.value = []
        }
      } catch (error) {
        console.error('Error obteniendo productos de Tierra de Sabor:', error)
        // En caso de error, mostrar productos mock
        tierraSaborProducts.value = apiService.getMockTierraSaborProducts(
          establishment.nombre_comercial || establishment.razon_social || 'Establecimiento'
        )
      } finally {
        loadingProducts.value = false
      }
    }

    const closeProductsBanner = () => {
      showProductsBanner.value = false
      selectedEstablishment.value = null
      tierraSaborProducts.value = []
    }

    const formatDate = (dateString) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    }

    const formatDateRange = (startDate, endDate) => {
      if (!startDate) return ''
      
      const start = formatDate(startDate)
      
      // Si no hay fecha fin o es la misma que la de inicio, mostrar solo una fecha
      if (!endDate || startDate === endDate) {
        return start
      }
      
      const end = formatDate(endDate)
      return `${start} - ${end}`
    }

    const truncateText = (text, maxLength) => {
      if (!text) return ''
      return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
    }

    const formatWebUrl = (url) => {
      if (!url) return ''
      // Si ya tiene protocolo, devolverla tal como está
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url
      }
      // Si no tiene protocolo, agregar https://
      return `https://${url}`
    }

    // Función para ordenar eventos por fecha
    const sortEventsByDate = (events, dateField = 'fecha_inicio') => {
      if (!events || events.length === 0) return []
      
      return [...events].sort((a, b) => {
        const dateA = a[dateField] || a.fecha || ''
        const dateB = b[dateField] || b.fecha || ''
        
        if (!dateA) return 1
        if (!dateB) return -1
        
        return new Date(dateA) - new Date(dateB)
      })
    }

    // Computed para resultados ordenados
    const sortedTierraSaborResults = computed(() => {
      return props.tierraSaborResults || []
    })

    const sortedTeatroResults = computed(() => {
      return sortEventsByDate(props.teatroResults, 'fecha_inicio')
    })

    const sortedPantallasResults = computed(() => {
      return sortEventsByDate(props.pantallasResults, 'fecha')
    })

    const sortedExposicionResults = computed(() => {
      return sortEventsByDate(props.exposicionResults, 'fecha_inicio')
    })

    // Computed para fiestas patronales ordenadas por días restantes
    const sortedFiestasPatronalesResults = computed(() => {
      if (!props.fiestasPatronalesResults || props.fiestasPatronalesResults.length === 0) return []
      
      return [...props.fiestasPatronalesResults].sort((a, b) => {
        return (a.daysUntil || 999) - (b.daysUntil || 999)
      })
    })

    // Bibliobuses agrupados por municipio
    const groupedBibliobus = computed(() => props.bibliobusGroups || [])

    // Rutas de bibliobús ordenadas por próxima parada
    const sortedBibliobusRoutes = computed(() => {
      const routes = props.bibliobusRoutes || []
      return [...routes].sort((a, b) => {
        const ad = a?.nextStop?.nextDate ? new Date(a.nextStop.nextDate).getTime() : Infinity
        const bd = b?.nextStop?.nextDate ? new Date(b.nextStop.nextDate).getTime() : Infinity
        if (ad === bd) return (a.ruta || '').localeCompare(b.ruta || '')
        return ad - bd
      })
    })

    // Helper functions for Fiestas Patronales
    const getFestivalColorClass = (daysUntil) => {
      if (daysUntil === null || daysUntil === undefined) return 'festival-gray'
      if (daysUntil <= 30) return 'festival-red'
      if (daysUntil <= 60) return 'festival-orange'
      return 'festival-gray'
    }

    const getFestivalBadgeClass = (daysUntil) => {
      if (daysUntil === null || daysUntil === undefined) return 'badge-gray'
      if (daysUntil <= 30) return 'badge-red'
      if (daysUntil <= 60) return 'badge-orange'
      return 'badge-gray'
    }

    const getFestivalText = (daysUntil) => {
      if (daysUntil === null || daysUntil === undefined) return 'Sin fecha'
      if (daysUntil === 0) return '¡Hoy!'
      if (daysUntil <= 30) return `${daysUntil}d`
      if (daysUntil <= 60) return `${daysUntil}d`
      return `${daysUntil}d`
    }

    const formatFestivalDates = (celebrationDates) => {
      if (!celebrationDates) return ''
      
      const monthsEs = {
        '01': 'enero', '02': 'febrero', '03': 'marzo', '04': 'abril', '05': 'mayo', '06': 'junio',
        '07': 'julio', '08': 'agosto', '09': 'septiembre', '10': 'octubre', '11': 'noviembre', '12': 'diciembre'
      }

      const formatMonthDay = (mmdd) => {
        if (!mmdd || typeof mmdd !== 'string' || mmdd.length < 4) return ''
        const [mm, dd] = mmdd.split('-')
        const mes = monthsEs[mm] || mm
        return `${parseInt(dd, 10)} de ${mes}`
      }

      const start = formatMonthDay(celebrationDates.start_date)
      const end = formatMonthDay(celebrationDates.end_date)
      
      if (!end || start === end) return start
      
      const [sm] = celebrationDates.start_date.split('-')
      const [em] = celebrationDates.end_date.split('-')
      
      if (sm === em) {
        const mes = monthsEs[sm] || sm
        const sd = parseInt(celebrationDates.start_date.split('-')[1], 10)
        const ed = parseInt(celebrationDates.end_date.split('-')[1], 10)
        return `del ${sd} al ${ed} de ${mes}`
      }
      
      return `${start} y ${end}`
    }

    const formatPrice = (priceString) => {
      if (!priceString) return ''
      
      // Si contiene múltiples precios separados por guiones
      if (priceString.includes('-')) {
        const prices = priceString.split('-').filter(price => price.trim())
        
        // Formatear cada precio individual
        const formattedPrices = prices.map(price => {
          // Extraer solo números, comas y puntos
          const cleanPrice = price.replace(/[^\d,.-]/g, '').trim()
          if (cleanPrice) {
            // Asegurar formato de euro
            if (!price.includes('€') && !price.toLowerCase().includes('euro')) {
              return `${cleanPrice}€`
            }
            return cleanPrice.includes('€') ? cleanPrice : `${cleanPrice}€`
          }
          return price.trim()
        })
        
        // Para FilterResults, formato más compacto
        if (formattedPrices.length === 2) {
          return `${formattedPrices[0]} / ${formattedPrices[1]} (reducida)`
        } else if (formattedPrices.length === 3) {
          return `${formattedPrices[0]} / ${formattedPrices[1]} / ${formattedPrices[2]}`
        } else {
          return formattedPrices.join(' / ')
        }
      }
      
      // Para precios simples, limpiar y formatear
      const cleanPrice = priceString.replace(/[^\d,.-]/g, '').trim()
      if (cleanPrice && !priceString.includes('€') && !priceString.toLowerCase().includes('euro')) {
        return `${cleanPrice}€`
      }
      
      return priceString
    }

    return {
      currentFilterTitle,
      hasResults,
      clearFilter,
      showItemDetails,
      showTierraSaborProducts,
      closeProductsBanner,
      formatDate,
      formatDateRange,
      truncateText,
      formatWebUrl,
      formatPrice,
      // Resultados ordenados
      sortedTierraSaborResults,
      sortedTeatroResults,
      sortedPantallasResults,
      sortedExposicionResults,
      sortedFiestasPatronalesResults,
      // Festival helpers
      getFestivalColorClass,
      getFestivalBadgeClass,
      getFestivalText,
      formatFestivalDates,
      // Bibliobuses
      groupedBibliobus,
      sortedBibliobusRoutes,
      expandedRoutes,
      toggleRoute,
      // Variables reactivas del banner
      showProductsBanner,
      selectedEstablishment,
      tierraSaborProducts,
      loadingProducts
    }
  }
}
</script>

<style scoped>
.filter-content {
  padding: 0;
}

.filter-content h2 {
  color: var(--text-primary);
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Estilos para los elementos de filtro */
.filter-item {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  margin: 10px 0;
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 4px solid transparent;
}

.filter-item:hover {
  background: var(--bg-tertiary);
  border-left-color: var(--primary-color);
  transform: translateX(2px);
  box-shadow: 0 2px 8px var(--shadow-color);
}

.tierra-sabor-item {
  border-left-color: #ff9800;
}

.teatro-item {
  border-left-color: #e91e63;
}

.pantallas-item {
  border-left-color: #9c27b0;
}

.exposicion-item {
  border-left-color: #3f51b5;
}

.bibliobus-item {
  border-left-color: #2e7d32; /* verde */
}

/* Sección de rutas de bibliobús */
.bibliobus-routes-section {
  margin-bottom: 20px;
}

.section-title {
  color: var(--text-primary);
  font-size: 1.2rem;
  font-weight: 600;
  margin: 15px 0 10px 0;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-left: 4px solid var(--primary-color);
  border-radius: 4px;
}

.section-divider {
  height: 2px;
  background: linear-gradient(to right, transparent, var(--border-color), transparent);
  margin: 20px 0;
}

.route-accordion {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin: 10px 0;
  overflow: hidden;
  transition: all 0.3s ease;
}

.route-accordion:hover {
  box-shadow: 0 2px 8px var(--shadow-color);
}

.route-header {
  padding: 14px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-secondary);
  border-left: 4px solid #2e7d32;
  transition: all 0.2s ease;
  gap: 12px;
}

.route-header:hover {
  background: var(--bg-tertiary);
  border-left-color: var(--primary-color);
}

.route-header.active {
  background: var(--bg-tertiary);
  border-left-color: var(--primary-color);
}

.route-title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.route-icon {
  font-size: 1.3rem;
}

.route-title h4 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-primary);
  font-weight: 600;
}

.stops-count {
  background: var(--primary-color);
  color: var(--text-light);
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.route-next {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-size: 0.85rem;
}

.next-label {
  color: var(--text-secondary);
  font-size: 0.7rem;
  text-transform: uppercase;
  font-weight: 500;
}

.next-date {
  color: var(--text-primary);
  font-weight: 600;
}

.arrow {
  font-size: 0.8rem;
  color: var(--text-secondary);
  transition: transform 0.3s ease;
  min-width: 20px;
  text-align: center;
}

.arrow.expanded {
  transform: rotate(180deg);
}

.route-stops {
  padding: 0 16px 12px 16px;
  background: var(--bg-primary);
}

.slide-enter-active, .slide-leave-active {
  transition: all 0.3s ease;
  max-height: 2000px;
  overflow: hidden;
}

.slide-enter-from, .slide-leave-to {
  max-height: 0;
  opacity: 0;
}

.stop-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  margin: 8px 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  border-left: 3px solid var(--border-color);
  transition: all 0.2s ease;
}

.stop-card:hover {
  background: var(--bg-tertiary);
  border-left-color: #2e7d32;
  transform: translateX(3px);
}

.stop-card.next-stop {
  background: rgba(46, 125, 50, 0.08);
  border-left-color: #2e7d32;
  border-left-width: 4px;
}

.stop-number {
  min-width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-color);
  color: var(--text-light);
  border-radius: 50%;
  font-weight: 600;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.stop-card.next-stop .stop-number {
  background: #2e7d32;
  animation: pulse-green 2s ease-in-out infinite;
}

@keyframes pulse-green {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(46, 125, 50, 0.7);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(46, 125, 50, 0);
  }
}

.stop-content {
  flex: 1;
}

.stop-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.stop-header h5 {
  margin: 0;
  font-size: 1rem;
  color: var(--text-primary);
  font-weight: 600;
}

.next-badge {
  background: #2e7d32;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}

.stop-details p {
  margin: 4px 0;
  font-size: 0.88rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.stop-date, .stop-time {
  font-weight: 500;
  color: var(--text-primary);
}

/* Fiestas Patronales color coding */
.fiestas-item {
  border-left-width: 4px;
}

.festival-red {
  border-left-color: #f44336;
  background: rgba(244, 67, 54, 0.05);
}

.festival-red:hover {
  background: rgba(244, 67, 54, 0.1);
}

.festival-orange {
  border-left-color: #ff9800;
  background: rgba(255, 152, 0, 0.05);
}

.festival-orange:hover {
  background: rgba(255, 152, 0, 0.1);
}

.festival-gray {
  border-left-color: #9e9e9e;
}

.festival-badge {
  font-weight: bold;
  font-size: 0.8rem;
}

.badge-red {
  background: #f44336;
  animation: pulse 1.5s ease-in-out infinite;
}

.badge-orange {
  background: #ff9800;
}

.badge-gray {
  background: #9e9e9e;
}

.days-countdown {
  font-weight: 600;
  color: var(--text-primary) !important;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.item-header h4 {
  margin: 0;
  font-size: 1rem;
  color: var(--text-primary);
  flex: 1;
  line-height: 1.3;
}

.item-category {
  background: var(--primary-color);
  color: var(--text-light);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  white-space: nowrap;
  margin-left: 8px;
}

.item-details p {
  margin: 4px 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border-color);
  border-top: 4px solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.no-results, .no-filter {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
  font-style: italic;
}

/* Scroll personalizado */
.filter-results {
  max-height: 800px;
  overflow-y: auto;
}

.filter-results::-webkit-scrollbar {
  width: 6px;
}

.filter-results::-webkit-scrollbar-track {
  background: var(--bg-secondary);
  border-radius: 3px;
}

.filter-results::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.filter-results::-webkit-scrollbar-thumb:hover {
  background: var(--primary-color);
}

/* Botones mejorados */
.btn-danger {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
  border: none;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn-danger:hover {
  background: linear-gradient(135deg, #ff5252 0%, #e91e63 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.4);
}

a {
  color: #ffffff;
  text-decoration: none;
}

a:hover {
  text-decoration: none;
}

/* Estilos para el banner de productos */
.products-banner-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.products-banner {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.products-banner-header {
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  color: white;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.products-banner-header h3 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 2rem;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.3s ease;
}

.close-btn:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.products-banner-content {
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

.product-card {
  background: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.product-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.product-card h4 {
  color: #333;
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.product-category {
  color: #4CAF50;
  font-weight: 500;
  font-size: 0.9rem;
  margin: 0 0 8px 0;
}

.product-description {
  color: #666;
  font-size: 0.9rem;
  line-height: 1.4;
  margin: 0 0 12px 0;
}

.product-contact {
  border-top: 1px solid #eee;
  padding-top: 8px;
}

.product-contact p {
  margin: 4px 0;
  font-size: 0.85rem;
  color: #555;
}

.product-contact a {
  color: #4CAF50;
  text-decoration: none;
}

.product-contact a:hover {
  text-decoration: underline;
}

.no-products {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

.no-products p {
  margin: 0;
  font-size: 1.1rem;
}
</style>
