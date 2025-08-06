<template>
  <div id="sidebar" :class="{ 'open': isOpen }">
    <div class="sidebar-header">
      <button id="close-btn" @click="handleClose">✕ Cerrar</button>
      <h2 id="town-name">{{ townName?.name || 'Selecciona un pueblo' }}</h2>
    </div>
    
    <div class="sidebar-content">
      <div id="town-info-container">
        <!-- Contenedor del mapa con banderas y escudos integrados -->
        <div id="town-map-section">
          <!-- Bandera a la izquierda -->
          <div id="town-flag" class="side-element left">
            <img v-if="townFlag && flagExists" :src="townFlag" @error="onFlagError" alt="Bandera del municipio" />
            <div v-else class="placeholder-element">🏴</div>
          </div>
          
          <!-- Mapa central -->
          <div id="town-shape" ref="shapeContainer">
            <div class="shape-placeholder">
              <img src="/Limites_salamanca.svg" alt="Límites de Salamanca" class="salamanca-limits" />
              <p class="shape-text">{{ townName?.name || 'Municipio' }}</p>
            </div>
          </div>
          
          <!-- Escudo a la derecha -->
          <div id="town-shield" class="side-element right">
            <img v-if="townShield && shieldExists" :src="townShield" @error="onShieldError" alt="Escudo del municipio" />
            <div v-else class="placeholder-element">🛡️</div>
          </div>
        </div>
      </div>
      
      <div class="info-scroll">
        <!-- Información general -->
        <div id="info-content">
          <h3>Información</h3>
          
          <div v-if="isLoading" class="loading">
            <div class="loading-spinner"></div>
            <span class="loading-text">Cargando información...</span>
          </div>
          <div v-else-if="municipioData" class="town-details">
            <p v-if="municipioData.poblacion">
              <strong>Población:</strong> {{ municipioData.poblacion }} hab.
            </p>
            <p v-if="codPostal && codPostal !== 'N/A'">
              <strong>Código Postal:</strong> {{ codPostal }}
            </p>
            <p v-if="municipioData.latitud">
              <strong>Latitud:</strong> {{ municipioData.latitud }}° N
            </p>
            <p v-if="municipioData.longitud">
              <strong>Longitud:</strong> {{ municipioData.longitud }}° W
            </p>
            <p v-if="municipioData.superficie">
              <strong>Superficie:</strong> {{ municipioData.superficie }} km²
            </p>
            <p v-if="municipioData.altitud">
              <strong>Altitud:</strong> {{ municipioData.altitud }} m
            </p>
            <p v-if="municipioData.densidad">
              <strong>Densidad:</strong> {{ municipioData.densidad }} hab/km²
            </p>
            <div v-if="municipioData.mancomunidades" class="description">
              <h4>Mancomunidades</h4>
              <p>{{ municipioData.mancomunidades }}</p>
            </div>
            <div v-if="municipioData.comarca" class="description">
              <h4>Comarca</h4>
              <p>{{ municipioData.comarca }}</p>
            </div>
            <div v-if="municipioData.entidades_locales_menores" class="description">
              <h4>Entidades Locales Menores</h4>
              <p>{{ municipioData.entidades_locales_menores }}</p>
            </div>
          </div>
          <div v-else class="no-info">
            <p>No hay información disponible para este municipio.</p>
          </div>
        </div>
        
        <!-- Eventos -->
        <div id="events-container">
          <h3>Eventos</h3>
          <div v-if="events && events.length > 0">
            <div 
              v-for="event in events" 
              :key="event.id"
              class="event-item"
              @click="openEventDialog(event)"
            >
              <h4>{{ event.title || event.titulo }}</h4>
              <p v-if="event.date || event.fecha_inicio">
                📅 {{ formatDate(event.date || event.fecha_inicio) }}
              </p>
              <p v-if="event.location || event.ubicacion">
                📍 {{ event.location || event.ubicacion }}
              </p>
            </div>
          </div>
          <div v-else class="no-events">
            <p>No hay eventos programados.</p>
          </div>
        </div>
        
        <!-- Puntos de Interés -->
        <div id="poi-container">
          <h3>¿Qué ver?</h3>
          <div v-if="pointsOfInterest && pointsOfInterest.length > 0">
            <div 
              v-for="poi in pointsOfInterest" 
              :key="poi.id"
              class="poi-item"
              @click="openPOIDialog(poi)"
            >
              <h4>{{ poi.name || poi.nombre }}</h4>
              <p v-if="poi.tipomonumento" class="poi-type">{{ poi.tipomonumento }}</p>
              <button 
                class="btn btn-sm btn-success add-to-route-btn"
                @click.stop="handleAddPOIToRoute(poi)"
              >
                + Añadir a ruta
              </button>
            </div>
          </div>
          <div v-else class="no-pois">
            <p>No hay puntos de interés disponibles.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- POI Dialog -->
  <POIDialog
    :isOpen="poiDialogOpen"
    :poi="selectedPOI"
    @close="closePOIDialog"
    @addToRoute="handleAddPOIToRoute"
  />
  
  <!-- Botón toggle para mostrar/ocultar sidebar -->
  <button 
    id="toggle-town-sidebar-btn" 
    class="btn btn-success"
    :class="{ 'collapsed': !isOpen }"
    @click="handleToggle"
    :style="{ right: isOpen ? '360px' : '10px' }"
    :title="isOpen ? 'Ocultar información' : 'Mostrar información'"
  >
    <div class="toggle-bars">
      <span></span>
      <span></span>
      <span></span>
    </div>
  </button>
