<template>
  <div id="sidebar" :class="{ 'open': isOpen }">
    <div class="sidebar-header">
      <h2 id="town-name">{{ townName?.name || 'Selecciona un pueblo' }}</h2>
      <button id="close-btn" type="button" aria-label="Cerrar la ficha" title="Cerrar" @click="handleClose">×</button>
    </div>
    
    <div class="sidebar-content">
      <div id="town-info-container">
        <!-- Contenedor del mapa con banderas y escudos integrados -->
        <div id="town-map-section">
          <!-- Bandera a la izquierda -->
          <div id="town-flag" class="side-element left">
            <!-- Bandera ondeando; si no hay, el escudo sobre tela neutra -->
            <WavingFlag
              v-if="townFlag || townShield"
              :flag="townFlag"
              :shield="townShield"
              :status="townEmblems.estadoBandera || null"
              :townName="townName?.name || ''"
            />
            <div v-else class="placeholder-element">🏴</div>
          </div>
          
          <!-- Mapa central -->
          <div id="town-shape" ref="shapeContainer">
            <svg 
              v-if="townShape" 
              :viewBox="townShapeViewBox" 
              width="100%" 
              height="100%" 
              class="town-shape-svg"
              preserveAspectRatio="xMidYMid meet"
            >
              <path 
                :d="townShape.d" 
                :style="townShape.style"
                class="town-path"
              />
            </svg>
            <div v-else class="no-shape">
              <div class="shape-icon">🗺️</div>
              <p class="shape-text">{{ townName?.name || 'Municipio' }}</p>
            </div>
          </div>
          
          <!-- Escudo a la derecha -->
          <div id="town-shield" class="side-element right">
            <!-- :key: nueva imagen por municipio, así nunca se ve un instante el escudo del anterior -->
            <img
              v-if="townShield && shieldExists"
              :key="townShield"
              :src="townShield"
              class="emblem-img"
              :class="{ loaded: shieldLoaded }"
              @load="shieldLoaded = true"
              @error="onShieldError"
              alt="Escudo del municipio"
            />
            <div v-else class="placeholder-element">🛡️</div>
          </div>
        </div>

        <!-- Créditos de bandera y escudo (Wikimedia Commons; CC BY-SA exige autor y licencia) -->
        <p v-if="emblemCredits.length" class="emblem-credits">
          <span v-for="c in emblemCredits" :key="c.tipo" class="emblem-credit">
            {{ c.tipo }}:
            <a :href="c.fuente" target="_blank" rel="noopener">{{ c.autor }}</a>,
            <a v-if="c.licenciaUrl" :href="c.licenciaUrl" target="_blank" rel="noopener license">{{ c.licencia }}</a>
            <template v-else>{{ c.licencia }}</template>
          </span>
          <span class="emblem-credit-via">vía Wikimedia Commons</span>
        </p>
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
            <p v-if="municipalEmail">
              <strong>Correo Ayuntamiento:</strong>
              <a :href="`mailto:${municipalEmail}`">{{ municipalEmail }}</a>
            </p>
            <p v-if="municipalPhone">
              <strong>Teléfono Ayuntamiento:</strong>
              <a :href="`tel:${municipalPhone}`">{{ municipalPhone }}</a>
            </p>
            <p v-if="municipalWebsite">
              <strong>Web Ayuntamiento:</strong>
              <a :href="municipalWebsite" target="_blank" rel="noopener">{{ displayUrl(municipalWebsite) }}</a>
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

            <!-- Fiestas Patronales -->
            <div class="description" v-if="festivalsText || daysUntilFestival !== null">
              <h4>Fiestas Patronales</h4>
              <p v-if="festivalsText">{{ festivalsText }}</p>
              <p v-if="daysUntilFestival !== null" class="festival-countdown">
                <span v-if="daysUntilFestival === 0" class="countdown-today">🎉 ¡Hoy son las fiestas!</span>
                <span v-else-if="daysUntilFestival === 1" class="countdown-soon">🎊 Falta {{ daysUntilFestival }} día</span>
                <span v-else-if="daysUntilFestival <= 30" class="countdown-soon">🎊 Faltan {{ daysUntilFestival }} días</span>
                <span v-else class="countdown-normal">📅 Faltan {{ daysUntilFestival }} días</span>
              </p>
              <p v-if="!festivalsText && daysUntilFestival === null">Sin información</p>
            </div>
          </div>
          <div v-else class="no-info">
            <p>No hay información disponible para este municipio.</p>
          </div>
        </div>
        
        <!-- Historia (Wikipedia) -->
        <div id="history-container" v-if="historia && (historia.resumen || historia.historia.length)">
          <h3 @click="historyExpanded = !historyExpanded" class="collapsible-header">
            <span>Historia</span>
            <span class="section-info">
              <span class="toggle-icon">{{ historyExpanded ? '▼' : '▶' }}</span>
            </span>
          </h3>
          <div v-show="historyExpanded" class="history-text">
            <p v-if="historia.resumen">{{ historia.resumen }}</p>
            <p v-for="(parrafo, i) in visibleHistoria" :key="i">{{ parrafo }}</p>
            <button
              v-if="historia.historia.length > 1"
              class="btn btn-link btn-sm history-more"
              @click="historyFull = !historyFull"
            >
              {{ historyFull ? 'Leer menos' : 'Leer más' }}
            </button>
            <p class="history-source">
              Fuente: <a :href="historia.fuente" target="_blank" rel="noopener">Wikipedia</a> (CC BY-SA)
            </p>
          </div>
        </div>

        <!-- Eventos -->
        <div id="events-container">
          <h3 @click="toggleEventsSection" class="collapsible-header">
            <span>Eventos</span>
            <span class="section-info">
              <span v-if="!eventsExpanded && events && events.length > 0" class="count-badge">{{ events.length }}</span>
              <span class="toggle-icon">{{ eventsExpanded ? '▼' : '▶' }}</span>
            </span>
          </h3>
          <div v-show="eventsExpanded">
            <div v-if="events && events.length > 0">
              <div 
                v-for="event in sortedEvents" 
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
        </div>
        
        <!-- Puntos de Interés -->
        <div id="poi-container">
          <h3 @click="togglePOISection" class="collapsible-header">
            <span>¿Qué ver?</span>
            <span class="section-info">
              <span v-if="!poisExpanded && pointsOfInterest && pointsOfInterest.length > 0" class="count-badge">{{ pointsOfInterest.length }}</span>
              <span class="toggle-icon">{{ poisExpanded ? '▼' : '▶' }}</span>
            </span>
          </h3>
          <div v-show="poisExpanded">
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
import { computed, ref, watch, nextTick, toRef, onMounted } from 'vue'
import { useTownStore } from '@/store/townStore'
import POIDialog from './POIDialog.vue'
import WavingFlag from './WavingFlag.vue'
import { apiService } from '@/services/apiService'
import { emblems, loadEmblems, emblemSrc } from '@/services/emblems'
import { daysUntilFestival as daysUntilFestival_, formatFestivalDays } from '@/utils/festivals'

