<template>
  <div id="filter-sidebar" :class="{ expanded: isExpanded }">
    <tabs :options="{ useUrlFragment: false }" @clicked="tabClicked" @changed="tabChanged" nav-item-class="nav-item">
        <tab name="🔍 Filtros">
          <FilterResults
            :activeFilter="activeFilter"
            :tierraSaborResults="tierraSaborResults"
            :teatroResults="teatroResults"
            :pantallasResults="pantallasResults"
            :exposicionResults="exposicionResults"
            :isLoading="isLoading"
            @clearFilter="clearFilter"
            @itemSelected="showItemDetails"
          />
        </tab>
        
        <tab name="🗺️ Rutas">
          <RouteManager
            :routeList="routeList"
            @generateRoute="generateRoute"
            @removeFromRoute="removeFromRoute"
          />
        </tab>
        
        <tab name="ℹ️ Info">
          <AppInfo :routeCount="routeList.length" />
        </tab>
        
        <tab name="⚙️ Configuración">
          <AppSettings
            :darkMode="darkMode"
            :showTooltips="showTooltips"
            :autoExpandSidebar="autoExpandSidebar"
            @toggleDarkMode="toggleDarkMode"
            @toggleTooltips="toggleTooltips"
            @toggleAutoExpand="toggleAutoExpand"
          />
        </tab>
    </tabs>
  </div>
  
  <!-- Botón toggle para mostrar/ocultar sidebar -->
  <button 
    id="toggle-filter-sidebar-btn" 
    class="btn btn-success"
    :class="{ 'collapsed': !isExpanded }"
    @click="toggleSidebar"
    :style="{ left: isExpanded ? '360px' : '30px' }"
  >
    {{ isExpanded ? '⬅' : '➡' }}
  </button>
</template>

<script>
import { ref, watch } from 'vue'
import FilterResults from './tabs/FilterResults.vue'
import RouteManager from './tabs/RouteManager.vue'
import AppInfo from './tabs/AppInfo.vue'
import AppSettings from './tabs/AppSettings.vue'

export default {
  name: 'FilterSidebar',
  components: {
    FilterResults,
    RouteManager,
    AppInfo,
    AppSettings
  },
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
    isLoading: {
      type: Boolean,
      default: false
    },
    routeList: {
      type: Array,
      default: () => []
    }
  },
  emits: ['clearFilter', 'itemSelected', 'generateRoute', 'removeFromRoute'],
  setup(props, { emit }) {
    const isExpanded = ref(true)
    
    // Configuraciones
    const darkMode = ref(false)
    const showTooltips = ref(true)
    const autoExpandSidebar = ref(true)

    const toggleSidebar = () => {
      isExpanded.value = !isExpanded.value
    }

    const clearFilter = () => {
      emit('clearFilter')
    }

    const showItemDetails = (item) => {
      emit('itemSelected', item)
    }

    const generateRoute = () => {
      emit('generateRoute')
    }

    const removeFromRoute = (index) => {
      emit('removeFromRoute', index)
    }

    const toggleDarkMode = () => {
      darkMode.value = !darkMode.value
      document.documentElement.classList.toggle('dark', darkMode.value)
    }

    const toggleTooltips = () => {
      showTooltips.value = !showTooltips.value
      console.log('Tooltips toggled:', showTooltips.value)
    }

    const toggleAutoExpand = () => {
      autoExpandSidebar.value = !autoExpandSidebar.value
      console.log('Auto expand toggled:', autoExpandSidebar.value)
    }

    // Expandir automáticamente cuando hay un filtro activo
    watch(() => props.activeFilter, (newFilter) => {
      if (newFilter && !isExpanded.value && autoExpandSidebar.value) {
        isExpanded.value = true
      }
    })

    return {
      isExpanded,
      darkMode,
      showTooltips,
      autoExpandSidebar,
      toggleSidebar,
      clearFilter,
      showItemDetails,
      generateRoute,
      removeFromRoute,
      toggleDarkMode,
      toggleTooltips,
      toggleAutoExpand
    }
  }
}
</script>

<style scoped>
/* Estilos principales del sidebar */
#filter-sidebar {
  width: 370px;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  background-color: rgba(255, 255, 255, 0.95);
  box-shadow: 2px 0 5px rgba(0,0,0,0.5);
  padding: 20px;
  display: flex;
  flex-direction: column;
  z-index: 1000;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  border-right: 3px solid #4CAF50;
}

#filter-sidebar:not(.expanded) {
  transform: translateX(-290px);
  box-shadow: none;
}

#toggle-filter-sidebar-btn {
  position: fixed;
  top: 60%;
  transform: translateY(-50%);
  z-index: 1001;
  transition: left 0.3s cubic-bezier(.4,2,.6,1), box-shadow 0.3s;
  border-radius: 0 8px 8px 0;
  box-shadow: 2px 0 5px rgba(0,0,0,0.15);
}

#toggle-filter-sidebar-btn.collapsed {
  box-shadow: none;
  border-radius: 8px;
}

/* Personalizar las tabs - Estilo simple y elegante */
:deep(.tabs-component) {
  margin: 0;
  background: transparent;
}

:deep(.tabs-component-tabs) {
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  margin: 0;
  padding: 0;
  display: flex;
  border-radius: 8px 8px 0 0;
}

:deep(.tabs-component-tab) {
  background: transparent;
  border: 1px solid transparent;
  border-bottom: none;
  color: #6c757d;
  font-weight: 500;
  font-size: 14px;
  padding: 12px 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none !important;
  border-radius: 8px 8px 0 0;
  margin-right: 2px;
}

:deep(.tabs-component-tab:hover) {
  background: #e9ecef;
  color: #495057;
  text-decoration: none !important;
}

:deep(.tabs-component-tab.is-active) {
  background: white;
  color: #333;
  border: 1px solid #dee2e6;
  border-bottom: 1px solid white;
  font-weight: 600;
  position: relative;
  z-index: 1;
  text-decoration: none !important;
}

:deep(.tabs-component-panels) {
  background: white;
  border: 1px solid #dee2e6;
  border-top: none;
  border-radius: 0 0 8px 8px;
  min-height: 300px;
}

:deep(.tabs-component-panel) {
  padding: 20px;
}

/* Botones mejorados */
.btn-success {
  background: #28a745;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-success:hover {
  background: #218838;
}

.btn-success:disabled {
  background: #6c757d;
  opacity: 0.6;
}

/* Estilos globales limpios */
li {
  list-style: none !important;
  list-style-type: none !important;
  padding: 0;
  margin: 0;
}

li::before {
  content: none !important;
}

li::marker {
  content: none !important;
}

ul {
  list-style: none !important;
  list-style-type: none !important;
  padding-left: 0 !important;
  margin: 0;
}

a {
  text-decoration: none !important;
}

a:hover {
  text-decoration: none !important;
}

a:link, a:visited, a:active {
  text-decoration: none !important;
}

/* Eliminar cualquier subrayado de los tabs */
:deep(.tabs-component-tab a) {
  text-decoration: none !important;
}

:deep(.tabs-component-tab:link) {
  text-decoration: none !important;
}

:deep(.tabs-component-tab:visited) {
  text-decoration: none !important;
}

/* Forzar estilos en todos los componentes hijos */
:deep(ul) {
  list-style: none !important;
  list-style-type: none !important;
  padding-left: 0 !important;
}

:deep(li) {
  list-style: none !important;
  list-style-type: none !important;
}

:deep(li::before) {
  content: none !important;
}

:deep(li::marker) {
  content: none !important;
}

:deep(a) {
  text-decoration: none !important;
}
</style>
