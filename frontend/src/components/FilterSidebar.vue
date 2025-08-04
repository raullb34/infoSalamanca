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
    :style="{ left: isExpanded ? '370px' : '10px' }"
    :title="isExpanded ? 'Ocultar panel' : 'Mostrar panel'"
  >
    <span class="toggle-icon">{{ isExpanded ? '⬅️' : '➡️' }}</span>
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
/* Estilos principales del sidebar mejorados */
#filter-sidebar {
  width: 380px;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  background: linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%);
  box-shadow: 2px 0 20px rgba(0, 0, 0, 0.1);
  padding: 0;
  display: flex;
  flex-direction: column;
  z-index: 1000;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  border-right: 3px solid var(--primary-color, #4CAF50);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

#filter-sidebar:not(.expanded) {
  transform: translateX(-300px);
  box-shadow: 0 0 0 rgba(0, 0, 0, 0);
}

#filter-sidebar.expanded {
  transform: translateX(0);
}

/* Responsive adjustments for mobile */
@media (max-width: 767px) {
  #filter-sidebar {
    width: 100vw;
    z-index: 9999;
  }
  
  #filter-sidebar:not(.expanded) {
    transform: translateX(-100%);
  }
}

#toggle-filter-sidebar-btn {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1001;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 0 12px 12px 0;
  box-shadow: 2px 0 15px rgba(0, 0, 0, 0.2);
  border: none;
  padding: 15px 10px;
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
  cursor: pointer;
  min-width: 50px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
}

#toggle-filter-sidebar-btn:hover {
  background: linear-gradient(135deg, #218838, #1ea085);
  box-shadow: 3px 0 20px rgba(0, 0, 0, 0.3);
  transform: translateY(-50%) scale(1.05);
}

#toggle-filter-sidebar-btn:active {
  transform: translateY(-50%) scale(0.95);
}

#toggle-filter-sidebar-btn.collapsed {
  border-radius: 12px;
  box-shadow: 2px 2px 15px rgba(0, 0, 0, 0.2);
}

.toggle-icon {
  font-size: 18px;
  transition: transform 0.3s ease;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

#toggle-filter-sidebar-btn:hover .toggle-icon {
  transform: scale(1.2);
}

/* Mobile adjustments for toggle button */
@media (max-width: 767px) {
  #toggle-filter-sidebar-btn {
    top: 20px;
    left: 20px !important;
    transform: none;
    border-radius: 12px;
    width: 50px;
    height: 50px;
    font-size: 16px;
    z-index: 10000;
  }
  
  #toggle-filter-sidebar-btn:hover {
    transform: scale(1.05);
  }
}

/* Personalizar las tabs - Estilo moderno y responsivo */
:deep(.tabs-component) {
  margin: 0;
  background: transparent;
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.tabs-component-tabs) {
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  border-bottom: 1px solid #dee2e6;
  margin: 0;
  padding: 0;
  display: flex;
  border-radius: 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

:deep(.tabs-component-tab) {
  flex: 1;
  background: transparent;
  border: none;
  margin: 0;
  border-radius: 0;
  transition: var(--transition, all 0.3s ease);
}

:deep(.tabs-component-tab a) {
  display: block;
  padding: 16px 12px;
  text-decoration: none;
  color: #666;
  font-weight: 500;
  font-size: 14px;
  text-align: center;
  transition: var(--transition, all 0.3s ease);
  border-bottom: 3px solid transparent;
}

:deep(.tabs-component-tab:hover a) {
  color: var(--primary-color, #4CAF50);
  background: rgba(76, 175, 80, 0.05);
}

:deep(.tabs-component-tab.is-active a) {
  color: var(--primary-color, #4CAF50);
  background: rgba(76, 175, 80, 0.1);
  border-bottom-color: var(--primary-color, #4CAF50);
  font-weight: 600;
}

:deep(.tabs-component-panels) {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: white;
}

/* Mobile adjustments */
@media (max-width: 767px) {
  :deep(.tabs-component-tabs) {
    flex-wrap: wrap;
  }
  
  :deep(.tabs-component-tab) {
    flex: 1 1 50%;
  }
  
  :deep(.tabs-component-tab a) {
    padding: 12px 8px;
    font-size: 12px;
  }
  
  :deep(.tabs-component-panels) {
    padding: 15px;
  }
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
