<template>
  <div id="map-container">
    <object 
      id="mapa-salamanca" 
      type="image/svg+xml" 
      :data="mapSvgPath"
      @load="handleMapLoad"
      ref="svgObject"
    ></object>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useTownStore } from '@/store/townStore'
import { apiService } from '@/services/apiService'
import { watch } from 'vue'
import { useTheme } from '@/composables/useTheme'

export default {
  name: 'InteractiveMap',
  props: {
    tierraSaborActivo: {
      type: Boolean,
      default: false
    },
    showTooltips: {
      type: Boolean,
      default: true
    }
  },
  emits: ['townSelected', 'townDeselected'],
  setup(props, { emit }) {
    const townStore = useTownStore()
    const { theme } = useTheme()
    const svgObject = ref(null)
    const mapSvgUrl = '/Limites_salamanca.svg'
    const mapSvgPath = ref(mapSvgUrl)
    
    let svgDoc = null
    let pueblos = null
    let selectedPueblo = null
    let relatedTerritories = new Set()

    // Función para obtener colores del tema actual
    const getThemeColors = () => {
      const root = document.documentElement
      const computedStyle = getComputedStyle(root)
      return {
        base: computedStyle.getPropertyValue('--border-secondary').trim() || '#dee2e6',
        selected: computedStyle.getPropertyValue('--primary-color').trim() || '#4CAF50',
        tierraSabor: '#ffd700' // Amarillo para Tierra de Sabor
      }
    }


    // Función para obtener el código base (sin barrabaja)
    const getBaseCode = (id) => id.split('_')[0]

    // Función para obtener todos los territorios relacionados
    const getRelatedTerritories = (baseCode) => {
      if (!pueblos) return []
      return Array.from(pueblos).filter(p => getBaseCode(p.id) === baseCode)
    }

    // Formatear nombre de pueblo
    const formatPuebloName = (name) => {
      return name
        .replace(/^#/, '') // Quitar el # del inicio
        .replace(/_/g, ' ') // Reemplazar guiones bajos con espacios
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
        .toUpperCase() // Convertir todo a mayúsculas
    }

    // Obtener información del pueblo
    const fetchTownInfo = async (townId) => {
      try {
        townStore.setLoading(true)
        const info = await apiService.getTownInfo(townId)
        townStore.setTownInfo(info)
      } catch (error) {
        console.error('Error fetching town info:', error)
      } finally {
        townStore.setLoading(false)
      }
    }

    watch(() => props.tierraSaborActivo, async (nuevoValor) => {
      if (nuevoValor) {
        await pintarTierraSabor()
      } else {
        limpiarTierraSabor()
      }
    })

    // Watcher para cambios de tema
    watch(() => theme.value, () => {
      updateMapColors()
    })

    // Función para actualizar colores del mapa cuando cambie el tema
    const updateMapColors = () => {
      if (!svgDoc || !pueblos) return
      
      const colors = getThemeColors()
      
      // Actualizar todos los municipios no seleccionados
      pueblos.forEach(pueblo => {
        if (!relatedTerritories.has(pueblo)) {
          pueblo.style.fill = colors.base
        }
      })
      
      // Mantener municipios seleccionados con color de selección
      relatedTerritories.forEach(territory => {
        territory.style.fill = colors.selected
      })
    }


    // Obtener eventos del pueblo
    const fetchTownEvents = async (townId) => {
      try {
        const events = await apiService.getTownEvents(townId)
        townStore.setTownEvents(events)
      } catch (error) {
        console.error('Error fetching town events:', error)
      }
    }

    // Obtener puntos de interés
    const fetchTownPoi = async (townId) => {
      try {
        const pois = await apiService.getTownPointsOfInterest(townId)
        townStore.setTownPointsOfInterest(pois)
      } catch (error) {
        console.error('Error fetching town POIs:', error)
      }
    }

    // Manejar hover sobre pueblo
    const handlePuebloHover = (pueblo, event) => {
      if (!props.showTooltips) return // No mostrar tooltip si están desactivados
      
      const label = pueblo.getAttribute("inkscape:label") || "Pueblo desconocido"
      console.log('Hover on pueblo:', formatPuebloName(label), 'at:', event.pageX, event.pageY) // Debug
      const tooltipEvent = new CustomEvent('showTooltip', {
        detail: {
          content: formatPuebloName(label),
          x: event.pageX + 10,
          y: event.pageY - 30
        }
      })
      window.dispatchEvent(tooltipEvent)
    }

    // Manejar salida de hover
    const handlePuebloMouseOut = (pueblo) => {
      if (!props.showTooltips) return // No ocultar tooltip si no se mostraron
      
      const hideTooltipEvent = new CustomEvent('hideTooltip')
      window.dispatchEvent(hideTooltipEvent)
    }

    // Manejar clic en pueblo
    const handlePuebloClick = async (pueblo) => {
      const label = pueblo.getAttribute("inkscape:label") || "Pueblo desconocido"
      const baseCode = getBaseCode(pueblo.id)
      const territories = getRelatedTerritories(baseCode)
      const colors = getThemeColors()

      if (selectedPueblo === pueblo) {
        // Deseleccionar - volver al color base del tema
        territories.forEach(t => {
          t.style.fill = colors.base
        })
        selectedPueblo = null
        relatedTerritories.clear()
        townStore.clearSelectedTown()
        emit('townDeselected')
      } else {
        // Restaurar color anterior si había algo seleccionado
        if (selectedPueblo) {
          const prevBaseCode = getBaseCode(selectedPueblo.id)
          getRelatedTerritories(prevBaseCode).forEach(t => {
            t.style.fill = colors.base
          })
        }

        // Seleccionar nuevos territorios - usar color de selección del tema
        territories.forEach(t => {
          t.style.fill = colors.selected
          relatedTerritories.add(t)
        })
        selectedPueblo = pueblo

        // Preparar datos del pueblo
        const townData = {
          id: baseCode,
          name: formatPuebloName(label).replace(/^#/, '').replace(/^./, c => c.toUpperCase()),
          element: pueblo
        }

        // Establecer en store y emitir evento
        townStore.setSelectedTown(townData)
        emit('townSelected', townData)

        // Obtener información adicional
        await Promise.all([
          fetchTownInfo(baseCode),
          fetchTownEvents(baseCode),
          fetchTownPoi(baseCode)
        ])
      }
    }

    // Configurar eventos del mapa
    const setupMapEvents = () => {
      if (!svgDoc) return

      pueblos = svgDoc.querySelectorAll("path")

      if (pueblos.length === 0) {
        console.error("No se encontraron elementos <path> en el SVG.")
        return
      }

      const colors = getThemeColors()

      pueblos.forEach(pueblo => {
        pueblo.style.fill = colors.base // Color base que se adapta al tema
        pueblo.style.cursor = 'pointer'

        pueblo.addEventListener("mouseover", (event) => {
          // Aplicar hover solo si no está seleccionado
          if (!relatedTerritories.has(pueblo)) {
            pueblo.style.fill = '#81C784' // Verde más claro para hover
          }
          handlePuebloHover(pueblo, event)
        })

        pueblo.addEventListener("mouseout", () => {
          // Restaurar color solo si no está seleccionado
          if (!relatedTerritories.has(pueblo)) {
            const currentColors = getThemeColors() // Obtener colores actuales del tema
            pueblo.style.fill = currentColors.base
          }
          handlePuebloMouseOut(pueblo)
        })

        pueblo.addEventListener("click", () => {
          handlePuebloClick(pueblo)
        })
      })
    }

    // Manejar carga del SVG
    const handleMapLoad = async () => {
      await nextTick()
      svgDoc = svgObject.value.contentDocument || svgObject.value.getSVGDocument()
      
      if (!svgDoc) {
        console.error("No se pudo cargar el contenido del SVG.")
        return
      }

      setupMapEvents()
    }

    // Método público para deseleccionar pueblo
    const deselectTown = () => {
      if (selectedPueblo) {
        const baseCode = getBaseCode(selectedPueblo.id)
        const colors = getThemeColors()
        getRelatedTerritories(baseCode).forEach(t => {
          t.style.fill = colors.base
        })
        selectedPueblo = null
        relatedTerritories.clear()
        townStore.clearSelectedTown()
      }
      // Aquí deberías repintar según la lógica de filtro recibida por props o store, no desde aquí
    }

    // --- TIERRA DE SABOR LOGIC ---
    let tierraSaborIds = []

    // Método para pintar Tierra de Sabor
    const pintarTierraSabor = async () => {
      if (!svgDoc) return
      if (tierraSaborIds.length === 0) {
        tierraSaborIds = await apiService.getTierraSaborIds()
      }
      console.log('Códigos postales de Tierra de Sabor:', tierraSaborIds)
      
      // Convertir códigos postales a códigos INE de municipio
      const codigosINE = []
      for (const tienda of tierraSaborIds) {
        try {
          const codigoINE = await apiService.getCodigoINEFromCodigoPostal(tienda.c_p)
          if (codigoINE) {
            codigosINE.push(codigoINE)
          }
        } catch (error) {
          console.error(`Error convirtiendo código postal ${tienda.c_p} a INE:`, error)
        }
      }
      
      console.log('Códigos INE obtenidos:', codigosINE)
      const colors = getThemeColors()
      
      // Pintar los municipios en el mapa
      codigosINE.forEach(codigoINE => {
        const el = svgDoc.getElementById(codigoINE)
        if (el) {
          el.style.fill = colors.tierraSabor
        } else {
          console.warn(`No se encontró elemento SVG para código INE: ${codigoINE}`)
        }
      })
    }

    // Método para limpiar Tierra de Sabor
    const limpiarTierraSabor = () => {
      if (!svgDoc) return
      const colors = getThemeColors()
      tierraSaborIds.forEach(id => {
        const el = svgDoc.getElementById(id)
        if (el) {
          el.style.fill = colors.base
        }
      })
    }

    // Función para limpiar pueblos seleccionados
    const clearSelectedTowns = () => {
      if (selectedPueblo) {
        const colors = getThemeColors()
        relatedTerritories.forEach(territory => {
          territory.style.fill = colors.base
        })
        selectedPueblo = null
        relatedTerritories.clear()
        townStore.clearSelectedTown()
        emit('townDeselected')
      }
    }

    // Listener para cambios de tema
    const handleThemeChange = () => {
      clearSelectedTowns()
      updateMapColors()
    }

    // Exponer métodos para uso externo
    window.mapDeselectTown = deselectTown

    // Función para resaltar municipio específico
    const highlightMunicipio = (municipioId) => {
      if (!svgDoc || !pueblos) return
      
      // Buscar el municipio por ID
      const municipio = Array.from(pueblos).find(pueblo => 
        pueblo.id === municipioId || 
        pueblo.id === `path${municipioId}` ||
        pueblo.getAttribute('inkscape:label')?.includes(municipioId)
      )
      
      if (municipio) {
        // Limpiar selecciones anteriores
        if (selectedPueblo) {
          selectedPueblo.style.fill = getThemeColors().base
        }
        
        // Seleccionar el nuevo municipio
        selectedPueblo = municipio
        municipio.style.fill = getThemeColors().selected
        
        // Simular clic para abrir el sidebar
        const name = formatPuebloName(municipio.getAttribute("inkscape:label") || "Pueblo desconocido")
        const townData = { 
          id: municipioId, 
          name: name
        }
        emit('townSelected', townData)
        
        console.log(`Municipio ${name} resaltado desde búsqueda`)
      } else {
        console.warn(`No se encontró el municipio con ID: ${municipioId}`)
      }
    }

    // Manejar evento de resaltado desde búsqueda
    const handleHighlightMunicipio = (event) => {
      const { municipioId } = event.detail
      highlightMunicipio(municipioId)
    }

    // Configurar listeners
    onMounted(() => {
      window.addEventListener('themeChanged', handleThemeChange)
      window.addEventListener('highlightMunicipio', handleHighlightMunicipio)
    })

    onUnmounted(() => {
      window.removeEventListener('themeChanged', handleThemeChange)
      window.removeEventListener('highlightMunicipio', handleHighlightMunicipio)
    })

    return {
      svgObject,
      mapSvgPath,
      handleMapLoad,
      deselectTown
    }
  }
}
</script>

<style scoped>
#map-container {
  width: calc(100% - 690px); /* 320px para FilterSidebar + 370px para TownSidebar */
  height: 100vh;
  position: relative;
  margin-left: 320px; /* Espacio para FilterSidebar */
  margin-right: 370px; /* Espacio para TownSidebar cuando esté abierto */
}

#mapa-salamanca {
  width: 100%;
  height: 100%;
  background-color: var(--bg-secondary);
}

svg {
  background-color: var(--bg-primary);
}
</style>
