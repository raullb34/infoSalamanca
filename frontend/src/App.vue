<template>
  <div id="app">

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
    <SaLMMantino />
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { apiService } from './services/apiService'
import { useTownStore } from './store/townStore'
import InteractiveMap from './components/InteractiveMap.vue'
import TownSidebar from './components/TownSidebar.vue'
import FilterSidebar from './components/FilterSidebar.vue'
import Tooltip from './components/Tooltip.vue'
import EventsDialog from './components/EventsDialog.vue'
import EventsLegend from './components/EventsLegend.vue'
import SaLMMantino from './components/SaLMMantino.vue'

export default {
  name: 'App',
  components: {
    InteractiveMap,
    TownSidebar,
    FilterSidebar,
    Tooltip,
    EventsDialog,
    EventsLegend,
    SaLMMantino
  },
  setup() {
    const townStore = useTownStore()
    
    // Estado del tooltip
    const tooltip = reactive({
      visible: false,
      content: '',
      x: 0,
      y: 0
    })

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
      if (filterName === 'Tierra de Sabor') {
        tierraSaborActivo.value = !tierraSaborActivo.value
        eventFilters['Tierra de Sabor'] = tierraSaborActivo.value
        
        if (tierraSaborActivo.value) {
          activeFilter.value = 'tierraSabor'
          await loadTierraSaborData()
        } else {
          activeFilter.value = null
        }
      } else if (filterName === 'Teatro') {
        eventFilters['Teatro'] = !eventFilters['Teatro']
        if (eventFilters['Teatro']) {
          activeFilter.value = 'teatro'
          await loadTeatroData()
        } else if (activeFilter.value === 'teatro') {
          activeFilter.value = null
        }
      } else if (filterName === 'Pantallas') {
        eventFilters['Pantallas'] = !eventFilters['Pantallas']
        if (eventFilters['Pantallas']) {
          activeFilter.value = 'pantallas'
          await loadPantallasData()
        } else if (activeFilter.value === 'pantallas') {
          activeFilter.value = null
        }
      } else if (filterName === 'Exposición') {
        eventFilters['Exposición'] = !eventFilters['Exposición']
        if (eventFilters['Exposición']) {
          activeFilter.value = 'exposicion'
          await loadExposicionData()
        } else if (activeFilter.value === 'exposicion') {
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
        // TODO: Implementar API para teatro
        filterResults.teatro = []
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
      // TODO: Mostrar detalles del item o zoom en el mapa
    }
    const handleShowTooltip = (data) => {
      tooltip.visible = true
      tooltip.content = data.content
      tooltip.x = data.x
      tooltip.y = data.y
    }

    const handleHideTooltip = () => {
      tooltip.visible = false
    }

    // Handlers principales
    const handleTownSelected = (townData) => {
      console.log('Town selected:', townData)
      townSidebar.isOpen = true
      townSidebar.townName = {id: townData.id, name: townData.name}

      // Añadir a la ruta si no está ya
      const existsInRoute = routeList.value.some(item => item.id === townData.id)
      if (!existsInRoute) {
        routeList.value.push({
          id: townData.id,
          name: townData.name,
        })
      }
      // No se necesita lógica de repintado aquí, se delega a InteractiveMap
    }

    const handleTownDeselected = () => {
      townSidebar.isOpen = false
    }

    const handleCloseTownSidebar = () => {
      townSidebar.isOpen = false
    }

    const handleOpenEventDialog = (event) => {
      eventsDialog.isOpen = true
      eventsDialog.content = event
    }

    const handleCloseEventsDialog = () => {
      eventsDialog.isOpen = false
      eventsDialog.content = {}
    }

    const handleGenerateRoute = () => {
      if (routeList.value.length >= 2) {
        const waypoints = routeList.value.map(item => 
          encodeURIComponent(`${item.name}, Salamanca, España`)
        ).join('/')
        
        const googleMapsUrl = `https://www.google.com/maps/dir/${waypoints}`
        window.open(googleMapsUrl, '_blank')
      }
    }

    const handleRemoveFromRoute = (index) => {
      routeList.value.splice(index, 1)
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

 #app {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  height: 100vh;
}
</style>