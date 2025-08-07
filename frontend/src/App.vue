<template>
  <div id="app">

    <!-- Toggle de tema -->
    <ThemeToggle />

    <!-- Sidebar de filtros -->
    <FilterSidebar 
      :activeFilter="activeFilter"
      :tierraSaborResults="filterResults.tierraSabor"
      :teatroResults="filterResults.teatro"
      :pantallasResults="filterResults.pantallas"
      :exposicionResults="filterResults.exposicion"
      :isLoading="filterLoading"
      :routeList="routeList"
      @clearFilter="handleClearFilter"
      @itemSelected="handleFilterItemSelected"
      @generateRoute="handleGenerateRoute"
      @removeFromRoute="handleRemoveFromRoute"
    />
    
    <!-- Contenedor del mapa -->
    <InteractiveMap 
      :tierraSaborActivo="tierraSaborActivo"
      @townSelected="handleTownSelected"
      @townDeselected="handleTownDeselected"
    />

    <!-- Tooltip -->
    <Tooltip 
      :visible="tooltip.visible"
      :content="tooltip.content"
      :x="tooltip.x"
      :y="tooltip.y"
      @show="handleShowTooltip"
      @hide="handleHideTooltip"
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
    />

    <!-- Leyenda de eventos -->
    <EventsLegend 
      :filters="eventFilters"
      @filterChange="handleFilterChange"
      @filterClick="handleFilterClick"
    />

    <!-- Componente SaLMMantino -->
    <SaLMMantino :isTownSidebarOpen="townSidebar.isOpen" />
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { apiService } from './services/apiService'
import { useTownStore } from './store/townStore'
import { useTheme } from './composables/useTheme'
import InteractiveMap from './components/InteractiveMap.vue'
import TownSidebar from './components/TownSidebar.vue'
import FilterSidebar from './components/FilterSidebar.vue'
import Tooltip from './components/Tooltip.vue'
import EventsDialog from './components/EventsDialog.vue'
import EventsLegend from './components/EventsLegend.vue'
import SaLMMantino from './components/SaLMMantino.vue'
import ThemeToggle from './components/ThemeToggle.vue'

export default {
  name: 'App',
  components: {
    InteractiveMap,
    TownSidebar,
    FilterSidebar,
    Tooltip,
    EventsDialog,
    EventsLegend,
    SaLMMantino,
    ThemeToggle
  },
  setup() {
    console.log('🚀 App.vue setup is running!')
    const townStore = useTownStore()
    
    // Inicializar el sistema de temas
    useTheme()
    
    // Estado del tooltip
    const tooltip = reactive({
      visible: false,
      content: '',
      x: 0,
      y: 0
    })
    console.log('🔍 Initial tooltip state:', tooltip)

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

    // Lista de rutas
    const routeList = ref([])

    // Filtros de eventos
    const eventFilters = reactive({
      'Tierra de Sabor': false,
      'Teatro': false,
      'Pantallas': false,
      'Exposición': false
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
      exposicion: []
    })

    const handleFilterClick = async (filterName) => {
      // Función auxiliar para desactivar todos los filtros
      const clearAllFilters = () => {
        tierraSaborActivo.value = false
        eventFilters['Tierra de Sabor'] = false
        eventFilters['Teatro'] = false
        eventFilters['Pantallas'] = false
        eventFilters['Exposición'] = false
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

    const handleClearFilter = () => {
      activeFilter.value = null
      tierraSaborActivo.value = false
      eventFilters['Tierra de Sabor'] = false
      eventFilters['Teatro'] = false
      eventFilters['Pantallas'] = false
      eventFilters['Exposición'] = false
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
          municipality: item.municipio
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
      console.log('🔴 App.vue - Show tooltip:', data) // Debug
      tooltip.visible = true
      tooltip.content = data.content
      tooltip.x = data.x
      tooltip.y = data.y
      console.log('🔴 App.vue - Tooltip state after update:', { 
        visible: tooltip.visible, 
        content: tooltip.content, 
        x: tooltip.x, 
        y: tooltip.y 
      })
    }

    const handleHideTooltip = () => {
      console.log('App.vue - Hide tooltip') // Debug
      tooltip.visible = false
    }

    // Handlers principales
    const handleTownSelected = async (townData) => {
      console.log('Town selected:', townData)
      townSidebar.isOpen = true
      townSidebar.townName = {id: townData.id, name: townData.name}
      
      // Cargar información del municipio usando apiService
      try {
        townStore.setLoading(true)
        
        // Obtener información básica del municipio
        const townInfo = await apiService.getTownInfo(townData.id)
        if (townInfo) {
          townStore.setTownInfo(townInfo)
        }
        
        // Obtener eventos del municipio
        const events = await apiService.getTownEvents(townData.id)
        if (events) {
          townStore.setTownEvents(events)
        }
        
        // Obtener puntos de interés del municipio
        const pois = await apiService.getTownPointsOfInterest(townData.id)
        if (pois) {
          townStore.setTownPointsOfInterest(pois)
        }
        
        // Establecer el municipio seleccionado en el store
        townStore.setSelectedTown(townData)
        
      } catch (error) {
        console.error('Error loading town data:', error)
      } finally {
        townStore.setLoading(false)
      }
      
      // Ya no añadimos automáticamente a la ruta - solo se añaden POIs manualmente
    }

    const handleTownDeselected = () => {
      townSidebar.isOpen = false
      townStore.clearSelectedTown()
    }

    const handleCloseTownSidebar = () => {
      townSidebar.isOpen = false
      townStore.clearSelectedTown()
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
        
        // Mostrar confirmación
        alert('¡Punto de interés añadido a tu ruta!')
        return true // Éxito
      } else {
        // Mostrar mensaje si ya existe
        alert('Este punto de interés ya está en tu ruta')
        return false // Ya existe
      }
    }

    const handleFilterChange = (filterName, isActive) => {
      eventFilters[filterName] = isActive
      // TODO: Implementar filtrado en el mapa
      console.log(`Filter ${filterName} set to ${isActive}`)
    }

    // Configurar listeners globales para tooltip
    onMounted(() => {
      window.addEventListener('showTooltip', (event) => {
        handleShowTooltip(event.detail)
      })
      
      window.addEventListener('hideTooltip', () => {
        handleHideTooltip()
      })
    })

    return {
      townStore,
      tooltip,
      townSidebar,
      eventsDialog,
      routeList,
      eventFilters,
      tierraSaborActivo,
      activeFilter,
      filterLoading,
      filterResults,
      handleTownSelected,
      handleTownDeselected,
      handleCloseTownSidebar,
      handleOpenEventDialog,
      handleCloseEventsDialog,
      handleGenerateRoute,
      handleRemoveFromRoute,
      handleAddPoiToRoute,
      handleFilterChange,
      handleShowTooltip,
      handleHideTooltip,
      handleFilterClick,
      handleClearFilter,
      handleFilterItemSelected
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