export default {
  name: 'TownSidebar',
  components: {
    POIDialog,
    WavingFlag
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
    
    // Estado para manejar la forma del municipio
    const salamancaSvgData = ref(null)
    const townShape = ref(null)
    const townShapeViewBox = ref('0 0 800 600')
    
    // POI Dialog state
    const poiDialogOpen = ref(false)
    const selectedPOI = ref({})
    
    // Estados para colapsar/expandir secciones
    const eventsExpanded = ref(true)
    const poisExpanded = ref(true)
    
    const isLoading = computed(() => townStore.isLoading)

    // Información municipal (backend propio)
    const municipalInfo = ref(null)
    const municipalLoading = ref(false)
    const municipalFestivals = ref([])

    const loadMunicipalInfo = async (ineId) => {
      if (!ineId) {
        municipalInfo.value = null
        return
      }
      try {
        console.log('🏛️ Cargando info municipal para INE:', ineId)
        municipalLoading.value = true
        const data = await apiService.getMunicipalInfo(ineId)
        console.log('📦 Respuesta municipal info:', data)
        console.log('📦 Type of data:', typeof data, Array.isArray(data))
        console.log('📦 Data stringified:', JSON.stringify(data))
        // Force plain object conversion
        municipalInfo.value = data ? JSON.parse(JSON.stringify(data)) : null
        console.log('✅ Municipal info almacenado:', municipalInfo.value)
        console.log('✅ Email path:', municipalInfo.value?.contact_info?.town_hall?.email)
      } catch (e) {
        console.error('❌ Error cargando info municipal:', e)
        municipalInfo.value = null
      } finally {
        municipalLoading.value = false
      }
    }

    // Historia (Wikipedia)
    const historia = ref(null)
    const historyExpanded = ref(true)
    const historyFull = ref(false)
    const visibleHistoria = computed(() => {
      const parrafos = historia.value?.historia || []
      return historyFull.value ? parrafos : parrafos.slice(0, 1)
    })
    const loadHistoria = async (ineId) => {
      historia.value = null
      historyFull.value = false
      if (!ineId) return
      const data = await apiService.getTownHistoria(ineId)
      // Evitar pisar la ficha si el usuario ya ha cambiado de municipio
      if (props.townName?.id === ineId) historia.value = data
    }

    const loadMunicipalFestivals = async (ineId) => {
      municipalFestivals.value = []
      if (!ineId) return
      try {
        console.log('🎉 Cargando fiestas para INE:', ineId)
        const res = await apiService.getMunicipalFestivals(ineId)
        console.log('📦 Respuesta festivals:', res)
        if (res && res.success) {
          municipalFestivals.value = res.data || []
          console.log('✅ Fiestas cargadas:', municipalFestivals.value)
        }
      } catch (err) {
        console.error('❌ Error cargando fiestas:', err)
        municipalFestivals.value = []
      }
    }

    // Método para cargar el SVG de Salamanca
    const loadSalamancaSvg = async () => {
      try {
        const response = await fetch('/Limites_salamanca.svg')
        const svgText = await response.text()
        salamancaSvgData.value = svgText
        extractTownShape()
      } catch (error) {
        console.error('Error loading Salamanca SVG:', error)
      }
    }

    // Método para extraer la forma específica del municipio
    const extractTownShape = () => {
      if (!salamancaSvgData.value || !props.townName?.id) {
        townShape.value = null
        return
      }

      try {
        // Crear un parser DOM para procesar el SVG
        const parser = new DOMParser()
        const svgDoc = parser.parseFromString(salamancaSvgData.value, 'image/svg+xml')
        
        // Buscar el path del municipio por su ID exacto
        const townPath = svgDoc.querySelector(`path[id="${props.townName.id}"]`)
        
        if (townPath) {
          processTownPath(townPath)
          console.log('TownSidebar - Town shape found for ID:', props.townName.id)
        } else {
          console.log('TownSidebar - Town path not found for ID:', props.townName.id)
          townShape.value = null
        }
      } catch (error) {
        console.error('Error extracting town shape:', error)
        townShape.value = null
      }
    }

    // Método para procesar el path del municipio encontrado
    const processTownPath = (pathElement) => {
      const d = pathElement.getAttribute('d')
      
      if (d) {
        // Bounding box real del path (el navegador entiende los comandos relativos m/l/c)
        const bbox = measurePathBBox(d) || calculatePathBoundingBox(d)
        
        // Usar el padding que sabemos que funciona
        const padding = Math.max(bbox.width, bbox.height) * 0.05
        
        townShapeViewBox.value = `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`
        
        townShape.value = {
          d,
          style: `fill: var(--primary-color); stroke: var(--text-primary); stroke-width: 1; filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.3));`
        }
        
        console.log('TownSidebar - Town shape visible for:', props.townName.name)
      }
    }

    // Mide el path en un SVG oculto con getBBox()
    const measurePathBBox = (pathData) => {
      try {
        const ns = 'http://www.w3.org/2000/svg'
        const svg = document.createElementNS(ns, 'svg')
        svg.setAttribute('style', 'position:absolute;width:0;height:0;visibility:hidden')
        const path = document.createElementNS(ns, 'path')
        path.setAttribute('d', pathData)
        svg.appendChild(path)
        document.body.appendChild(svg)
        const { x, y, width, height } = path.getBBox()
        svg.remove()
        return width > 0 && height > 0 ? { x, y, width, height } : null
      } catch (_) {
        return null
      }
    }

    // Cálculo aproximado (respaldo si getBBox no está disponible)
    const calculatePathBoundingBox = (pathData) => {
      // Usar una expresión regular más precisa para extraer coordenadas
      const coordinateRegex = /-?\d*\.?\d+/g
      const coordinates = pathData.match(coordinateRegex)?.map(Number) || []
      
      if (coordinates.length < 4) {
        return { x: 0, y: 0, width: 800, height: 600 }
      }
      
      // Separar coordenadas X e Y
      const xCoords = []
      const yCoords = []
      
      // Procesar comandos de path para extraer solo las coordenadas de posición
      const commands = pathData.match(/[MLHVCSQTAZmlhvcsqtaz][^MLHVCSQTAZmlhvcsqtaz]*/g) || []
      
      commands.forEach(command => {
        const coords = command.slice(1).match(coordinateRegex)?.map(Number) || []
        const commandType = command[0].toLowerCase()
        
        if (commandType === 'm' || commandType === 'l' || commandType === 't') {
          // Move, Line, smooth curve commands
          for (let i = 0; i < coords.length; i += 2) {
            if (coords[i] !== undefined) xCoords.push(coords[i])
            if (coords[i + 1] !== undefined) yCoords.push(coords[i + 1])
          }
        } else if (commandType === 'c' || commandType === 's') {
          // Cubic bezier commands
          for (let i = 0; i < coords.length; i += 6) {
            if (coords[i + 4] !== undefined) xCoords.push(coords[i + 4])
            if (coords[i + 5] !== undefined) yCoords.push(coords[i + 5])
          }
        } else if (commandType === 'q') {
          // Quadratic bezier commands
          for (let i = 0; i < coords.length; i += 4) {
            if (coords[i + 2] !== undefined) xCoords.push(coords[i + 2])
            if (coords[i + 3] !== undefined) yCoords.push(coords[i + 3])
          }
        } else if (commandType === 'h') {
          // Horizontal line
          coords.forEach(coord => xCoords.push(coord))
        } else if (commandType === 'v') {
          // Vertical line
          coords.forEach(coord => yCoords.push(coord))
        }
      })
      
      if (xCoords.length === 0 || yCoords.length === 0) {
        // Fallback: usar todas las coordenadas pares/impares
        for (let i = 0; i < coordinates.length; i += 2) {
          if (coordinates[i] !== undefined) xCoords.push(coordinates[i])
          if (coordinates[i + 1] !== undefined) yCoords.push(coordinates[i + 1])
        }
      }
      
      const minX = Math.min(...xCoords)
      const maxX = Math.max(...xCoords)
      const minY = Math.min(...yCoords)
      const maxY = Math.max(...yCoords)
      
      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      }
    }
    
    // Watch props changes for debugging
    watch(() => props.townInfo, (newTownInfo) => {
      console.log('TownSidebar - townInfo changed:', newTownInfo)
    }, { immediate: true })
    
    watch(() => props.townName, (newTownName) => {
      console.log('TownSidebar - townName changed:', newTownName)
      // Resetear los estados de existencia de imágenes cuando cambia el municipio
      flagExists.value = true
      shieldExists.value = true
      // Extraer la nueva forma del municipio
      extractTownShape()
      // Cargar info municipal
      const ineId = newTownName?.id
      if (ineId) {
        loadMunicipalInfo(ineId)
        loadMunicipalFestivals(ineId)
        loadHistoria(ineId)
      } else {
        historia.value = null
        municipalInfo.value = null
        municipalFestivals.value = []
      }
    }, { immediate: true })

    // Cargar el SVG de Salamanca al montar el componente
    onMounted(() => {
      loadSalamancaSvg()
      loadEmblems()
    })
    
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

    // Campos derivados de info municipal
    const municipalEmail = computed(() => {
      const email = municipalInfo.value?.contact_info?.town_hall?.email || ''
      console.log('📧 Computing municipalEmail:', { municipalInfo: municipalInfo.value, email })
      return email
    })
    const municipalPhone = computed(() => {
      const phone = municipalInfo.value?.contact_info?.town_hall?.phone || municipalInfo.value?.contact_info?.town_hall?.telefono || ''
      console.log('📞 Computing municipalPhone:', { municipalInfo: municipalInfo.value, phone })
      return phone
    })
    const municipalWebsite = computed(() => {
      const website = municipalInfo.value?.contact_info?.town_hall?.website || ''
      console.log('🌐 Computing municipalWebsite:', { municipalInfo: municipalInfo.value, website })
      return website
    })

    // Fiestas: dos días sueltos ("20 de enero y 5 de mayo"), no un intervalo (utils/festivals.js)
    const festivalDates = computed(() =>
      municipalFestivals.value?.[0]?.celebration_dates || municipalInfo.value?.patron_festivals?.[0]?.celebration_dates || null)
    const festivalsText = computed(() => formatFestivalDays(festivalDates.value))
    const daysUntilFestival = computed(() => daysUntilFestival_(festivalDates.value))

    const displayUrl = (url) => {
      try {
        const u = new URL(url)
        return u.host.replace('www.', '')
      } catch (_) {
        return url
      }
    }

    // Bandera y escudo desde el manifest (código INE → URL), sin probar nombres de fichero
    const townEmblems = computed(() => {
      const ine = props.townName?.id?.split('_')[0]
      return (ine && emblems.value[ine]) || {}
    })
    // Miniatura ligera si existe (los SVG originales llegan a pesar 3 MB)
    const townFlag = computed(() => emblemSrc(townEmblems.value.bandera))
    const townShield = computed(() => emblemSrc(townEmblems.value.escudo))
    const shieldLoaded = ref(false)
    watch(townShield, () => { shieldLoaded.value = false })
    // Autor y licencia de las imágenes que se están mostrando
    const emblemCredits = computed(() => {
      const out = []
      const add = (tipo, e, visible) => {
        if (e && visible && (e.autor || e.licencia)) out.push({ tipo, ...e })
      }
      add('Bandera', townEmblems.value.bandera, flagExists.value)
      add('Escudo', townEmblems.value.escudo, shieldExists.value)
      return out
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

    const onFlagError = () => { flagExists.value = false }
    const onShieldError = () => { shieldExists.value = false }

    // Computed para eventos ordenados por fecha
    const sortedEvents = computed(() => {
      if (!props.events || props.events.length === 0) return []
      
      return [...props.events].sort((a, b) => {
        const dateA = a.date || a.fecha_inicio || a.fecha || ''
        const dateB = b.date || b.fecha_inicio || b.fecha || ''
        
        if (!dateA) return 1
        if (!dateB) return -1
        
        return new Date(dateA) - new Date(dateB)
      })
    })

    // Funciones para colapsar/expandir secciones
    const toggleEventsSection = () => {
      eventsExpanded.value = !eventsExpanded.value
    }

    const togglePOISection = () => {
      poisExpanded.value = !poisExpanded.value
    }

    return {
      isLoading,
      townName: toRef(props, 'townName'),
      townInfo: toRef(props, 'townInfo'),
      municipioData,
      sortedEvents,
      events: toRef(props, 'events'),
      pointsOfInterest: toRef(props, 'pointsOfInterest'),
      townFlag,
      townShield,
      emblemCredits,
      townEmblems,
      shieldLoaded,
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
      // Town shape
      townShape,
      townShapeViewBox,
      loadSalamancaSvg,
      extractTownShape,
      // POI Dialog
      poiDialogOpen,
      selectedPOI,
      openPOIDialog,
      closePOIDialog,
      handleAddPOIToRoute,
      // Collapsible sections
      eventsExpanded,
      poisExpanded,
      toggleEventsSection,
      togglePOISection,
      // Municipal info computed properties
      municipalEmail,
      municipalPhone,
      municipalWebsite,
      festivalsText,
      daysUntilFestival,
      // Historia
      historia,
      historyExpanded,
      historyFull,
      visibleHistoria,
      // Helper functions
      displayUrl
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
/* Móvil: la ficha es una hoja inferior y deja el mapa visible arriba */
@media (max-width: 767px) {
  #sidebar {
    width: 100vw;
    right: 0;
    top: auto;
    bottom: 0;
    height: 62vh;
    border-radius: 16px 16px 0 0;
    transform: translateY(100%);
    z-index: 9999;
  }

  #sidebar.open {
    right: 0;
    transform: translateY(0);
  }

  .sidebar-header {
    padding: 18px 20px 12px;
  }

  /* Asa de la hoja */
  .sidebar-header::before {
    content: "";
    position: absolute;
    top: 6px;
    left: 50%;
    width: 40px;
    height: 4px;
    margin-left: -20px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.6);
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
  flex: 1.5; /* Hacer el contenedor más grande */
  min-height: 180px; /* Aumentar la altura */
  background: var(--bg-tertiary);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--border-primary);
  position: relative;
  overflow: hidden;
  padding: 0; /* Sin padding interno */
}

/* Side elements (flags and shields) */
.side-element {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 90px; /* Volver al tamaño original */
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

/* Nuevos estilos para el SVG del municipio */
.town-shape-svg {
  width: 100%;
  height: 100%;
  padding: 5px; /* Padding que funcionaba */
  display: block;
  margin: auto;
}

.town-path {
  transition: all 0.3s ease;
  cursor: pointer;
  transform-origin: center center;
}

.town-path:hover {
  filter: brightness(1.1) drop-shadow(4px 4px 8px rgba(0,0,0,0.4)) !important;
  transform: scale(1.02); /* Pequeño efecto de hover */
}

.no-shape {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 120px; /* Volver al tamaño original */
}

.shape-icon {
  font-size: 48px; /* Volver al tamaño original */
  margin-bottom: 8px; /* Volver al margen original */
  opacity: 0.6;
}

.shape-text {
  color: var(--primary-color);
  font-weight: 600;
  font-size: 14px; /* Volver al tamaño original */
  text-align: center;
  margin: 8px 0 0 0; /* Volver al margen original */
}

/* Flags and shields - now integrated in the map section */
/* La bandera ondeando ocupa algo más que el escudo */
#town-flag {
  width: 104px;
  flex-shrink: 0;
}

/* El escudo aparece con un fundido cuando ha cargado */
#town-shield img.emblem-img {
  opacity: 0;
  transition: opacity 0.25s ease, transform 0.2s ease;
}