</template>

<script>
import { computed, ref, watch, nextTick, toRef } from 'vue'
import { useTownStore } from '@/store/townStore'
import POIDialog from './POIDialog.vue'
import { apiService } from '@/services/apiService'

export default {
  name: 'TownSidebar',
  components: {
    POIDialog
  },
  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    townName: {
      type: Object,
      default: () => ({ id: '', name: '' })
    },
    townInfo: {
      type: Object,
      default: null
    },
    events: {
      type: Array,
      default: () => []
    },
    pointsOfInterest: {
      type: Array,
      default: () => []
    },
  },
  emits: ['close', 'openEventDialog', 'addPoiToRoute'],
  setup(props, { emit }) {
    const shapeContainer = ref(null)
    const townStore = useTownStore()
    const flagExists = ref(true)
    const shieldExists = ref(true)
    
    // POI Dialog state
    const poiDialogOpen = ref(false)
    const selectedPOI = ref({})
    
    const isLoading = computed(() => townStore.isLoading)
    
    // Watch props changes for debugging
    watch(() => props.townInfo, (newTownInfo) => {
      console.log('TownSidebar - townInfo changed:', newTownInfo)
    }, { immediate: true })
    
    watch(() => props.townName, (newTownName) => {
      console.log('TownSidebar - townName changed:', newTownName)
      // Resetear los estados de existencia de imágenes cuando cambia el municipio
      flagExists.value = true
      shieldExists.value = true
    }, { immediate: true })
    
    const codPostal = computed(() => {
      const townData = props.townInfo?.results?.[0]
      return townData && Array.isArray(townData.cod_postal) && townData.cod_postal.length > 0
        ? townData.cod_postal[0]
        : 'N/A';
    })

    // Computed property para acceder a los datos del municipio
    const municipioData = computed(() => {
      return props.townInfo?.results?.[0] || null
    })

    const townFlag = computed(() => {
      if (!props.townName || !props.townName.id || !props.townName.name) return null
      // Formato correcto: INE_nombre_bandera.png
      const normalizedName = props.townName.name.toLowerCase()
        .replace(/\s+/g, ' ')
      const flagName = `${props.townName.id}_${normalizedName}`
      const flagPath = `/assets/flags/${flagName}_bandera.png`
      console.log('TownSidebar - Flag path:', flagPath)
      console.log('TownSidebar - Original flag name:', flagName)
      return flagPath
    })

    const townShield = computed(() => {
      if (!props.townName || !props.townName.id || !props.townName.name) return null
      // Formato: INE_nombre_shield.svg (manteniendo caracteres especiales)
      const normalizedName = props.townName.name.toLowerCase()
        .replace(/\s+/g, ' ')
      const shieldName = `${props.townName.id}_${normalizedName}`
      const shieldPath = `/assets/shields/${shieldName}_shield.svg`
      console.log('TownSidebar - Shield path:', shieldPath)
      console.log('TownSidebar - Original shield name:', shieldName)
      return shieldPath
    })

    const handleClose = () => {
      emit('close')
    }

    const handleToggle = () => {
      emit('close')
    }

    const openEventDialog = (event) => {
      emit('openEventDialog', event)
    }

    const formatDate = (dateString) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }

    // POI Dialog methods
    const openPOIDialog = (poi) => {
      selectedPOI.value = poi
      poiDialogOpen.value = true
    }

    const closePOIDialog = () => {
      poiDialogOpen.value = false
      selectedPOI.value = {}
    }

    const handleAddPOIToRoute = (poi) => {
      emit('addPoiToRoute', poi)
      closePOIDialog()
    }

    const onFlagError = () => {
      console.log('TownSidebar - Flag failed to load:', townFlag.value)
      flagExists.value = false
    }

    const onShieldError = () => {
      console.log('TownSidebar - Shield failed to load:', townShield.value)
      shieldExists.value = false
    }

    return {
      isLoading,
      townName: toRef(props, 'townName'),
      townInfo: toRef(props, 'townInfo'),
      municipioData,
      events: toRef(props, 'events'),
      pointsOfInterest: toRef(props, 'pointsOfInterest'),
      townFlag,
      townShield,
      codPostal,
      flagExists,
      shieldExists,
      handleClose,
      handleToggle,
      openEventDialog,
      formatDate,
      onFlagError,
      onShieldError,
      shapeContainer,
      // POI Dialog
      poiDialogOpen,
      selectedPOI,
      openPOIDialog,
      closePOIDialog,
      handleAddPOIToRoute
    }
  }
}
</script>

