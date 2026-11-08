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
import { enableSvgPanZoom } from '@/composables/svgPanZoom'
import { watch } from 'vue'
import { useTheme } from '@/composables/useTheme'

export default {
  name: 'InteractiveMap',
  props: {
    tierraSaborActivo: {
      type: Boolean,
      default: false
    },
    teatroResults: {
      type: Array,
      default: () => []
    },
    showTooltips: {
      type: Boolean,
      default: true
    },
    libraryMunicipiosPhysical: {
      type: Array,
      default: () => []
    },
    libraryMunicipiosMobile: {
      type: Array,
      default: () => []
    },
    libraryDetails: {
      type: Object,
      default: () => ({})
    },
    bibliobusRoutes: {
      type: Array,
      default: () => []
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
    let libraryMarkerLayer = null
    const libraryMarkersMap = new Map()
    let routeLinesLayer = null
    const routeColorsMap = new Map() // Para asignar colores únicos a cada ruta

    // Función para obtener colores del tema actual
    const getThemeColors = () => {
      const root = document.documentElement
      const computedStyle = getComputedStyle(root)
      return {
        base: computedStyle.getPropertyValue('--border-secondary').trim() || '#dee2e6',
        selected: computedStyle.getPropertyValue('--primary-color').trim() || '#4CAF50',
        tierraSabor: '#ffd700', // Amarillo para Tierra de Sabor
        teatro: '#9c27b0' // Púrpura para Teatro
      }
    }

    // Colores para las rutas de bibliobús
    const getRouteColor = (routeName) => {
      if (!routeColorsMap.has(routeName)) {
        const colors = [
          '#FF6B6B', // Rojo
          '#4ECDC4', // Turquesa
          '#45B7D1', // Azul
          '#FFA07A', // Salmón
          '#98D8C8', // Menta
          '#F7DC6F', // Amarillo
          '#BB8FCE', // Púrpura
          '#85C1E2', // Celeste
          '#F8B88B', // Durazno
          '#A8D8EA'  // Azul claro
        ]
        const index = routeColorsMap.size % colors.length
        routeColorsMap.set(routeName, colors[index])
      }
      return routeColorsMap.get(routeName)
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

    watch(() => props.tierraSaborActivo, async (nuevoValor) => {
      if (nuevoValor) {
        await pintarTierraSabor()
      } else {
        limpiarTierraSabor()
      }
    })

    // Watcher para teatro results
    watch(() => props.teatroResults, async (newValue) => {
      // Limpiar primero
      limpiarTeatro()
      
      // Si hay resultados de teatro, pintar municipios
      if (newValue && newValue.length > 0) {
        await pintarTeatro()
      }
    }, { deep: true })

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

        // Establecer en store y emitir evento (App.vue carga info, eventos y POIs)
        townStore.setSelectedTown(townData)
        emit('townSelected', townData)
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
      // Zoom con pellizco/rueda y desplazamiento (para poder tocar los municipios pequeños)
      enableSvgPanZoom(svgDoc.querySelector('svg'))

      // Preparar capa para marcadores de bibliotecas
      libraryMarkerLayer = svgDoc.getElementById('library-markers')
      if (!libraryMarkerLayer) {
        libraryMarkerLayer = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'g')
        libraryMarkerLayer.setAttribute('id', 'library-markers')
        const svgRoot = svgDoc.querySelector('svg')
        if (svgRoot) svgRoot.appendChild(libraryMarkerLayer)
      }

      // Preparar capa para líneas de rutas de bibliobús
      routeLinesLayer = svgDoc.getElementById('route-lines')
      if (!routeLinesLayer) {
        routeLinesLayer = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'g')
        routeLinesLayer.setAttribute('id', 'route-lines')
        const svgRoot = svgDoc.querySelector('svg')
        if (svgRoot) {
          // Insertar antes que los marcadores para que queden atrás
          svgRoot.insertBefore(routeLinesLayer, svgRoot.firstChild)
        }
      }

      // Si ya tenemos municipios a marcar al cargar, dibujarlos
      if ((props.libraryMunicipiosPhysical && props.libraryMunicipiosPhysical.length > 0) ||
          (props.libraryMunicipiosMobile && props.libraryMunicipiosMobile.length > 0)) {
        dibujarMarcadoresBibliotecas(props.libraryMunicipiosPhysical, props.libraryMunicipiosMobile)
      }

      // Dibujar líneas de rutas si hay
      if (props.bibliobusRoutes && props.bibliobusRoutes.length > 0) {
        dibujarLineasRutas(props.bibliobusRoutes)
      }
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

    // --- TEATRO LOGIC ---
    const teatroMunicipios = ref(new Set())

    // Método para pintar municipios con teatro
    const pintarTeatro = async () => {
      if (!svgDoc) return
      if (!props.teatroResults || props.teatroResults.length === 0) return
      
      console.log('🎭 Pintando municipios con teatro:', props.teatroResults.length)
      
      // Extraer códigos postales únicos de eventos de teatro
      const codigosPostales = [...new Set(props.teatroResults.map(evento => evento.cp).filter(cp => cp))]
      console.log('Códigos postales de teatro:', codigosPostales)
      
      // Convertir códigos postales a códigos INE de municipio
      const codigosINE = []
      for (const cp of codigosPostales) {
        try {
          const codigoINE = await apiService.getCodigoINEFromCodigoPostal(cp)
          if (codigoINE) {
            codigosINE.push(codigoINE)
            teatroMunicipios.value.add(codigoINE)
          }
        } catch (error) {
          console.error(`Error convirtiendo código postal ${cp} a INE:`, error)
        }
      }
      
      console.log('Códigos INE de teatro:', codigosINE)
      const colors = getThemeColors()
      
      // Pintar los municipios en el mapa
      codigosINE.forEach(codigoINE => {
        const el = svgDoc.getElementById(codigoINE)
        if (el) {
          el.style.fill = colors.teatro
        } else {
          console.warn(`No se encontró elemento SVG para código INE: ${codigoINE}`)
        }
      })
    }

    // Método para limpiar teatro
    const limpiarTeatro = () => {
      if (!svgDoc) return
      const colors = getThemeColors()
      teatroMunicipios.value.forEach(codigoINE => {
        const el = svgDoc.getElementById(codigoINE)
        if (el) {
          el.style.fill = colors.base
        }
      })
      teatroMunicipios.value.clear()
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
        
        // Solo resalta: App.vue ya ha abierto la ficha y cargado los datos
        console.log(`Municipio ${municipioId} resaltado desde búsqueda`)
      } else {
        console.warn(`No se encontró el municipio con ID: ${municipioId}`)
      }
    }

    // Manejar evento de resaltado desde búsqueda
    const handleHighlightMunicipio = (event) => {
      const { municipioId } = event.detail
      highlightMunicipio(municipioId)
    }

    // --- BIBLIOTECAS Y BIBLIOBUSES (MARCADORES) ---
    const limpiarMarcadoresBibliotecas = () => {
      if (!libraryMarkerLayer) return
      libraryMarkersMap.forEach(el => {
        try { libraryMarkerLayer.removeChild(el) } catch (e) {}
      })
      libraryMarkersMap.clear()
    }

    const limpiarLineasRutas = () => {
      if (!routeLinesLayer) return
      while (routeLinesLayer.firstChild) {
        routeLinesLayer.removeChild(routeLinesLayer.firstChild)
      }
      routeColorsMap.clear()
    }

    const dibujarLineasRutas = (routes) => {
      if (!svgDoc || !routeLinesLayer) return
      
      limpiarLineasRutas()
      
      routes.forEach(route => {
        if (!route.stops || route.stops.length < 2) return
        
        const color = getRouteColor(route.ruta)
        
        // Obtener centros de los municipios
        const centers = []
        route.stops.forEach(stop => {
          if (stop.cod_ine) {
            const base = getBaseCode(stop.cod_ine)
            const center = calcularCentroMunicipio(base)
            if (center) {
              centers.push({ ...center, cod_ine: stop.cod_ine })
            }
          }
        })
        
        // Dibujar líneas conectando los centros
        for (let i = 0; i < centers.length - 1; i++) {
          const line = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'line')
          line.setAttribute('x1', centers[i].x.toString())
          line.setAttribute('y1', centers[i].y.toString())
          line.setAttribute('x2', centers[i + 1].x.toString())
          line.setAttribute('y2', centers[i + 1].y.toString())
          line.setAttribute('stroke', color)
          line.setAttribute('stroke-width', '2.5')
          line.setAttribute('opacity', '0.7')
          line.setAttribute('stroke-linecap', 'round')
          line.setAttribute('class', `route-line route-${route.ruta}`)
          line.setAttribute('data-route', route.ruta)
          
          // Efecto hover
          line.addEventListener('mouseover', () => {
            line.setAttribute('stroke-width', '3.5')
            line.setAttribute('opacity', '1')
            // También resaltar otros segmentos de la misma ruta
            const sameRoute = routeLinesLayer.querySelectorAll(`[data-route="${route.ruta}"]`)
            sameRoute.forEach(el => {
              el.setAttribute('stroke-width', '3.5')
              el.setAttribute('opacity', '1')
            })
          })
          
          line.addEventListener('mouseout', () => {
            line.setAttribute('stroke-width', '2.5')
            line.setAttribute('opacity', '0.7')
            const sameRoute = routeLinesLayer.querySelectorAll(`[data-route="${route.ruta}"]`)
            sameRoute.forEach(el => {
              el.setAttribute('stroke-width', '2.5')
              el.setAttribute('opacity', '0.7')
            })
          })
          
          routeLinesLayer.appendChild(line)
        }
      })
    }

    const calcularCentroMunicipio = (baseCode) => {
      const territories = getRelatedTerritories(baseCode)
      if (!territories || territories.length === 0) return null
      // Unir BBoxes
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      territories.forEach(t => {
        const bb = t.getBBox()
        minX = Math.min(minX, bb.x)
        minY = Math.min(minY, bb.y)
        maxX = Math.max(maxX, bb.x + bb.width)
        maxY = Math.max(maxY, bb.y + bb.height)
      })
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      return { x: cx, y: cy }
    }

    const dibujarMarcadoresBibliotecas = (municipiosPhysical = [], municipiosMobile = []) => {
      if (!svgDoc) return
      // Asegurar capa
      if (!libraryMarkerLayer) {
        libraryMarkerLayer = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'g')
        libraryMarkerLayer.setAttribute('id', 'library-markers')
        const svgRoot = svgDoc.querySelector('svg')
        if (svgRoot) svgRoot.appendChild(libraryMarkerLayer)
      }

      limpiarMarcadoresBibliotecas()

      const drawIcon = (codIne, href, dx = 0, kind = 'physical') => {
        const base = getBaseCode(codIne)
        const center = calcularCentroMunicipio(base)
        if (!center) return
        const img = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image')
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href)
        const size = 18
        img.setAttribute('x', (center.x - size / 2 + dx).toString())
        img.setAttribute('y', (center.y - size).toString())
        img.setAttribute('width', size.toString())
        img.setAttribute('height', size.toString())
        img.setAttribute('opacity', '0.98')
        img.setAttribute('style', 'pointer-events:auto; cursor:pointer')
        img.addEventListener('click', (ev) => {
          // build tooltip content from libraryDetails
          const list = (props.libraryDetails && props.libraryDetails[codIne]) ? props.libraryDetails[codIne] : []
          const physCount = list.filter(i => !i.isMobile).length
          const mobCount = list.filter(i => i.isMobile).length
          const muniName = list[0]?.municipio || ''
          const top = list.slice(0, 5)
          const lines = []
          lines.push(`${muniName || codIne}`)
          lines.push(`Bibliotecas: ${physCount}  •  Bibliobuses: ${mobCount}`)
          if (top.length > 0) {
            lines.push('— Servicios:')
            top.forEach(s => {
              const t = s.isMobile ? 'Móvil' : 'Física'
              lines.push(`  • ${s.nombre} (${t})`)
            })
            if (list.length > top.length) {
              lines.push(`  • … y ${list.length - top.length} más`)
            }
          }
          // Añadir próxima visita de bibliobús si existe para este municipio
          try {
            const routes = Array.isArray(props.bibliobusRoutes) ? props.bibliobusRoutes : []
            // Buscar todas las paradas de este municipio en todas las rutas
            const allStopsForMuni = []
            routes.forEach(route => {
              if (route && route.stops && Array.isArray(route.stops)) {
                const muniStops = route.stops.filter(s => s && s.cod_ine === codIne)
                muniStops.forEach(s => {
                  allStopsForMuni.push({
                    ...s,
                    ruta: route.ruta
                  })
                })
              }
            })
            
            // Filtrar por las que tienen fecha y ordenar por fecha
            const nextStops = allStopsForMuni
              .filter(s => s.nextDate)
              .sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate))
            
            if (nextStops.length > 0) {
              const ns = nextStops[0]
              lines.push('— Próxima visita Bibliobús:')
              if (ns.dia) lines.push(`  📅 ${ns.dia}`)
              if (ns.hora) lines.push(`  ⏰ ${ns.hora}`)
              const locParts = []
              if (ns.localidad) locParts.push(ns.localidad)
              if (ns.lugar) locParts.push(ns.lugar)
              if (locParts.length > 0) lines.push(`  📍 ${locParts.join(' · ')}`)
              if (ns.ruta) lines.push(`  🚌 ${ns.ruta}`)
            }
          } catch (e) {
            // silenciar errores
            console.warn('Error procesando bibliobús para tooltip:', e)
          }
          const content = lines.join('\n')
          const x = ev.clientX + 10
          const y = ev.clientY - 10
          const tooltipEvent = new CustomEvent('showTooltip', { detail: { content, x, y } })
          window.dispatchEvent(tooltipEvent)
        })
        libraryMarkerLayer.appendChild(img)
        return img
      }

      const physicalSet = new Set(municipiosPhysical)
      const mobileSet = new Set(municipiosMobile)
      const union = new Set([...physicalSet, ...mobileSet])

      union.forEach(codIne => {
        if (physicalSet.has(codIne)) {
          const el = drawIcon(codIne, '/assets/icons/libro.png', -10, 'physical')
          if (el) libraryMarkersMap.set(`${codIne}-physical`, el)
        }
        if (mobileSet.has(codIne)) {
          const el = drawIcon(codIne, '/assets/icons/libreria-digital.png', +10, 'mobile')
          if (el) libraryMarkersMap.set(`${codIne}-mobile`, el)
        }
      })
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

    // Redibujar marcadores cuando cambie la lista
    watch(
      () => ({ phys: props.libraryMunicipiosPhysical, mob: props.libraryMunicipiosMobile }),
      (nuevo) => {
        const phys = nuevo?.phys || []
        const mob = nuevo?.mob || []
        if ((!phys || phys.length === 0) && (!mob || mob.length === 0)) {
          limpiarMarcadoresBibliotecas()
        } else {
          dibujarMarcadoresBibliotecas(phys, mob)
        }
      },
      { deep: true }
    )

    // Redibujar líneas de rutas cuando cambien
    watch(
      () => props.bibliobusRoutes,
      (newRoutes) => {
        if (!newRoutes || newRoutes.length === 0) {
          limpiarLineasRutas()
        } else {
          dibujarLineasRutas(newRoutes)
        }
      },
      { deep: true }
    )

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
  background-color: var(--bg-primary); /* Mismo color que el fondo general */
  transition: margin 0.3s ease, width 0.3s ease;
}

/* Responsive para móvil */
@media (max-width: 768px) {
  #map-container {
    width: 100% !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }
}

#mapa-salamanca {
  width: 100%;
  height: 100%;
  background-color: var(--bg-primary); /* Mismo color que el fondo general */
}

svg {
  background-color: var(--bg-primary); /* Mismo color que el fondo general */
}
</style>
