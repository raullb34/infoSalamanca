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
import { ref, onMounted, nextTick } from 'vue'
import { useTownStore } from '@/store/townStore'
import { apiService } from '@/services/apiService'
import { watch } from 'vue'

export default {
  name: 'InteractiveMap',
  props: {
    tierraSaborActivo: {
      type: Boolean,
      default: false
    }
  },
  emits: ['townSelected', 'townDeselected'],
  setup(props, { emit }) {
    const townStore = useTownStore()
    const svgObject = ref(null)
    const mapSvgUrl = '/Limites_salamanca.svg'
    const mapSvgPath = ref(mapSvgUrl)
    
    let svgDoc = null
    let pueblos = null
    let selectedPueblo = null
    let relatedTerritories = new Set()


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
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
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
    // --- Evitar despintar Tierra de Sabor en hover si el filtro está activo ---

    const handlePuebloHover = (pueblo, event) => {
      // ...existing code...
      const label = pueblo.getAttribute("inkscape:label") || "Pueblo desconocido"
      const tooltipEvent = new CustomEvent('showTooltip', {
        detail: {
          content: formatPuebloName(label),
          x: event.pageX,
          y: event.pageY - 30
        }
      })
      window.dispatchEvent(tooltipEvent)
    }

    // Manejar salida de hover
    const handlePuebloMouseOut = (pueblo) => {
      // ...existing code...
      const hideTooltipEvent = new CustomEvent('hideTooltip')
      window.dispatchEvent(hideTooltipEvent)
    }

    // Manejar clic en pueblo
    const handlePuebloClick = async (pueblo) => {
      const label = pueblo.getAttribute("inkscape:label") || "Pueblo desconocido"
      const baseCode = getBaseCode(pueblo.id)
      const territories = getRelatedTerritories(baseCode)

      if (selectedPueblo === pueblo) {
        // Deseleccionar
        territories.forEach(t => {
          t.style.fill = "#cccccc"
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
            t.style.fill = "#cccccc"
          })
        }

        // Seleccionar nuevos territorios
        territories.forEach(t => {
          t.style.fill = "#ff6600"
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

      pueblos.forEach(pueblo => {
        pueblo.style.fill = "#cccccc" // Color base

        pueblo.addEventListener("mouseover", (event) => {
          handlePuebloHover(pueblo, event)
        })

        pueblo.addEventListener("mouseout", () => {
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
        getRelatedTerritories(baseCode).forEach(t => {
          t.style.fill = "#cccccc"
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
      
      // Pintar los municipios en el mapa
      codigosINE.forEach(codigoINE => {
        const el = svgDoc.getElementById(codigoINE)
        if (el) {
          el.style.fill = 'yellow'
        } else {
          console.warn(`No se encontró elemento SVG para código INE: ${codigoINE}`)
        }
      })
    }

    // Método para limpiar Tierra de Sabor
    const limpiarTierraSabor = () => {
      if (!svgDoc) return
      tierraSaborIds.forEach(id => {
        const el = svgDoc.getElementById(id)
        if (el) {
          el.style.fill = '#cccccc'
        }
      })
    }

    // Exponer métodos para uso externo
    window.mapDeselectTown = deselectTown

    // onMounted: ya no se hace fetch aquí
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
  width: calc(100% - 640px); /* 300px para RouteSidebar + 340px para FilterSidebar */
  height: 100vh;
  position: relative;
  margin-left: 340px; /* Espacio para FilterSidebar */
  margin-right: 300px; /* Espacio para TownSidebar cuando esté abierto */
}

#mapa-salamanca {
  width: 100%;
  height: 100%;
  background-color: #f5f5f5;
}

svg {
  background-color: #ffffff;
}
</style>
