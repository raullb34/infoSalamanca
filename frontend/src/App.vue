<template>
  <div id="app">

    <!-- Barra superior: panel, marca, buscador, vista 2D/3D y tema -->
    <header class="app-topbar">
      <button
        type="button"
        class="topbar-menu"
        :class="{ active: leftPanelOpen }"
        :aria-pressed="leftPanelOpen"
        aria-label="Abrir o cerrar el panel de filtros, rutas y agenda"
        title="Filtros, rutas y agenda"
        @click="toggleLeftPanel"
      >☰</button>
      <span class="topbar-brand">info<strong>Salamanca</strong></span>
      <SearchBar @municipioSelected="handleMunicipioSelected" />
      <MapViewSwitch :mode="mapMode" @change="setMapMode" />
      <ThemeToggle class="topbar-theme" />
    </header>

    <!-- Categorías y sus filtros, sobre el mapa -->
    <CategoryBar
      :activeCategory="activeCategory"
      :filters="eventFilters"
      :legend="highlightLegend"
      :resultCount="activeResultCount"
      @openList="openLeftPanel"
      @selectCategory="category => handleSaLLMantinoFilters({ category, filters: [] })"
      @filterClick="handleFilterClick"
    />

    <!-- Sidebar de filtros -->
        <FilterSidebar 
      ref="filterSidebarRef"
      :activeFilter="activeFilter"
      :tierraSaborResults="filterResults.tierraSabor"
      :teatroResults="filterResults.teatro"
      :pantallasResults="filterResults.pantallas"
      :exposicionResults="filterResults.exposicion"
      :fiestasPatronalesResults="filterResults.fiestasPatronales"
      :bibliobusGroups="filterResults.bibliobusGroups"
      :bibliobusRoutes="filterResults.bibliobusRoutes"
      :isLoading="filterLoading"
      :routeList="routeList"
      :showTooltips="showTooltips"
      @clearFilter="handleClearFilter"
      @itemSelected="handleFilterItemSelected"
      @generateRoute="handleGenerateRoute"
      @removeFromRoute="handleRemoveFromRoute"
      @toggleTooltips="handleToggleTooltips"
      @toggleAutoExpand="handleToggleAutoExpand"
      @eventSelected="handleAgendaEventSelected"
      @eventExported="handleAgendaEventExported"
    />
    
    <!-- Contenedor del mapa: 2D (siempre montado) o relieve 3D (se carga al pedirlo) -->
    <InteractiveMap 
      v-show="mapMode === '2d'"
      ref="interactiveMapRef"
      :highlights="filterHighlights"
      :libraryMunicipiosPhysical="libraryMunicipiosPhysical"
      :libraryMunicipiosMobile="libraryMunicipiosMobile"
      :libraryDetails="libraryDetailsByMunicipio"
      :bibliobusRoutes="filterResults.bibliobusRoutes"
      :showTooltips="showTooltips"
      @townSelected="handleTownSelected"
      @townDeselected="handleTownDeselected"
    />
    <RelieveMap
      ref="relieveMapRef"
      v-if="relieveMounted"
      v-show="mapMode === '3d'"
      :active="mapMode === '3d'"
      :highlights="filterHighlights"
      :pinIcon="activePinIcon"
      :bibliobusRoutes="filterResults.bibliobusRoutes"
      :selectedId="townSidebar.isOpen ? townSidebar.townName.id : null"
      @townSelected="handleMunicipioSelected"
    />
    <MapControls @zoomIn="mapZoom('zoomIn')" @zoomOut="mapZoom('zoomOut')" @reset="mapZoom('resetView')" />

    <!-- Tooltip -->
    <Tooltip 
      :visible="tooltip.visible"
      :content="tooltip.content"
      :x="tooltip.x"
      :y="tooltip.y"
      :card="tooltip.card"
      :cardX="tooltip.cardX"
      :cardY="tooltip.cardY"
      @close="closeInfoCard"
    />

    <!-- Contenedor para los globos de texto -->
    <div id="balloons-container"></div>

    <!-- Menú lateral de información -->
    <TownSidebar 
      :isOpen="townSidebar.isOpen"
      :townName="townSidebar.townName"
      :townInfo="townStore.townInfo"
      :events="townStore.townEvents"
      :pointsOfInterest="townStore.townPointsOfInterest"
      @close="handleCloseTownSidebar"
      @openEventDialog="handleOpenEventDialog"
      @addPoiToRoute="handleAddPoiToRoute"
    />

    <!-- Dialog de eventos -->
    <EventsDialog 
      :isOpen="eventsDialog.isOpen"
      :content="eventsDialog.content"
      @close="handleCloseEventsDialog"
      @calendar-added="handleCalendarAdded"
      @calendar-error="handleCalendarError"
      @add-to-agenda="handleAddToAgenda"
    />

    <!-- Notificación -->
    <NotificationToast
      :visible="notification.visible"
      :type="notification.type"
      :title="notification.title"
      :message="notification.message"
      @close="handleCloseNotification"
    />

    <!-- Línea de tiempo de historia -->
    <HistoryTimeline
      :isVisible="showHistoryTimeline"
      :events="historyTimelineEvents"
      @close="closeHistoryTimeline"
    />

    <!-- Componente SaLMMantino: oculto hasta tener el asesor nuevo (VITE_CHAT_ENABLED=true) -->
    <SaLMMantino 
      v-if="chatEnabled"
      :isTownSidebarOpen="townSidebar.isOpen" 
      @changeFilters="handleSaLLMantinoFilters"
    />
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed, watch, defineAsyncComponent } from 'vue'
import { apiService } from './services/apiService'
import { useTownStore } from './store/townStore'
import { useTheme } from './composables/useTheme'
import { useIsMobile } from './composables/useIsMobile'
import InteractiveMap from './components/InteractiveMap.vue'
import TownSidebar from './components/TownSidebar.vue'
import FilterSidebar from './components/FilterSidebar.vue'
import SearchBar from './components/SearchBar.vue'
import Tooltip from './components/Tooltip.vue'
import EventsDialog from './components/EventsDialog.vue'
import HistoryTimeline from './components/HistoryTimeline.vue'
import SaLMMantino from './components/SaLMMantino.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import NotificationToast from './components/NotificationToast.vue'
import MapViewSwitch from './components/MapViewSwitch.vue'
import { preloadEmblems } from './services/emblems'
import { mergeBibliobusRoutes, ROUTE_COLORS } from './utils/bibliobusRoutes'
import { daysUntilFestival } from './utils/festivals'
import CategoryBar from './components/CategoryBar.vue'
import MapControls from './components/MapControls.vue'
// El 3D (three.js) solo se descarga cuando se pide
const RelieveMap = defineAsyncComponent(() => import('./components/RelieveMap.vue'))

