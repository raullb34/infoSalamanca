<template>
  <div class="filter-content">
    <!-- Cabecera: qué filtro es, cuántos resultados y cómo quitarlo -->
    <header v-if="activeFilter" class="results-header">
      <div class="results-title-row">
        <h2 class="results-title">{{ currentFilterTitle }}</h2>
        <button type="button" class="clear-link" @click="clearFilter" title="Quitar el filtro del mapa">
          Quitar filtro ✕
        </button>
      </div>
      <p class="results-sub">
        <span v-if="!isLoading && resultCount">{{ resultCount }} {{ resultCount === 1 ? 'resultado' : 'resultados' }} · </span>{{ currentFilterSubtitle }}
      </p>
    </header>

    <!-- Loader mientras carga -->
    <div v-if="isLoading" class="loading-container">
      <div class="spinner"></div>
      <p>Cargando resultados...</p>
    </div>

    <div v-else class="filter-results">
      <!-- Tierra de Sabor: productores -->
      <div v-if="activeFilter === 'tierraSabor' && tierraSaborResults.length > 0" class="rcard-list">
        <article
          v-for="(item, index) in sortedTierraSaborResults"
          :key="item.idempresa || index"
          class="rcard"
          tabindex="0"
          @click="showTierraSaborProducts(item)"
          @keydown.enter="showTierraSaborProducts(item)"
        >
          <div class="rcard-avatar" aria-hidden="true">{{ initial(item.nombre_comercial || item.razon_social) }}</div>
          <div class="rcard-body">
            <h4 class="rcard-title">{{ titleCase(item.nombre_comercial || item.razon_social) || 'Sin nombre' }}</h4>
            <p v-if="item.localidad" class="rcard-meta">
              {{ titleCase(item.localidad) }}<span v-if="item.secciones?.length"> · {{ item.secciones.join(', ') }}</span>
            </p>
            <p v-if="item.direccion" class="rcard-sub">{{ titleCase(item.direccion) }}</p>
            <!-- Dónde comprar (datos sacados de la web de cada productor) -->
            <div class="ts-actions" @click.stop @keydown.enter.stop>
              <a v-if="item.venta?.online" :href="item.venta.online.url" target="_blank" rel="noopener noreferrer" class="ts-action buy">🛒 Tienda online</a>
              <a v-if="item.venta?.dondeComprar" :href="item.venta.dondeComprar.url" target="_blank" rel="noopener noreferrer" class="ts-action">📍 Dónde comprar</a>
              <a v-if="item.venta?.telefono" :href="`tel:${item.venta.telefono.replace(/\s/g, '')}`" class="ts-action">📞 {{ item.venta.telefono }}</a>
              <a v-if="item.web" :href="formatWebUrl(item.web)" target="_blank" rel="noopener noreferrer" class="ts-action">Web ↗</a>
              <span v-else-if="item.web_estado && item.web_estado !== 'sin web'" class="ts-nolink" :title="`La web que publica la Junta (${item.web_estado})`">Web no disponible</span>
            </div>
          </div>
        </article>
      </div>

      <!-- Teatro: funciones de hoy en adelante, agrupadas por mes -->
      <div v-if="activeFilter === 'teatro' && upcomingTeatro.length > 0" class="rcard-list">
        <template v-for="group in teatroByMonth" :key="group.label">
          <h3 class="month-header">{{ group.label }}</h3>
          <article
            v-for="(item, index) in group.items"
            :key="item.id_evento || index"
            class="rcard"
            tabindex="0"
            @click="showItemDetails(item)"
            @keydown.enter="showItemDetails(item)"
          >
            <div class="date-block" aria-hidden="true">
              <span class="date-day">{{ dayOf(item.fecha_inicio) }}</span>
              <span class="date-month">{{ monthShort(item.fecha_inicio) }}</span>
            </div>
            <div class="rcard-body">
              <h4 class="rcard-title">{{ item.titulo || 'Sin título' }}</h4>
              <p class="rcard-meta">
                {{ item.municipio || item.poblacion || item.nombre_localidad }}<span v-if="item.lugar || item.nombre_lugar"> · {{ item.lugar || item.nombre_lugar }}</span>
              </p>
              <p class="rcard-sub">{{ eventExtras(item) }}</p>
            </div>
          </article>
        </template>
      </div>

      <!-- Fiestas patronales: por la más próxima -->
      <div v-if="activeFilter === 'fiestasPatronales' && fiestasPatronalesResults.length > 0" class="rcard-list">
        <article
          v-for="(item, index) in sortedFiestasPatronalesResults"
          :key="item.cod_ine || index"
          class="rcard"
          tabindex="0"
          @click="showItemDetails(item)"
          @keydown.enter="showItemDetails(item)"
        >
          <div class="countdown" :class="{ soon: item.daysUntil != null && item.daysUntil <= 30, today: item.daysUntil === 0 }" aria-hidden="true">
            <template v-if="item.daysUntil === 0"><span class="countdown-n">¡Hoy!</span></template>
            <template v-else-if="item.daysUntil != null">
              <span class="countdown-n">{{ item.daysUntil }}</span>
              <span class="countdown-u">{{ item.daysUntil === 1 ? 'día' : 'días' }}</span>
            </template>
            <span v-else class="countdown-u">sin fecha</span>
          </div>
          <div class="rcard-body">
            <h4 class="rcard-title">{{ item.municipality_name || 'Sin nombre' }}</h4>
            <p v-if="item.celebration_dates" class="rcard-meta">{{ capitalize(formatFestivalDates(item.celebration_dates)) }}</p>
            <p v-if="item.festival_name && item.festival_name !== 'Fiestas Patronales'" class="rcard-sub">{{ item.festival_name }}</p>
          </div>
        </article>
      </div>

      <!-- Bibliotecas y bibliobuses -->
      <div v-if="activeFilter === 'bibliotecas'">
        <div v-if="sortedBibliobusRoutes.length > 0" class="bibliobus-routes-section">
          <!-- Por comarca: los números de ruta se repiten entre bibliobuses y no orientan -->
          <template v-for="group in routesByComarca" :key="group.comarca">
          <h3 class="month-header">{{ group.comarca }}</h3>
          <div
            v-for="(route, ri) in group.routes"
            :key="route.ruta || ri"
            class="route-accordion"
            :class="{ 'from-map': mapRoute === route.ruta }"
            :data-route="route.ruta"
          >
            <button
              type="button"
              class="route-header"
              :class="{ active: expandedRoutes.has(route.ruta) }"
              :aria-expanded="expandedRoutes.has(route.ruta)"
              @click="toggleRoute(route.ruta)"
            >
              <span class="route-icon" :style="{ background: route.color }" aria-hidden="true">🚌</span>
              <span class="route-text">
                <span class="route-name">{{ route.title }}</span>
                <span class="route-info">
                  <span v-if="route.label">{{ route.label }} · </span>{{ route.stopsCount }} {{ route.stopsCount === 1 ? 'parada' : 'paradas' }}<span v-if="route.nextStop"> · próxima: {{ shortDay(route.nextStop.dia) }}</span>
                </span>
              </span>
              <span class="arrow" :class="{ expanded: expandedRoutes.has(route.ruta) }" aria-hidden="true">▾</span>
            </button>

            <transition name="slide">
              <ol v-if="expandedRoutes.has(route.ruta)" class="route-stops">
                <li
                  v-for="(stop, si) in route.stops"
                  :key="si"
                  class="stop-row"
                  :class="{ 'next-stop': stop === route.nextStop }"
                >
                  <span class="stop-number">{{ si + 1 }}</span>
                  <span class="stop-text">
                    <strong>{{ townName(stop.municipio) }}</strong>
                    <span v-if="stop === route.nextStop" class="next-badge">Próxima</span>
                    <span class="stop-detail">{{ [townName(stop.localidad) !== townName(stop.municipio) ? stop.localidad : '', stop.lugar].filter(Boolean).join(' · ') }}</span>
                    <span class="stop-detail">{{ shortDay(stop.dia) }}</span>
                    <span v-if="stop.hora" class="stop-detail stop-hours">{{ stop.hora }}</span>
                  </span>
                </li>
              </ol>
            </transition>
          </div>
          </template>
        </div>

        <div v-if="groupedBibliobus.length > 0" class="rcard-list">
          <h3 class="month-header">Paradas por municipio</h3>
          <article
            v-for="(group, gi) in groupedBibliobus"
            :key="group.cod_ine || group.municipio || gi"
            class="rcard rcard-static"
          >
            <div class="rcard-avatar" aria-hidden="true">{{ group.count }}</div>
            <div class="rcard-body">
              <h4 class="rcard-title">{{ group.municipio || 'Municipio' }}</h4>
              <p v-for="(stop, si) in group.stops" :key="si" class="rcard-sub">
                {{ [stop.localidad, stop.lugar, stop.dia, stop.hora].filter(Boolean).join(' · ') }}
              </p>
            </div>
          </article>
        </div>
      </div>

      <!-- Sin resultados -->
      <div v-if="activeFilter && !hasResults && !isLoading" class="empty-state">
        <span class="empty-icon" aria-hidden="true">🔎</span>
        <p>No hay resultados para este filtro ahora mismo.</p>
      </div>

      <!-- Sin filtro -->
      <div v-if="activeFilter === null && !isLoading" class="empty-state">
        <span class="empty-icon" aria-hidden="true">🗺️</span>
        <h3>Explora la provincia</h3>
        <p>Elige una categoría encima del mapa (<strong>Cultura</strong> o <strong>Turismo</strong>) y después un filtro. Los pueblos se colorearán en el mapa y aquí verás la lista.</p>
      </div>
    </div>
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { apiService } from '@/services/apiService'
import { mergeBibliobusRoutes, groupRoutesByComarca, loadComarcas } from '@/utils/bibliobusRoutes'
import { formatFestivalDays } from '@/utils/festivals'

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
    
    // Ruta pulsada en el mapa (InteractiveMap lanza 'selectRoute'): se abre aquí y se lleva a la vista
    const mapRoute = ref(null)
    let flashTimer = null
    const handleMapRoute = (event) => {
      const ruta = event.detail?.ruta
      if (!ruta) return
      expandedRoutes.value = new Set([...expandedRoutes.value, ruta])
      window.dispatchEvent(new CustomEvent('highlightRoute', { detail: { ruta, focus: false } }))
      mapRoute.value = ruta
      clearTimeout(flashTimer)
      flashTimer = setTimeout(() => { mapRoute.value = null }, 1600)
      // Esperar a que el panel termine de abrirse antes de hacer scroll
      setTimeout(() => {
        const el = [...document.querySelectorAll('.route-accordion[data-route]')].find(n => n.dataset.route === ruta)
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      }, 350)
    }
    onMounted(() => window.addEventListener('selectRoute', handleMapRoute))
    onUnmounted(() => {
      window.removeEventListener('selectRoute', handleMapRoute)
      clearTimeout(flashTimer)
    })

    const toggleRoute = (routeName) => {
      if (expandedRoutes.value.has(routeName)) {
        expandedRoutes.value.delete(routeName)
      } else {
        expandedRoutes.value.add(routeName)
      }
      // Forzar reactividad
      expandedRoutes.value = new Set(expandedRoutes.value)
      // Resaltar en el mapa la última ruta abierta (InteractiveMap escucha 'highlightRoute')
      const open = expandedRoutes.value.has(routeName) ? routeName : [...expandedRoutes.value].pop() || null
      // focus: al abrirla, el mapa se acerca a la ruta
      window.dispatchEvent(new CustomEvent('highlightRoute', { detail: { ruta: open, focus: expandedRoutes.value.has(routeName) } }))
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

    const currentFilterSubtitle = computed(() => {
      switch (props.activeFilter) {
        case 'tierraSabor': return 'Productores con el sello Tierra de Sabor'
        case 'teatro': return 'Próximas funciones en la provincia'
        case 'fiestasPatronales': return 'De la más próxima a la más lejana'
        case 'bibliotecas': return 'Rutas del bibliobús y sus paradas'
        default: return ''
      }
    })

    // ---------- Teatro: solo de hoy en adelante, agrupado por mes ----------
    const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    const parseDay = (s) => {
      const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
      return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
    }
    const upcomingTeatro = computed(() => {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      return sortEventsByDate(props.teatroResults, 'fecha_inicio').filter(ev => {
        const end = parseDay(ev.fecha_fin) || parseDay(ev.fecha_inicio)
        return !end || end >= today
      })
    })
    const teatroByMonth = computed(() => {
      const groups = []
      for (const ev of upcomingTeatro.value) {
        const d = parseDay(ev.fecha_inicio)
        const label = d ? `${MONTHS[d.getMonth()][0].toUpperCase()}${MONTHS[d.getMonth()].slice(1)} ${d.getFullYear()}` : 'Sin fecha'
        if (!groups.length || groups[groups.length - 1].label !== label) groups.push({ label, items: [] })
        groups[groups.length - 1].items.push(ev)
      }
      return groups
    })
    const dayOf = (s) => parseDay(s)?.getDate() ?? '—'
    const monthShort = (s) => { const d = parseDay(s); return d ? MONTHS[d.getMonth()].slice(0, 3) : '' }

    // "CARNICAS IBERICAS MOZARBEZ" → "Carnicas Ibericas Mozarbez" (las palabras cortas, en minúscula)
    const SMALL_WORDS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'a'])
    const titleCase = (text) => {
      if (!text) return ''
      return String(text).toLowerCase().split(/(\s+|-)/).map((w, i) =>
        (i > 0 && SMALL_WORDS.has(w)) || !/[a-záéíóúñü]/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)
      ).join('')
    }
    // "19:00 h · hasta el 30/11/2026 · 3 euros" (sin huecos ni precios vacíos)
    const eventExtras = (ev) => {
      const parts = []
      if (ev.hora_inicio) parts.push(ev.hora_inicio)
      if (ev.fecha_fin && ev.fecha_fin !== ev.fecha_inicio) parts.push(`hasta el ${formatDate(ev.fecha_fin)}`)
      const price = ev.precio ? formatPrice(ev.precio) : ''
      if (/\d/.test(price) || /gratu/i.test(ev.precio || '')) parts.push(/gratu/i.test(ev.precio || '') ? 'Gratis' : price)
      return parts.join(' · ')
    }
    const initial = (text) => (String(text || '?').trim()[0] || '?').toUpperCase()
    const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : '')

    const resultCount = computed(() => {
      switch (props.activeFilter) {
        case 'tierraSabor': return props.tierraSaborResults.length
        case 'teatro': return upcomingTeatro.value.length
        case 'fiestasPatronales': return props.fiestasPatronalesResults.length
        case 'bibliotecas': return sortedBibliobusRoutes.value.length // rutas ya fusionadas
        default: return 0
      }
    })

    const hasResults = computed(() => {
      if (!props.activeFilter) return false
      switch (props.activeFilter) {
        case 'tierraSabor':
          return props.tierraSaborResults.length > 0
        case 'teatro':
          return upcomingTeatro.value.length > 0
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
        tierraSaborProducts.value = []
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
      
      // ?? y no ||: las de hoy (0 días) van primero
      return [...props.fiestasPatronalesResults].sort((a, b) => (a.daysUntil ?? 999) - (b.daysUntil ?? 999))
    })

    // Bibliobuses agrupados por municipio
    const groupedBibliobus = computed(() => props.bibliobusGroups || [])

    // Rutas de bibliobús ordenadas por próxima parada
    // Rutas sin duplicados (los datos traen la misma ruta escrita de varias formas)
    const comarcas = ref({})
    loadComarcas().then(data => { comarcas.value = data })
    const sortedBibliobusRoutes = computed(() => mergeBibliobusRoutes(props.bibliobusRoutes || [], comarcas.value))
    const routesByComarca = computed(() => groupRoutesByComarca(sortedBibliobusRoutes.value))
    // "Alberguería de Argañán, La" → "La Alberguería de Argañán"
    const townName = (name) => String(name || '').replace(/^(.*),\s*(La|El|Los|Las)$/i, '$2 $1')
    // "30/11/2026 (lunes)" → "lunes 30/11"
    const shortDay = (dia) => {
      const m = String(dia || '').match(/(\d{2})\/(\d{2})\/\d{4}\s*\(([^)]+)\)/) // ([^)]+): "miércoles" lleva tilde
      return m ? `${m[3]} ${m[1]}/${m[2]}` : dia || ''
    }

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

    // Dos días sueltos de fiesta, no un intervalo (utils/festivals.js)
    const formatFestivalDates = formatFestivalDays

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
      mapRoute,
      currentFilterTitle,
      currentFilterSubtitle,
      resultCount,
      upcomingTeatro,
      teatroByMonth,
      dayOf,
      monthShort,
      titleCase,
      initial,
      capitalize,
      eventExtras,
      shortDay,
      townName,
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
      routesByComarca,
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