#town-shield img.emblem-img.loaded {
  opacity: 1;
}

#town-shield img {
  width: 80px; /* Volver al tamaño original */
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
  width: 80px; /* Volver al tamaño original */
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px; /* Volver al tamaño original */
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
  /* Bandera, silueta y escudo en una fila compacta */
  #town-map-section {
    gap: 8px;
    padding: 8px;
    margin-bottom: 12px;
  }

  .side-element {
    min-width: unset;
  }

  #town-shape {
    min-height: 90px;
    height: 90px;
  }

  #town-flag {
    width: 72px;
  }

  #town-shield img {
    width: 56px;
    height: 56px;
  }

  .placeholder-element {
    width: 56px;
    height: 56px;
    font-size: 28px;
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

/* Cabeceras colapsables */
/* Créditos de bandera y escudo */
.emblem-credits {
  font-size: 0.7rem;
  line-height: 1.4;
  color: var(--text-muted);
  margin: -6px 4px 14px;
  text-align: center;
}

.emblem-credit::after {
  content: " · ";
}

.emblem-credits a {
  color: inherit;
  text-decoration: underline;
}

.emblem-credits a[rel~="license"] {
  white-space: nowrap;
}

/* Historia */
.history-text p {
  font-size: 0.9rem;
  line-height: 1.5;
  margin-bottom: 0.6rem;
  text-align: justify;
}

.history-more {
  padding: 0;
  margin-bottom: 0.5rem;
}

.history-source {
  font-size: 0.75rem !important;
  opacity: 0.75;
}

.collapsible-header {
  cursor: pointer;
  user-select: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
}

.collapsible-header:hover {
  background: var(--hover-bg);
  padding-left: 5px;
  border-radius: 4px;
}

.section-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.count-badge {
  background: var(--primary-color);
  color: white;
  font-size: 0.75em;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 12px;
  min-width: 24px;
  text-align: center;
}

.toggle-icon {
  font-size: 0.8em;
  color: var(--text-muted);
  transition: transform 0.2s ease;
}

h3::before {
  font-size: 1.2em;
}

#info-content h3::before {
  content: "ℹ️";
}

#history-container h3::before {
  content: "📜";
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
  /* Override global.css - prevent entire div from spinning */
  animation: none !important;
  transition: none !important;
  transform: none !important;
}

.loading * {
  /* Disable transitions for all loading children except spinner */
  transition: none !important;
  transform: none !important;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-light);
  border-top: 2px solid var(--primary-color);
  border-radius: 50%;
  /* Only the spinner should spin */
  animation: spin 1s linear infinite !important;
  flex-shrink: 0;
  transform: rotate(0deg) !important; /* Reset initial transform */
}

.loading-text {
  /* Explicitly prevent text rotation */
  color: var(--text-secondary);
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

/* Festival countdown styles */
.festival-countdown {
  margin-top: 0.5rem;
  font-weight: 500;
}

.countdown-today {
  color: #ff6b6b;
  font-weight: bold;
  font-size: 1.1em;
  animation: pulse 1.5s ease-in-out infinite;
}

.countdown-soon {
  color: #ffa500;
  font-weight: 600;
}

.countdown-normal {
  color: var(--text-secondary);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
</style>