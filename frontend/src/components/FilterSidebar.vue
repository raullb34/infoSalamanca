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
            :showTooltips="showTooltips"
            :autoExpandSidebar="autoExpandSidebar"
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
    :style="{ left: isExpanded ? '310px' : '10px' }"
    :title="isExpanded ? 'Ocultar filtros' : 'Mostrar filtros'"
  >
    <div class="toggle-bars">
      <span></span>
      <span></span>
      <span></span>
    </div>
  </button>
</template>

<script>
import { ref, watch, toRef } from 'vue'
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
    },
    showTooltips: {
      type: Boolean,
      default: true
    }
  },
  emits: ['clearFilter', 'itemSelected', 'generateRoute', 'removeFromRoute', 'toggleTooltips', 'toggleAutoExpand'],
  setup(props, { emit }) {
    const isExpanded = ref(true)
    
    // Configuraciones - usar las props en lugar de estado local
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

    const toggleTooltips = (value) => {
      emit('toggleTooltips', value)
      console.log('Tooltips toggled in FilterSidebar:', value)
    }

    const toggleAutoExpand = (value) => {
      if (typeof value === 'boolean') {
        autoExpandSidebar.value = value
      } else {
        autoExpandSidebar.value = !autoExpandSidebar.value
      }
      emit('toggleAutoExpand', autoExpandSidebar.value)
      console.log('Auto expand toggled in FilterSidebar:', autoExpandSidebar.value)
    }

    // Expandir automáticamente cuando hay un filtro activo
    watch(() => props.activeFilter, (newFilter) => {
      if (newFilter && !isExpanded.value && autoExpandSidebar.value) {
        isExpanded.value = true
      }
    })

    return {
      isExpanded,
      showTooltips: toRef(props, 'showTooltips'),
      autoExpandSidebar,
      toggleSidebar,
      clearFilter,
      showItemDetails,
      generateRoute,
      removeFromRoute,
      toggleTooltips,
      toggleAutoExpand
    }
  }
}
</script>

<style scoped>
/* Estilos principales del sidebar mejorados */
#filter-sidebar {
  width: 320px;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  background: var(--bg-primary);
  box-shadow: var(--shadow-lg);
  padding: 0;
  display: flex;
  flex-direction: column;
  z-index: 1000;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  border-right: 3px solid var(--primary-color);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

#filter-sidebar:not(.expanded) {
  transform: translateX(-100%);
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
  border: none;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: var(--primary-color);
  color: var(--text-light);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
}

#toggle-filter-sidebar-btn:hover {
  background: var(--primary-hover);
  transform: translateY(-50%) scale(1.1);
  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.25);
}

#toggle-filter-sidebar-btn:active {
  transform: translateY(-50%) scale(0.95);
}

#toggle-filter-sidebar-btn.collapsed {
  background: var(--accent-color);
}

.toggle-bars {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 18px;
  height: 18px;
  transition: all 0.3s ease;
}

.toggle-bars span {
  position: absolute;
  width: 14px;
  height: 2px;
  background: var(--text-light);
  border-radius: 1px;
  transition: all 0.3s ease;
}

/* Cuando está expandido - mostrar X */
#toggle-filter-sidebar-btn:not(.collapsed) .toggle-bars span:nth-child(1) {
  transform: rotate(45deg);
}

#toggle-filter-sidebar-btn:not(.collapsed) .toggle-bars span:nth-child(2) {
  opacity: 0;
}

#toggle-filter-sidebar-btn:not(.collapsed) .toggle-bars span:nth-child(3) {
  transform: rotate(-45deg);
}

/* Cuando está colapsado - mostrar flecha derecha */
#toggle-filter-sidebar-btn.collapsed .toggle-bars span:nth-child(1) {
  transform: rotate(45deg) translateY(-3px);
}

#toggle-filter-sidebar-btn.collapsed .toggle-bars span:nth-child(2) {
  transform: rotate(-45deg) translateY(3px);
}

#toggle-filter-sidebar-btn.collapsed .toggle-bars span:nth-child(3) {
  opacity: 0;
}

/* Mobile adjustments for toggle button */
@media (max-width: 767px) {
  #toggle-filter-sidebar-btn {
    top: 20px;
    left: 20px !important;
    transform: none;
    width: 45px;
    height: 45px;
    z-index: 10000;
  }
  
  #toggle-filter-sidebar-btn:hover {
    transform: scale(1.1);
  }
  
  .toggle-bars {
    width: 16px;
    height: 16px;
  }
  
  .toggle-bars span {
    width: 12px;
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
  background: var(--bg-header);
  border-bottom: 1px solid var(--border-light);
  margin: 0;
  padding: 8px 0;
  display: flex;
  justify-content: center;
  gap: 2px;
  border-radius: 0;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

:deep(.tabs-component-tab) {
  flex: 1;
  background: transparent;
  border: none;
  margin: 0;
  border-radius: 0;
  transition: var(--transition, all 0.3s ease);
  max-width: 75px;
}

:deep(.tabs-component-tab a) {
  display: block;
  padding: 12px 8px;
  text-decoration: none !important;
  color: var(--text-light) !important;
  font-weight: 500;
  font-size: 13px;
  text-align: center;
  transition: var(--transition, all 0.3s ease);
  border-bottom: 3px solid transparent;
  border-radius: 6px 6px 0 0;
  white-space: nowrap;
  min-width: 65px;
  opacity: 0.8;
}

:deep(.tabs-component-tab a:link),
:deep(.tabs-component-tab a:visited),
:deep(.tabs-component-tab a:hover),
:deep(.tabs-component-tab a:active) {
  text-decoration: none !important;
  color: var(--text-light) !important;
}

:deep(.tabs-component-tab:hover a) {
  color: var(--text-light) !important;
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
  opacity: 1;
  text-decoration: none !important;
}

:deep(.tabs-component-tab.is-active a) {
  color: var(--primary-color) !important;
  background: var(--bg-primary);
  border-bottom-color: var(--primary-color);
  font-weight: 600;
  box-shadow: 0 -2px 4px rgba(0,0,0,0.1);
  opacity: 1;
  text-decoration: none !important;
}

:deep(.tabs-component-panels) {
  flex: 1;
  padding: 15px;
  overflow-y: auto;
  background: var(--bg-primary);
}

/* Mobile adjustments */
@media (max-width: 767px) {
  :deep(.tabs-component-tabs) {
    flex-wrap: nowrap;
    gap: 1px;
    padding: 6px 0;
  }
  
  :deep(.tabs-component-tab) {
    flex: 1;
    max-width: none;
  }
  
  :deep(.tabs-component-tab a) {
    padding: 10px 4px;
    font-size: 11px;
    min-width: auto;
  }
  
  :deep(.tabs-component-panels) {
    padding: 12px;
  }
}

/* Botones mejorados */
.btn-success {
  background: var(--primary-color);
  border: none;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.2s ease;
  color: var(--text-light);
}

.btn-success:hover {
  background: var(--primary-hover);
}

.btn-success:disabled {
  background: var(--text-secondary);
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

/* Forzar que todos los enlaces en el componente usen colores de tema */
:deep(a) {
  color: inherit !important;
  text-decoration: none !important;
}

:deep(a:link),
:deep(a:visited),
:deep(a:hover),
:deep(a:active) {
  color: inherit !important;
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
</style>