/* Ruta que se acaba de pulsar en el mapa: destello breve */
.route-accordion.from-map {
  animation: route-flash 1.6s ease-out;
}
@keyframes route-flash {
  0%, 40% { box-shadow: 0 0 0 3px var(--primary-color, #4caf50); }
  100% { box-shadow: 0 0 0 0 transparent; }
}
@media (prefers-reduced-motion: reduce) {
  .route-accordion.from-map { animation: none; outline: 3px solid var(--primary-color, #4caf50); }
}

/* Círculo con el color de la ruta en el mapa */
.route-icon {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  background: var(--bg-tertiary, #ddd);
  box-shadow: 0 0 0 2px var(--bg-primary, #fff), 0 0 0 3px rgba(0, 0, 0, 0.12);
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

/* =====================================================================
   Diseño de tarjetas (nov 2026): una sola tarjeta para todos los filtros
   ===================================================================== */

/* Cabecera */
.results-header {
  margin-bottom: 12px;
}

.results-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

/* .filter-content delante para ganar a la regla antigua ".filter-content h2" */
.filter-content .results-title {
  margin: 0;
  padding: 0;
  border: none;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-primary);
}

.clear-link {
  flex-shrink: 0;
  border: none;
  background: none;
  padding: 2px 4px;
  font-size: 0.78rem;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 6px;
}

.clear-link:hover {
  color: var(--danger-color, #e53935);
  background: var(--bg-secondary);
}

.results-sub {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

/* Lista y separadores de mes */
.rcard-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.month-header {
  margin: 10px 0 2px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.rcard-list > .month-header:first-child,
.bibliobus-routes-section > .month-header:first-child {
  margin-top: 0;
}

/* Tarjeta */
.rcard {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.rcard:hover {
  border-color: var(--primary-color);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}

.rcard:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.rcard.rcard-static {
  cursor: default;
}

.rcard.rcard-static:hover {
  border-color: var(--border-light);
  box-shadow: none;
}

.rcard-body {
  flex: 1;
  min-width: 0;
}

.rcard-title {
  margin: 0 0 2px;
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--text-primary);
}

.rcard-meta {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.35;
}

.rcard-sub {
  margin: 2px 0 0;
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.35;
}

.rcard-sub:empty {
  display: none;
}

/* Tierra de Sabor: dónde comprar */
.ts-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin-top: 6px;
}
.ts-action {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--border-primary, #ddd);
  color: var(--text-primary) !important;
  text-decoration: none;
  white-space: nowrap;
}
.ts-action:hover,
.ts-action:focus-visible {
  border-color: var(--primary-color);
  outline: none;
}
.ts-action.buy {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #fff !important;
}
.ts-nolink {
  font-size: 0.72rem;
  color: var(--text-secondary, #888);
  padding: 3px 0;
}

.rcard a.rcard-link {
  flex-shrink: 0;
  align-self: center;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--primary-color) !important;
  text-decoration: none;
  padding: 4px 6px;
  border-radius: 6px;
}

.rcard a.rcard-link:hover {
  background: var(--bg-secondary);
}

/* Bloque de fecha (eventos) */
.date-block {
  flex-shrink: 0;
  width: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0;
  border-radius: 10px;
  background: color-mix(in srgb, var(--primary-color) 12%, var(--bg-primary));
  color: var(--primary-color);
}

.date-day {
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.1;
}

.date-month {
  font-size: 0.66rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Inicial (productores) y nº de paradas */
.rcard-avatar {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.95rem;
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

/* Cuenta atrás (fiestas) */
.countdown {
  flex-shrink: 0;
  width: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0;
  border-radius: 10px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.countdown.soon {
  background: color-mix(in srgb, #ff7043 16%, var(--bg-primary));
  color: #e2552a;
}

.countdown.today {
  background: #ff7043;
  color: #fff;
}

.countdown-n {
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1.15;
}

.countdown-u {
  font-size: 0.66rem;
  font-weight: 600;
}

/* Bibliobús: rutas plegables */
.route-accordion {
  border: 1px solid var(--border-light);
  border-radius: 12px;
  margin-bottom: 8px;
  overflow: hidden;
  background: var(--bg-primary);
}

.route-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: var(--text-primary);
}

.route-header:hover,
.route-header.active {
  background: var(--bg-secondary);
}

.route-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.route-name {
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.3;
}

.route-towns {
  font-size: 0.78rem;
  color: var(--text-secondary);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.route-info {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* El horario viene con saltos de línea en los datos de la Junta */
.stop-hours {
  white-space: pre-line;
}

.route-header .arrow {
  color: var(--text-muted);
  transition: transform 0.2s ease;
}

.route-header .arrow.expanded {
  transform: rotate(180deg);
}

.route-stops {
  list-style: none;
  margin: 0;
  padding: 4px 12px 10px;
}

.stop-row {
  display: flex;
  gap: 10px;
  padding: 6px 0;
  border-top: 1px solid var(--border-light);
}

.stop-row:first-child {
  border-top: none;
}

.route-stops .stop-number {
  flex: 0 0 22px;
  width: 22px;
  min-width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 50%;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 0.72rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.route-stops .stop-row.next-stop .stop-number {
  background: var(--primary-color);
  color: #fff;
}

.stop-text {
  display: flex;
  flex-direction: column;
  font-size: 0.8rem;
  color: var(--text-primary);
}

.stop-detail {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.stop-detail:empty {
  display: none;
}

.next-badge {
  align-self: flex-start;
  margin: 2px 0;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 700;
  background: var(--primary-color);
  color: #fff;
}

/* Estados vacíos */
.empty-state {
  text-align: center;
  padding: 32px 12px;
  color: var(--text-secondary);
}

.empty-state .empty-icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 8px;
}

.empty-state h3 {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.empty-state p {
  font-size: 0.85rem;
  line-height: 1.5;
  margin: 0;
}
</style>