<style scoped>
#sidebar {
  width: 370px;
  height: 100vh;
  position: fixed;
  right: -370px;
  top: 0;
  background: var(--bg-primary);
  box-shadow: -2px 0 20px var(--shadow-medium);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0;
  display: flex;
  flex-direction: column;
  z-index: 1000;
  overflow-y: auto;
  backdrop-filter: blur(10px);
  border-left: 3px solid var(--primary-color);
}

#sidebar.open {
  right: 0;
}

/* Responsive adjustments for mobile */
@media (max-width: 767px) {
  #sidebar {
    width: 100vw;
    right: -100vw;
    z-index: 9999;
  }
  
  #sidebar.open {
    right: 0;
  }
}

/* Header section */
.sidebar-header {
  background: var(--bg-header);
  color: var(--text-light);
  padding: 20px;
  position: sticky;
  top: 0;
  z-index: 100;
}

#close-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: var(--text-light);
  font-size: 16px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

#close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

#town-name {
  margin: 0;
  font-size: 1.5em;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  padding-right: 60px;
  color: var(--text-light);
}

.sidebar-content {
  flex: 1;
  padding: 0;
  overflow-y: auto;
}

.info-scroll {
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  padding: 20px;
}

/* Town map section with integrated flags and shields */
#town-map-section {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
  padding: 15px;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-secondary);
}

/* Town shape container - now in the center */
#town-shape {
  flex: 1;
  min-height: 160px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--border-primary);
  position: relative;
  overflow: hidden;
}

/* Side elements (flags and shields) */
.side-element {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 90px;
  transition: transform 0.2s ease;
}

.side-element:hover {
  transform: scale(1.05);
}

.side-element.left {
  order: 1;
}

.side-element.right {
  order: 3;
}

#town-shape {
  order: 2;
}

.shape-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  position: relative;
}

.salamanca-limits {
  width: 100%;
  height: auto;
  max-height: 150px;
  object-fit: contain;
  opacity: 0.3;
  filter: sepia(100%) saturate(300%) hue-rotate(90deg);
}

.shape-text {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  color: var(--primary-color);
  font-weight: 600;
  font-size: 14px;
  background: var(--glass-bg);
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid var(--primary-color);
  margin: 0;
}

/* Flags and shields - now integrated in the map section */
#town-flag img,
#town-shield img {
  width: 80px;
  height: 80px;
  object-fit: contain;
  transition: all 0.2s ease;
}

#town-flag img:hover,
#town-shield img:hover {
  transform: scale(1.05);
}

/* Placeholder for missing flags and shields */
.placeholder-element {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  background: var(--hover-bg);
  border-radius: 8px;
  border: 2px dashed var(--border-secondary);
  transition: all 0.2s ease;
  color: var(--text-muted);
}

.placeholder-element:hover {
  transform: scale(1.05);
  background: var(--active-bg);
}

/* Responsive adjustments for the map section */
@media (max-width: 480px) {
  #town-map-section {
    flex-direction: column;
    gap: 10px;
    padding: 10px;
  }
  
  .side-element {
    order: unset !important;
    min-width: unset;
  }
  
  .side-element.left {
    order: 1;
  }
  
  #town-shape {
    order: 2;
    min-height: 120px;
  }
  
  .side-element.right {
    order: 3;
  }
  
  #town-flag img,
  #town-shield img {
    width: 70px;
    height: 70px;
  }
  
  .placeholder-element {
    width: 70px;
    height: 70px;
    font-size: 35px;
  }
}

/* Info sections */
.town-details p {
  margin: 10px 0;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-light);
  font-size: 14px;
  color: var(--text-secondary);
}

.town-details p:last-child {
  border-bottom: none;
}

.town-details strong {
  color: var(--primary-color);
  font-weight: 600;
}