export default {
  name: 'App',
  components: {
    InteractiveMap,
    TownSidebar,
    FilterSidebar,
    SearchBar,
    Tooltip,
    EventsDialog,
    HistoryTimeline,
    SaLMMantino,
    ThemeToggle,
    NotificationToast,
    MapViewSwitch,
    RelieveMap,
    CategoryBar,
    MapControls
  },
  setup() {
    const chatEnabled = import.meta.env.VITE_CHAT_ENABLED === 'true'

    // Vista del mapa 2D/3D, recordada en el navegador
    const MAP_MODE_KEY = 'infosalamanca.mapMode'
    const mapMode = ref('2d')
    const relieveMounted = ref(false)
    const why3dUnavailable = () => {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        return 'Tu dispositivo pide reducir el movimiento, así que mostramos el mapa 2D.'
      }
      try {
        const c = document.createElement('canvas')
        if (!(c.getContext('webgl2') || c.getContext('webgl'))) throw new Error('sin WebGL')
      } catch (_) {
        return 'Tu navegador no puede mostrar el mapa 3D (WebGL no disponible). Seguimos en 2D.'
      }
      return ''
    }
    console.log('🚀 App.vue setup is running!')
    const townStore = useTownStore()
    
    // Inicializar el sistema de temas
    useTheme()
    
    // Detectar si es móvil
    const { isMobile } = useIsMobile()
    
    // Estado del tooltip
    // Etiqueta del hover (content) y tarjeta de información (card) que se queda abierta hasta cerrarla
    const tooltip = reactive({
      visible: false,
      content: '',
      x: 0,
      y: 0,
      card: null,
      cardX: 0,
      cardY: 0
    })

    // Estado de configuración
    const showTooltips = ref(true)
    const filterSidebarRef = ref(null)
    const interactiveMapRef = ref(null)

    // Estado del sidebar de información
    const townSidebar = reactive({
      isOpen: false,
      townName: { id: '', name: '' },
    })

    // Estado del dialog de eventos
    const eventsDialog = reactive({
      isOpen: false,
      content: {}
    })

    // Estado de notificaciones
    const notification = reactive({
      visible: false,
      type: 'success',
      title: '',
      message: ''
    })

    // Lista de rutas
    const routeList = ref([])

    // Filtros de eventos
    const eventFilters = reactive({
      'Tierra de Sabor': false,
      'Teatro': false,
      'Pantallas': false,
      'Exposición': false,
      'Fiestas Patronales': false,
      'Carnet Joven': false,
      'Bibliotecas y Bibliobuses': false,
      'Incendios': false,
      'Cotos': false,
      'Tratamiento de Residuos': false
    })

    // Estado para categoría activa y filtros visibles
    const activeCategory = ref(null)
    const categoryFilters = {
      cultura: ['Teatro', 'Exposición', 'Fiestas Patronales', 'Carnet Joven', 'Bibliotecas y Bibliobuses'],
      turismo: ['Tierra de Sabor', 'Pantallas'],
      ambiente: ['Incendios', 'Cotos', 'Tratamiento de Residuos'],
      historia: [],
      sociedad: []
    }

    // Estado para la línea de tiempo de historia
    const showHistoryTimeline = ref(false)
    const historyTimelineEvents = ref([])

    // Filtros visibles dinámicamente según la categoría activa
    const visibleFilters = computed(() => {
      if (!activeCategory.value || !categoryFilters[activeCategory.value]) {
        return {}
      }
      
      const filters = {}
      categoryFilters[activeCategory.value].forEach(filterName => {
        filters[filterName] = eventFilters[filterName]
      })
      
      return filters
    })

    // Estado reactivo para el filtro Tierra de Sabor
    const tierraSaborActivo = ref(false)

    // Estado para el sidebar de filtros
    const activeFilter = ref(null)
    const filterLoading = ref(false)
    const filterResults = reactive({
      tierraSabor: [],
      teatro: [],
      pantallas: [],
      exposicion: [],
      fiestasPatronales: [],
      bibliobusGroups: [],
      bibliobusRoutes: []
    })
    const libraryMunicipiosPhysical = ref([])
    const libraryMunicipiosMobile = ref([])

    // ---------- Municipios que colorea el filtro activo (los usan el mapa 2D y el 3D) ----------
    const FILTER_COLORS = {
      teatro: '#9c27b0',
      tierraSabor: '#f2c200',
      fiestas: '#ff7043',
      biblioteca: '#1e88e5'
    }
    const filterHighlights = ref({}) // { '37274': '#9c27b0', ... }
    // Icono de los pines del mapa 3D (uno por pueblo coloreado), según el filtro activo
    const activePinIcon = computed(() => {
      if (eventFilters['Teatro']) return '/assets/icons/teatro.png'
      if (eventFilters['Fiestas Patronales']) return '/assets/icons/fiesta.png'
      if (eventFilters['Bibliotecas y Bibliobuses']) return '/assets/icons/libro.png'
      if (tierraSaborActivo.value || eventFilters['Tierra de Sabor']) return '/assets/icons/tierra-sabor.svg'
      return null
    })
    const highlightLegend = ref([]) // [{ color, label }] para la leyenda bajo las chips
    const cpToIneCache = new Map()
    const cpToIne = (cp) => {
      if (!cpToIneCache.has(cp)) {
        cpToIneCache.set(cp, apiService.getCodigoINEFromCodigoPostal(cp).then(ine => (ine ? String(ine) : null)).catch(() => null))
      }
      return cpToIneCache.get(cp)
    }
    // Funciones de teatro de hoy en adelante (la API devuelve también las pasadas)
    const isUpcoming = (ev) => {
      const m = String(ev.fecha_fin || ev.fecha_inicio || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (!m) return true
      const now = new Date()
      return new Date(+m[1], +m[2] - 1, +m[3]) >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
    }
    const upcomingTeatro = computed(() => filterResults.teatro.filter(isUpcoming))
    const inesFromCps = async (cps) => (await Promise.all([...new Set(cps.filter(Boolean))].map(cpToIne))).filter(Boolean)
    let highlightsToken = 0
    const recomputeHighlights = async () => {
      const token = ++highlightsToken
      const out = {}
      const legend = []
      if (eventFilters['Teatro']) {
        for (const ine of await inesFromCps(upcomingTeatro.value.map(e => e.cp))) out[ine] = FILTER_COLORS.teatro
        legend.push({ color: FILTER_COLORS.teatro, label: 'Con teatro programado' })
      }
      if (tierraSaborActivo.value) {
        for (const ine of await inesFromCps(filterResults.tierraSabor.map(t => t.c_p))) out[ine] = FILTER_COLORS.tierraSabor
        legend.push({ color: FILTER_COLORS.tierraSabor, label: 'Con productores Tierra de Sabor' })
      }
      if (eventFilters['Fiestas Patronales']) {
        // Solo las fiestas cercanas: colorear las 357 no diría nada
        for (const f of filterResults.fiestasPatronales) {
          if (f.cod_ine && f.daysUntil != null && f.daysUntil >= 0 && f.daysUntil <= 30) out[String(f.cod_ine)] = FILTER_COLORS.fiestas
        }
        legend.push({ color: FILTER_COLORS.fiestas, label: 'Fiestas en los próximos 30 días' })
      }
      if (eventFilters['Bibliotecas y Bibliobuses']) {
        // Las paradas del bibliobús se ven como puntos del color de su ruta (InteractiveMap)
        for (const ine of libraryMunicipiosPhysical.value) out[String(ine)] = FILTER_COLORS.biblioteca
        legend.push(
          { color: FILTER_COLORS.biblioteca, label: 'Biblioteca' },
          { color: `conic-gradient(${ROUTE_COLORS.slice(0, 6).join(', ')})`, label: 'Rutas del bibliobús (un color por ruta)' }
        )
      }
      if (token !== highlightsToken) return // llegó otra petición más nueva
      filterHighlights.value = out
      highlightLegend.value = legend
    }
    const libraryDetailsByMunicipio = ref({})

    const handleFilterClick = async (filterName) => {
      // Función auxiliar para desactivar todos los filtros
      // Solo un filtro activo a la vez: apagar todos (también fiestas y bibliotecas, con sus marcadores)
      const clearAllFilters = () => {
        tooltip.card = null
        tierraSaborActivo.value = false
        for (const name of Object.keys(eventFilters)) eventFilters[name] = false
        libraryMunicipiosPhysical.value = []
        libraryMunicipiosMobile.value = []
        // También las líneas de rutas y las paradas del bibliobús, que se dibujan en el mapa
        filterResults.bibliobusRoutes = []
        filterResults.bibliobusGroups = []
      }

      if (filterName === 'Tierra de Sabor') {
        const wasActive = tierraSaborActivo.value
        clearAllFilters()
        
        if (!wasActive) {
          tierraSaborActivo.value = true
          eventFilters['Tierra de Sabor'] = true
          activeFilter.value = 'tierraSabor'
          await loadTierraSaborData()
        } else {
          activeFilter.value = null
        }
      } else if (filterName === 'Teatro') {
        const wasActive = eventFilters['Teatro']
        clearAllFilters()
        
        if (!wasActive) {
          eventFilters['Teatro'] = true
          activeFilter.value = 'teatro'
          await loadTeatroData()
        } else {
          activeFilter.value = null
        }
      } else if (filterName === 'Pantallas') {
        const wasActive = eventFilters['Pantallas']
        clearAllFilters()
        
        if (!wasActive) {
          eventFilters['Pantallas'] = true
          activeFilter.value = 'pantallas'
          await loadPantallasData()
        } else {
          activeFilter.value = null
        }
      } else if (filterName === 'Exposición') {
        const wasActive = eventFilters['Exposición']
        clearAllFilters()
        
        if (!wasActive) {
          eventFilters['Exposición'] = true
          activeFilter.value = 'exposicion'
          await loadExposicionData()
        } else {
          activeFilter.value = null
        }
      } else if (filterName === 'Fiestas Patronales') {
        const wasActive = eventFilters['Fiestas Patronales']
        clearAllFilters()
        
        if (!wasActive) {
          eventFilters['Fiestas Patronales'] = true
          activeFilter.value = 'fiestasPatronales'
          await loadFiestasPatronalesData()
        } else {
          activeFilter.value = null
        }
      } else if (filterName === 'Bibliotecas y Bibliobuses') {
        const wasActive = eventFilters['Bibliotecas y Bibliobuses']
        clearAllFilters()

        if (!wasActive) {
          eventFilters['Bibliotecas y Bibliobuses'] = true
          activeFilter.value = 'bibliotecas'
          await loadLibrariesData()
        } else {
          activeFilter.value = null
          libraryMunicipiosPhysical.value = []
          libraryMunicipiosMobile.value = []
        }
      }
    }

    // Funciones para cargar datos de filtros
    const loadTierraSaborData = async () => {
      filterLoading.value = true
      try {
        const data = await apiService.getTierraSaborIds()
        filterResults.tierraSabor = data
      } catch (error) {
        console.error('Error loading Tierra de Sabor data:', error)
        filterResults.tierraSabor = []
      } finally {
        filterLoading.value = false
      }
    }

    const loadTeatroData = async () => {
      filterLoading.value = true
      try {
        console.log('🎭 Cargando datos de teatro...')
        const response = await apiService.getTeatroEvents()
        filterResults.teatro = response.data || response || []
        console.log(`✅ ${filterResults.teatro.length} eventos de teatro cargados`)
      } catch (error) {
        console.error('Error loading Teatro data:', error)
        filterResults.teatro = []
      } finally {
        filterLoading.value = false
      }
    }

    const loadPantallasData = async () => {
      filterLoading.value = true
      try {
        // TODO: Implementar API para pantallas
        filterResults.pantallas = []
      } catch (error) {
        console.error('Error loading Pantallas data:', error)
        filterResults.pantallas = []
      } finally {
        filterLoading.value = false
      }
    }

    const loadExposicionData = async () => {
      filterLoading.value = true
      try {
        // TODO: Implementar API para exposiciones
        filterResults.exposicion = []
      } catch (error) {
        console.error('Error loading Exposición data:', error)
        filterResults.exposicion = []
      } finally {
        filterLoading.value = false
      }
    }

    const loadFiestasPatronalesData = async () => {
      filterLoading.value = true
      try {
        console.log('🎉 Cargando datos de fiestas patronales...')
        const response = await apiService.getAllFestivalsWithMunicipalities()
        // daysUntil se calcula aquí con las dos fechas (el servidor solo miraba la primera)
        filterResults.fiestasPatronales = (response.data || []).map(f => ({ ...f, daysUntil: daysUntilFestival(f.celebration_dates) }))
        console.log(`✅ ${filterResults.fiestasPatronales.length} municipios con fiestas cargados`)
      } catch (error) {
        console.error('Error loading Fiestas Patronales data:', error)
        filterResults.fiestasPatronales = []
      } finally {
        filterLoading.value = false
      }
    }

    const loadLibrariesData = async () => {
      filterLoading.value = true
      try {
        console.log('📚 Cargando bibliotecas y bibliobuses...')
        const response = await apiService.getLibraries({ maxPages: 6 })
        const muniPhys = response.municipiosPhysical || []
        const muniMob = response.municipiosMobile || []
        libraryMunicipiosPhysical.value = muniPhys.map(m => m.cod_ine).filter(Boolean)
        libraryMunicipiosMobile.value = muniMob.map(m => m.cod_ine).filter(Boolean)
        // Build details map cod_ine -> items
        const details = {}
        const items = response.data || []
        items.forEach(it => {
          if (!it.cod_ine) return
          if (!details[it.cod_ine]) details[it.cod_ine] = []
          details[it.cod_ine].push(it)
        })
        libraryDetailsByMunicipio.value = details
        console.log(`✅ Marcadores: físicos=${libraryMunicipiosPhysical.value.length}, móviles=${libraryMunicipiosMobile.value.length}`)

        // Cargar puntos de bibliobuses y agrupar para el lateral
        const rutasResp = await apiService.getBibliobusPoints({ maxPages: 8 })
        filterResults.bibliobusGroups = rutasResp.groupedByMunicipio || []
        filterResults.bibliobusRoutes = rutasResp.groupedByRuta || []
      } catch (error) {
        console.error('Error loading Libraries data:', error)
        libraryMunicipiosPhysical.value = []
        libraryMunicipiosMobile.value = []
        libraryDetailsByMunicipio.value = {}
        filterResults.bibliobusGroups = []
        filterResults.bibliobusRoutes = []
      } finally {
        filterLoading.value = false
      }
    }

    const handleClearFilter = () => {
      activeFilter.value = null
      tierraSaborActivo.value = false
      for (const name of Object.keys(eventFilters)) eventFilters[name] = false
      libraryMunicipiosPhysical.value = []
      libraryMunicipiosMobile.value = []
      libraryDetailsByMunicipio.value = {}
      // Las rutas y paradas del bibliobús también se dibujan en el mapa
      filterResults.bibliobusRoutes = []
      filterResults.bibliobusGroups = []
      tooltip.card = null
    }

    const handleFilterItemSelected = (item) => {
      console.log('Filter item selected:', item)
      
      // Determinar el tipo de filtro activo para mapear los campos correctamente
      if (activeFilter.value === 'teatro') {
        // Mapear datos de teatro al formato del EventsDialog
        eventsDialog.isOpen = true
        eventsDialog.content = {
          title: item.titulo || 'Evento de Teatro',
          date: item.fecha_inicio,
          time: null, // Los eventos de teatro no suelen tener hora específica
          location: item.lugar || item.direccion,
          category: item.categoria || 'Teatro',
          description: item.descripcion,
          price: item.precio,
          contact: item.telefono || item.email,
          organizer: item.organizador,
          municipality: item.municipio || item.poblacion
        }
      } else if (activeFilter.value === 'tierraSabor') {
        // Para Tierra de Sabor ya existe lógica específica en FilterResults
        console.log('Tierra de Sabor item selected - handled by FilterResults component')
      } else {
        // Para otros filtros futuros (pantallas, exposición)
        eventsDialog.isOpen = true
        eventsDialog.content = {
          title: item.titulo || item.nombre || 'Evento',
          date: item.fecha || item.fecha_inicio,
          location: item.lugar || item.direccion,
          category: item.categoria,
          description: item.descripcion,
          price: item.precio
        }
      }
    }
    const handleShowTooltip = (data) => {
      if (data.card) {
        tooltip.card = data.card
        tooltip.cardX = data.x
        tooltip.cardY = data.y
        tooltip.visible = false
        return
      }
      // Con una tarjeta abierta no se muestra la etiqueta del hover
      if (tooltip.card) return
      tooltip.visible = true
      tooltip.content = data.content
      tooltip.x = data.x
      tooltip.y = data.y
    }

    // hideTooltip normal: la etiqueta del hover. Con { card: true }: también la tarjeta
    const handleHideTooltip = (detail) => {
      tooltip.visible = false
      if (detail?.card) tooltip.card = null
    }
    const closeInfoCard = () => { tooltip.card = null }

    // Handlers principales
    const handleTownSelected = async (townData) => {
      console.log('Town selected:', townData)
      
      // Abrir sidebar tanto en móvil como en desktop
      townSidebar.isOpen = true
      
      townSidebar.townName = {id: townData.id, name: townData.name}
      preloadEmblems(townData.id) // en paralelo con las llamadas a la API
      
      // Cargar información del municipio usando apiService
      try {
        townStore.setLoading(true)
        
        // Info, eventos y POIs en paralelo (una sola llamada de cada)
        const [townInfo, events, pois] = await Promise.all([
          apiService.getTownInfo(townData.id),
          apiService.getTownEvents(townData.id),
          apiService.getTownPointsOfInterest(townData.id)
        ])
        if (townInfo) townStore.setTownInfo(townInfo)
        if (events) townStore.setTownEvents(events)
        if (pois) townStore.setTownPointsOfInterest(pois)
        
        // Establecer el municipio seleccionado en el store
        townStore.setSelectedTown(townData)
        
      } catch (error) {
        console.error('Error loading town data:', error)
      } finally {
        townStore.setLoading(false)
      }
      
      // Ya no añadimos automáticamente a la ruta - solo se añaden POIs manualmente
    }

    // Manejar selección de municipio desde SearchBar
    const handleMunicipioSelected = (municipio) => {
      console.log('Municipio seleccionado desde búsqueda:', municipio)
      
      // Crear objeto townData compatible con handleTownSelected
      const townData = {
        id: municipio.id,
        name: municipio.name
      }
      
      // Reutilizar la lógica existente de handleTownSelected
      handleTownSelected(townData)
      
      // Además, intentar resaltar el municipio en el mapa si es posible
      // Aquí podrías agregar lógica para hacer zoom o resaltar el área en el SVG
      const highlightEvent = new CustomEvent('highlightMunicipio', {
        detail: { municipioId: municipio.id }
      })
      window.dispatchEvent(highlightEvent)
    }

    const handleTownDeselected = () => {
      townSidebar.isOpen = false
      townStore.clearSelectedTown()
    }

    const handleCloseTownSidebar = () => {
      townSidebar.isOpen = false
      townStore.clearSelectedTown()
      interactiveMapRef.value?.deselectTown() // quitar también el color de selección del mapa 2D
    }

    const handleOpenEventDialog = (event) => {
      eventsDialog.isOpen = true
      eventsDialog.content = {
        title: event.titulo || event.title || 'Evento',
        date: event.fecha_inicio || event.date || '',
        time: event.hora || event.time || '',
        location: event.ubicacion || event.location || '',
        description: event.descripcion || event.description || '',
        price: event.precio || event.price || '',
        contact: event.contacto || event.contact || '',
        category: event.categoria || event.category || ''
      }
    }

    const handleCloseEventsDialog = () => {
      eventsDialog.isOpen = false
      eventsDialog.content = {}
    }

    const handleCalendarAdded = (data) => {
      notification.visible = true
      notification.type = 'success'
      notification.title = 'Evento añadido al calendario'
      notification.message = `"${data.eventTitle}" se ha guardado en tu agenda`
    }

    const handleCalendarError = (data) => {
      notification.visible = true
      notification.type = 'error'
      notification.title = 'Error al añadir evento'
      notification.message = data.message || 'No se pudo generar el archivo de calendario'
    }

    const handleCloseNotification = () => {
      notification.visible = false
      notification.title = ''
      notification.message = ''
    }

    // Funciones para la agenda
    const handleAddToAgenda = (eventData) => {
      if (filterSidebarRef.value) {
        const addedEvent = filterSidebarRef.value.addEventToAgenda(eventData)
        if (addedEvent) {
          console.log('Evento añadido a la agenda:', addedEvent)
        }
      }
    }

    const handleAgendaEventSelected = (event) => {
      // Abrir el diálogo de eventos con los datos del evento de la agenda
      eventsDialog.isOpen = true
      eventsDialog.content = event
    }

    const handleAgendaEventExported = (event) => {
      // Generar y descargar ICS para el evento específico
      try {
        const generateICS = (eventData) => {
          const formatICSDate = (date, time = null) => {
            const d = new Date(date)
            if (time) {
              const [hours, minutes] = time.split(':')
              d.setHours(parseInt(hours), parseInt(minutes))
            }
            return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
          }

          const escapeICSText = (text) => {
            if (!text) return ''
            return text.toString()
              .replace(/\\/g, '\\\\')
              .replace(/;/g, '\\;')
              .replace(/,/g, '\\,')
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '')
          }

          const startDate = formatICSDate(eventData.date, eventData.time)
          const endDate = formatICSDate(eventData.date, eventData.time ? 
            (parseInt(eventData.time.split(':')[0]) + 1) + ':' + eventData.time.split(':')[1] : 
            null)

          const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//InfoSalamanca//EventCalendar//ES',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `UID:${Date.now()}@infosalamanca.es`,
            `DTSTART:${startDate}`,
            `DTEND:${endDate}`,
            `SUMMARY:${escapeICSText(eventData.title)}`,
            `DESCRIPTION:${escapeICSText(eventData.description?.replace(/<[^>]*>/g, '') || '')}`,
            `LOCATION:${escapeICSText(eventData.location || '')}`,
            `ORGANIZER:${escapeICSText(eventData.organizer || '')}`,
            'STATUS:CONFIRMED',
            'TRANSP:OPAQUE',
            'END:VEVENT',
            'END:VCALENDAR'
          ].join('\r\n')

          return icsContent
        }

        const icsContent = generateICS(event)
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        
        const link = document.createElement('a')
        link.href = url
        link.download = `evento-${event.title?.replace(/[^a-zA-Z0-9]/g, '-') || 'evento'}.ics`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        URL.revokeObjectURL(url)
        
        // Mostrar notificación de éxito
        notification.visible = true
        notification.type = 'success'
        notification.title = 'Evento exportado'
        notification.message = `"${event.title}" se ha descargado como archivo ICS`
      } catch (error) {
        console.error('Error exportando evento:', error)
        notification.visible = true
        notification.type = 'error'
        notification.title = 'Error al exportar'
        notification.message = 'No se pudo exportar el evento'
      }
    }

    const handleGenerateRoute = () => {
      if (routeList.value.length >= 2) {
        const waypoints = routeList.value.map(item => {
          // Para POIs con coordenadas, usar las coordenadas exactas
          if (item.type === 'poi' && item.latitud && item.longitud) {
            return `${item.latitud},${item.longitud}`
          }
          // Para municipios o POIs sin coordenadas, usar el nombre y localización
          const location = item.poblacion ? `${item.name}, ${item.poblacion}, Salamanca, España` : `${item.name}, Salamanca, España`
          return encodeURIComponent(location)
        }).join('/')
        
        const googleMapsUrl = `https://www.google.com/maps/dir/${waypoints}`
        window.open(googleMapsUrl, '_blank')
      }
    }

    const handleRemoveFromRoute = (index) => {
      routeList.value.splice(index, 1)
    }

    const handleAddPoiToRoute = (poiData) => {
      // Verificar si ya está en la ruta
      const existsInRoute = routeList.value.some(item => 
        item.id === poiData.id || item.name === poiData.nombre
      )
      
      if (!existsInRoute) {
        routeList.value.push({
          id: poiData.id || `poi_${Date.now()}`,
          name: poiData.nombre,
          type: 'poi',
          tipomonumento: poiData.tipomonumento,
          poblacion: poiData.poblacion,
          latitud: poiData.latitud,
          longitud: poiData.longitud
        })
        
        // Mostrar notificación de éxito
        notification.visible = true
        notification.type = 'success'
        notification.title = 'POI añadido a la ruta'
        notification.message = `"${poiData.nombre}" se ha añadido a tu ruta de visita`
        return true // Éxito
      } else {
        // Mostrar notificación de advertencia
        notification.visible = true
        notification.type = 'warning'
        notification.title = 'POI ya en la ruta'
        notification.message = `"${poiData.nombre}" ya está en tu ruta de visita`
        return false // Ya existe
      }
    }

    const handleFilterChange = (filterName, isActive) => {
      eventFilters[filterName] = isActive
      console.log(`Filter ${filterName} set to ${isActive}`)
    }

    const handleSaLLMantinoFilters = (data) => {
      // data ahora es { category, filters }
      const { category, filters: filtersToActivate } = data
      
      // Si no hay categoría (deselección), limpiar todo
      if (!category) {
        activeCategory.value = null
        showHistoryTimeline.value = false
        handleClearFilter()
        return
      }

      // Al cambiar de categoría se quita el filtro anterior entero (colores, iconos, rutas y lista)
      if (activeCategory.value !== category) {
        showHistoryTimeline.value = false
        handleClearFilter()
      }
      
      // Actualizar categoría activa
      activeCategory.value = category
      
      // Si es la categoría historia, mostrar la línea de tiempo
      if (category === 'historia') {
        showHistoryTimeline.value = true
        loadHistoryTimeline()
      }
      
      // No activar automáticamente los filtros, solo mostrarlos
      // Los usuarios deben clickar para activarlos individualmente
    }

    // Función para cargar eventos de la línea de tiempo
    const loadHistoryTimeline = async () => {
      try {
        // TODO: Implementar carga de eventos históricos desde el backend
        // Por ahora, eventos de ejemplo
        historyTimelineEvents.value = [
          {
            id: 1,
            year: 1218,
            title: 'Fundación de la Universidad',
            description: 'Alfonso IX funda la Universidad de Salamanca, una de las más antiguas de Europa.',
            image: null
          },
          {
            id: 2,
            year: 1492,
            title: 'Gramática Castellana',
            description: 'Antonio de Nebrija publica la primera gramática castellana.',
            image: null
          },
          {
            id: 3,
            year: 1520,
            title: 'Guerra de las Comunidades',
            description: 'Salamanca participa activamente en la revuelta comunera.',
            image: null
          },
          {
            id: 4,
            year: 1812,
            title: 'Batalla de los Arapiles',
            description: 'Victoria crucial de Wellington contra las tropas napoleónicas.',
            image: null
          },
          {
            id: 5,
            year: 1988,
            title: 'Patrimonio de la Humanidad',
            description: 'La UNESCO declara el casco antiguo de Salamanca Patrimonio de la Humanidad.',
            image: null
          }
        ]
      } catch (error) {
        console.error('Error loading history timeline:', error)
      }
    }

    const closeHistoryTimeline = () => {
      showHistoryTimeline.value = false
      activeCategory.value = null
    }

    // Funciones de configuración
    const handleToggleTooltips = (value) => {
      if (typeof value === 'boolean') {
        showTooltips.value = value
      } else {
        showTooltips.value = !showTooltips.value
      }
      console.log('Tooltips toggled in App.vue:', showTooltips.value)
    }

    const handleToggleAutoExpand = (value) => {
      console.log('Auto expand toggled in App.vue:', value)
      // TODO: Implementar funcionalidad de auto expand
    }

    // Recalcular los municipios coloreados cuando cambia un filtro o llegan sus datos
    watch(
      [
        () => filterResults.teatro, () => filterResults.tierraSabor, () => filterResults.fiestasPatronales,
        tierraSaborActivo, () => eventFilters['Teatro'], () => eventFilters['Fiestas Patronales'],
        () => eventFilters['Bibliotecas y Bibliobuses'],
        libraryMunicipiosPhysical, libraryMunicipiosMobile
      ],
      recomputeHighlights
    )

    // Panel izquierdo (filtros, rutas, agenda...): se abre con ☰ o al activar un filtro
    const leftPanelOpen = computed(() => !!filterSidebarRef.value?.isExpanded)
    const toggleLeftPanel = () => filterSidebarRef.value?.toggleSidebar()
    const openLeftPanel = () => { if (!leftPanelOpen.value) toggleLeftPanel() }

    // Nº de resultados del filtro activo, para "Ver lista (N)"
    const activeResultCount = computed(() => {
      switch (activeFilter.value) {
        case 'teatro': return upcomingTeatro.value.length
        case 'tierraSabor': return filterResults.tierraSabor.length
        case 'fiestasPatronales': return filterResults.fiestasPatronales.length
        case 'bibliotecas': return mergeBibliobusRoutes(filterResults.bibliobusRoutes).length
        default: return 0
      }
    })

    // Botones [+] [−] [⟲]: actúan sobre el mapa que se ve
    const relieveMapRef = ref(null)
    const mapZoom = (action) => {
      const map = mapMode.value === '3d' ? relieveMapRef.value : interactiveMapRef.value
      map?.[action]?.()
    }

    // Cambiar entre 2D y 3D (sin 3D si no hay WebGL o se pide reducir movimiento)
    const setMapMode = (mode, { remember = true } = {}) => {
      if (mode === '3d') {
        const why = why3dUnavailable()
        if (why) {
          notification.type = 'warning'
          notification.title = 'Mapa 3D no disponible'
          notification.message = why
          notification.visible = true
          mode = '2d'
        } else {
          relieveMounted.value = true
          handleHideTooltip()
        }
      }
      mapMode.value = mode
      if (remember) {
        try { localStorage.setItem(MAP_MODE_KEY, mode) } catch (_) { /* navegación privada */ }
      }
    }
    onMounted(() => {
      let saved = null
      try { saved = localStorage.getItem(MAP_MODE_KEY) } catch (_) { /* sin almacenamiento */ }
      if (saved === '3d') setMapMode('3d', { remember: false })
    })

    // Configurar listeners globales para tooltip
    onMounted(() => {
      window.addEventListener('showTooltip', (event) => {
        handleShowTooltip(event.detail)
      })
      
      window.addEventListener('hideTooltip', (event) => {
        handleHideTooltip(event.detail)
      })
      window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeInfoCard()
      })
      // Ruta del bibliobús pulsada en el mapa: se muestra en la lista del panel izquierdo
      window.addEventListener('selectRoute', () => openLeftPanel())
    })

    return {
      chatEnabled,
      mapMode,
      relieveMounted,
      setMapMode,
      leftPanelOpen,
      toggleLeftPanel,
      openLeftPanel,
      activeResultCount,
      filterHighlights,
      activePinIcon,
      highlightLegend,
      relieveMapRef,
      mapZoom,
      townStore,
      tooltip,
      townSidebar,
      eventsDialog,
      notification,
      routeList,
      eventFilters,
      visibleFilters,
      activeCategory,
      tierraSaborActivo,
      activeFilter,
      filterLoading,
      filterResults,
      filterSidebarRef,
      interactiveMapRef,
      libraryMunicipiosPhysical,
      libraryMunicipiosMobile,
      libraryDetailsByMunicipio,
      showHistoryTimeline,
      historyTimelineEvents,
      handleTownSelected,
      handleTownDeselected,
      handleCloseTownSidebar,
      handleOpenEventDialog,
      handleCloseEventsDialog,
      handleCalendarAdded,
      handleCalendarError,
      handleCloseNotification,
      handleAddToAgenda,
      handleAgendaEventSelected,
      handleAgendaEventExported,
      handleGenerateRoute,
      handleRemoveFromRoute,
      handleAddPoiToRoute,
      handleFilterChange,
      handleSaLLMantinoFilters,
      handleShowTooltip,
      handleHideTooltip,
      closeInfoCard,
      handleFilterClick,
      handleClearFilter,
      handleFilterItemSelected,
      handleMunicipioSelected,
      handleToggleTooltips,
      handleToggleAutoExpand,
      showTooltips,
      closeHistoryTimeline
    }
  }
}
</script>

<style>
/* Importar estilos globales */
@import './styles/global.css';

/* Posicionamiento del toggle de tema */
:deep(.theme-toggle) {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
}

 #app {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
}
</style>