.description {
  background: var(--bg-secondary);
  border-radius: 8px;
  margin: 15px 0;
  padding: 15px;
  border-left: 4px solid var(--primary-color);
}

.description h4 {
  margin: 0 0 10px 0;
  color: var(--primary-color);
  font-size: 1.1em;
  font-weight: 600;
}

.description p {
  margin: 0;
  line-height: 1.5;
  color: var(--text-tertiary);
}

h3 {
  color: var(--text-primary);
  border-bottom: 2px solid var(--primary-color);
  padding-bottom: 8px;
  margin: 25px 0 15px 0;
  font-size: 1.2em;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

h3::before {
  font-size: 1.2em;
}

#info-content h3::before {
  content: "ℹ️";
}

#events-container h3::before {
  content: "🎭";
}

#poi-container h3::before {
  content: "👁️";
}

/* Event and POI items */
.event-item,
.poi-item {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 15px;
  margin: 10px 0;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
}

.event-item:hover,
.poi-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--primary-color);
  background: var(--bg-hover);
}

.event-item h4,
.poi-item h4 {
  margin: 0 0 8px 0;
  color: var(--text-primary);
  font-size: 1.1em;
  font-weight: 600;
}

.event-item p,
.poi-item p {
  margin: 5px 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.poi-type {
  font-style: italic;
  font-size: 12px;
  color: var(--accent-color);
}

.add-to-route-btn {
  margin-top: 10px;
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 4px;
  background: var(--primary-color);
  color: var(--bg-primary);
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-to-route-btn:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.no-info,
.no-events,
.no-pois {
  text-align: center;
  color: var(--text-secondary);
  font-style: italic;
  padding: 20px;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin: 15px 0;
  border: 1px solid var(--border-light);
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-style: normal;
  color: var(--text-secondary);
  padding: 20px;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin: 15px 0;
  border: 1px solid var(--border-light);
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-light);
  border-top: 2px solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  flex-shrink: 0;
}

.loading-text {
  animation: none !important;
  transform: none !important;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Scrollbar personalizada */
.info-scroll::-webkit-scrollbar {
  width: 6px;
}

.info-scroll::-webkit-scrollbar-track {
  background: var(--border-light);
  border-radius: 3px;
}

.info-scroll::-webkit-scrollbar-thumb {
  background: var(--primary-color);
  border-radius: 3px;
}

.info-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--primary-hover);
}

/* Botón toggle para TownSidebar */
#toggle-town-sidebar-btn {
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

#toggle-town-sidebar-btn:hover {
  background: var(--primary-hover);
  transform: translateY(-50%) scale(1.1);
  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.25);
}

#toggle-town-sidebar-btn:active {
  transform: translateY(-50%) scale(0.95);
}

#toggle-town-sidebar-btn.collapsed {
  background: var(--accent-color);
}

#toggle-town-sidebar-btn .toggle-bars {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 18px;
  height: 18px;
  transition: all 0.3s ease;
}

#toggle-town-sidebar-btn .toggle-bars span {
  position: absolute;
  width: 14px;
  height: 2px;
  background: var(--text-light);
  border-radius: 1px;
  transition: all 0.3s ease;
}

/* Cuando está abierto - mostrar X */
#toggle-town-sidebar-btn:not(.collapsed) .toggle-bars span:nth-child(1) {
  transform: rotate(45deg);
}

#toggle-town-sidebar-btn:not(.collapsed) .toggle-bars span:nth-child(2) {
  opacity: 0;
}

#toggle-town-sidebar-btn:not(.collapsed) .toggle-bars span:nth-child(3) {
  transform: rotate(-45deg);
}

/* Cuando está cerrado - mostrar flecha izquierda */
#toggle-town-sidebar-btn.collapsed .toggle-bars span:nth-child(1) {
  transform: rotate(-45deg) translateY(-3px);
}

#toggle-town-sidebar-btn.collapsed .toggle-bars span:nth-child(2) {
  transform: rotate(45deg) translateY(3px);
}

#toggle-town-sidebar-btn.collapsed .toggle-bars span:nth-child(3) {
  opacity: 0;
}

/* Mobile adjustments for toggle button */
@media (max-width: 767px) {
  #toggle-town-sidebar-btn {
    top: 20px;
    right: 20px !important;
    transform: none;
    width: 45px;
    height: 45px;
    z-index: 10000;
  }
  
  #toggle-town-sidebar-btn:hover {
    transform: scale(1.1);
  }
  
  #toggle-town-sidebar-btn .toggle-bars {
    width: 16px;
    height: 16px;
  }
  
  #toggle-town-sidebar-btn .toggle-bars span {
    width: 12px;
  }
}
</style>