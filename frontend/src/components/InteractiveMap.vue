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
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useTownStore } from '@/store/townStore'
import { apiService } from '@/services/apiService'
import { enableSvgPanZoom, ROUTE_STOP_R, NEXT_STOP_SCALE } from '@/composables/svgPanZoom'
import { mergeBibliobusRoutes, loadComarcas } from '@/utils/bibliobusRoutes'
import { preloadEmblems } from '@/services/emblems'
import { watch } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { weatherApi, fitAffine, NETWORKS, tempBin, isRecent, fmtTemp, ago } from '@/utils/weather'

export default {
  name: 'InteractiveMap',
  props: {
    // { '37274': '#9c27b0', ... }: municipios que colorea el filtro activo (los calcula App.vue)
    highlights: {
      type: Object,
      default: () => ({})
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
    },
    // Estaciones meteorológicas a pintar (GET /api/v1/weather/stations?latest=true)
    weatherStations: {
      type: Array,
      default: () => []
    },
    // Ruta cultural abierta (utils/rutasCulturales): su trazado y sus paradas numeradas
    culturalRoute: {
      type: Object,
      default: null
    }
  },
  emits: ['townSelected', 'townDeselected', 'stationSelected'],
  setup(props, { emit }) {
    const townStore = useTownStore()
    const { theme } = useTheme()
    const svgObject = ref(null)
    const mapSvgUrl = '/Limites_salamanca.svg'
    const mapSvgPath = ref(mapSvgUrl)
    
    let svgDoc = null
    let panZoom = null // zoom/desplazamiento del SVG (botones [+] [−] [⟲])
    const zoomIn = () => panZoom?.zoomBy(1 / 1.4)
    const zoomOut = () => panZoom?.zoomBy(1.4)
    const resetView = () => panZoom?.reset()
    let pueblos = null
    let selectedPueblo = null
    let relatedTerritories = new Set()
    let libraryMarkerLayer = null
    const libraryMarkersMap = new Map()
    let routeLinesLayer = null

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

    // Repintar cuando cambian los municipios del filtro
    watch(() => props.highlights, () => repaintAll())

    // Watcher para cambios de tema
    watch(() => theme.value, () => {
      updateMapColors()
    })

    // Color "de reposo" de cada municipio: seleccionado > color del filtro activo > base del tema.
    // El hover vuelve siempre a este color, así no se borra el filtro al pasar el ratón.
    const fillFor = (pueblo, colors = getThemeColors()) => {
      if (relatedTerritories.has(pueblo)) return colors.selected
      return props.highlights[getBaseCode(pueblo.id)] || colors.base
    }
    const repaintAll = () => {
      if (!svgDoc || !pueblos) return
      const colors = getThemeColors()
      pueblos.forEach(pueblo => { pueblo.style.fill = fillFor(pueblo, colors) })
    }
    // Al cambiar de tema
    const updateMapColors = repaintAll


    // Manejar hover sobre pueblo
    const handlePuebloHover = (pueblo, event) => {
      if (!props.showTooltips) return // No mostrar tooltip si están desactivados
      
      const label = pueblo.getAttribute("inkscape:label") || "Pueblo desconocido"
      // El mapa está en un <object>: sus coordenadas se pasan a las de la ventana
      const { x, y } = toWindowXY(event)
      const tooltipEvent = new CustomEvent('showTooltip', {
        detail: { content: formatPuebloName(label), x: x + 12, y: y - 32 }
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
      // Pulsar un municipio cierra la tarjeta de biblioteca/bibliobús
      window.dispatchEvent(new CustomEvent('hideTooltip', { detail: { card: true } }))
      const label = pueblo.getAttribute("inkscape:label") || "Pueblo desconocido"
      const baseCode = getBaseCode(pueblo.id)
      const territories = getRelatedTerritories(baseCode)
      const colors = getThemeColors()

      if (selectedPueblo === pueblo) {
        // Deseleccionar: vuelve a su color de filtro o al base
        selectedPueblo = null
        relatedTerritories.clear()
        repaintAll()
        townStore.clearSelectedTown()
        emit('townDeselected')
      } else {
        // Seleccionar el municipio (con sus enclaves)
        relatedTerritories.clear()
        territories.forEach(t => relatedTerritories.add(t))
        selectedPueblo = pueblo
        repaintAll()

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
        pueblo.style.fill = fillFor(pueblo, colors)
        pueblo.style.cursor = 'pointer'

        pueblo.addEventListener("mouseover", (event) => {
          // Aplicar hover solo si no está seleccionado
          if (!relatedTerritories.has(pueblo)) {
            pueblo.style.fill = '#81C784' // Verde más claro para hover
          }
          handlePuebloHover(pueblo, event)
          preloadEmblems(getBaseCode(pueblo.id)) // bandera y escudo listos para cuando haga clic
        })

        pueblo.addEventListener("mouseout", () => {
          // Volver a su color de reposo (seleccionado, filtro o base)
          pueblo.style.fill = fillFor(pueblo)
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
      // El SVG sigue al tamaño del contenedor (p. ej. cuando la ficha móvil ocupa la parte de abajo)
      const svgRoot = svgDoc.querySelector('svg')
      svgRoot.setAttribute('width', '100%')
      svgRoot.setAttribute('height', '100%')
      // Zoom con pellizco/rueda y desplazamiento (para poder tocar los municipios pequeños)
      panZoom = enableSvgPanZoom(svgRoot)

      // Capas encima de los municipios: primero las rutas del bibliobús y encima los marcadores
      // (antes las rutas iban al principio del SVG y los municipios las tapaban)
      routeLinesLayer = svgDoc.getElementById('route-lines')
      if (!routeLinesLayer) {
        routeLinesLayer = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'g')
        routeLinesLayer.setAttribute('id', 'route-lines')
        svgRoot.appendChild(routeLinesLayer)
      }
      libraryMarkerLayer = svgDoc.getElementById('library-markers')
      if (!libraryMarkerLayer) {
        libraryMarkerLayer = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'g')
        libraryMarkerLayer.setAttribute('id', 'library-markers')
        svgRoot.appendChild(libraryMarkerLayer)
      }

      if (props.weatherStations.length) dibujarEstaciones()
      if (props.culturalRoute) dibujarRutaCultural()

      // Si ya tenemos municipios a marcar al cargar, dibujarlos
      if ((props.libraryMunicipiosPhysical && props.libraryMunicipiosPhysical.length > 0) ||
          (props.libraryMunicipiosMobile && props.libraryMunicipiosMobile.length > 0)) {
        dibujarMarcadoresBibliotecas(props.libraryMunicipiosPhysical, props.libraryMunicipiosMobile)
      }

      // Dibujar líneas de rutas si hay
      if (mergedRoutes.value.length) dibujarLineasRutas()
    }

    // Método público para deseleccionar pueblo
    const deselectTown = () => {
      if (selectedPueblo) {
        selectedPueblo = null
        relatedTerritories.clear()
        repaintAll()
        townStore.clearSelectedTown()
      }
      // Aquí deberías repintar según la lógica de filtro recibida por props o store, no desde aquí
    }

    // Función para limpiar pueblos seleccionados
    const clearSelectedTowns = () => {
      if (selectedPueblo) {
        selectedPueblo = null
        relatedTerritories.clear()
        repaintAll()
        townStore.clearSelectedTown()
        emit('townDeselected')
      }
    }

    // Listener para cambios de tema
    const handleThemeChange = () => {
      // Solo repintar: cambiar de tema no debe cerrar la ficha
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
        // Seleccionar el municipio y sus enclaves
        selectedPueblo = municipio
        relatedTerritories.clear()
        getRelatedTerritories(getBaseCode(municipio.id)).forEach(t => relatedTerritories.add(t))
        repaintAll()
        
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

    // --- BIBLIOTECAS Y BIBLIOBUSES ---
    const SVG_NS = 'http://www.w3.org/2000/svg'

    // Coordenadas de un evento dentro del mapa (que está en un <object>) → coordenadas de la ventana
    const toWindowXY = (ev) => {
      const r = svgObject.value?.getBoundingClientRect() || { left: 0, top: 0 }
      return { x: r.left + ev.clientX, y: r.top + ev.clientY }
    }

    // Rutas sin duplicados y con su color (el mismo que en la lista del panel izquierdo)
    const comarcas = ref({})
    loadComarcas().then(data => { comarcas.value = data })
    const mergedRoutes = computed(() => mergeBibliobusRoutes(props.bibliobusRoutes || [], comarcas.value))

    const limpiarMarcadoresBibliotecas = () => {
      if (!libraryMarkerLayer) return
      libraryMarkersMap.forEach(el => {
        try { libraryMarkerLayer.removeChild(el) } catch (e) {}
      })
      libraryMarkersMap.clear()
    }

    const limpiarLineasRutas = () => {
      if (!routeLinesLayer) return
      routeLinesLayer.replaceChildren()
    }

    const calcularCentroMunicipio = (baseCode) => {
      const territories = getRelatedTerritories(baseCode)
      if (!territories || territories.length === 0) return null
      // Centro del trozo más grande: los enclaves no deben desplazarlo
      let best = null
      territories.forEach(t => {
        const bb = t.getBBox()
        if (!best || bb.width * bb.height > best.width * best.height) best = bb
      })
      return { x: best.x + best.width / 2, y: best.y + best.height / 2 }
    }

    // "30/11/2026 (lunes)" → "lunes 30/11"
    const shortDay = (dia) => {
      const m = String(dia || '').match(/(\d{2})\/(\d{2})\/\d{4}\s*\(([^)]+)\)/)
      return m ? `${m[3]} ${m[1]}/${m[2]}` : dia || ''
    }
    const cleanHour = (h) => String(h || '').replace(/\s*\n\s*/g, ' · ').trim()

    // Tarjeta con las bibliotecas del municipio y las visitas del bibliobús
    const buildTownCard = (codIne) => {
      const libs = props.libraryDetails?.[codIne] || []
      const sections = []
      const physical = libs.filter(l => !l.isMobile)
      const mobile = libs.filter(l => l.isMobile)
      if (physical.length) {
        sections.push({
          heading: physical.length === 1 ? 'Biblioteca' : `Bibliotecas (${physical.length})`,
          items: physical.map(l => ({ icon: '📚', title: l.nombre, href: l.enlace, lines: l.direccion ? [l.direccion] : [] }))
        })
      }
      if (mobile.length) {
        sections.push({
          heading: 'Sede de los bibliobuses',
          items: mobile.map(l => ({ icon: '🚌', title: l.nombre, href: l.enlace }))
        })
      }
      // Rutas que paran aquí, con la próxima visita de cada una
      const visits = []
      const since = Date.now() - 86400000
      for (const route of mergedRoutes.value) {
        const stops = route.stops.filter(s => String(s.cod_ine) === String(codIne))
        if (!stops.length) continue
        const next = stops.find(s => s.nextDate && new Date(s.nextDate).getTime() >= since) || stops[0]
        const lines = []
        if (next?.dia) lines.push(`Próxima visita: ${shortDay(next.dia)}${next.hora ? ` · ${cleanHour(next.hora)}` : ''}`)
        const place = [next?.localidad && next.localidad !== next.municipio ? next.localidad : null, next?.lugar].filter(Boolean).join(' · ')
        if (place) lines.push(`📍 ${place}`)
        lines.push([route.label, `${route.stopsCount} ${route.stopsCount === 1 ? 'parada' : 'paradas'}`].filter(Boolean).join(' · '))
        visits.push({
          color: route.color,
          title: route.title,
          lines,
          note: next?.incidencias || null,
          time: next?.nextDate ? new Date(next.nextDate).getTime() : Infinity
        })
      }
      visits.sort((a, b) => a.time - b.time)
      if (visits.length) sections.push({ heading: visits.length === 1 ? 'Bibliobús' : `Bibliobús · ${visits.length} rutas`, items: visits })

      const name = libs[0]?.municipio ||
        mergedRoutes.value.flatMap(r => r.stops).find(s => String(s.cod_ine) === String(codIne))?.municipio ||
        formatPuebloName(getRelatedTerritories(String(codIne))[0]?.getAttribute('inkscape:label') || String(codIne))
      return { title: name, sections }
    }

    const openTownCard = (codIne, ev) => {
      const card = buildTownCard(codIne)
      if (!card.sections.length) return
      const { x, y } = toWindowXY(ev)
      window.dispatchEvent(new CustomEvent('showTooltip', { detail: { card, x, y } }))
    }

    // Resaltar una ruta (al pasar el ratón o al abrirla en la lista) y atenuar las demás
    let highlightedRoute = null
    let listRoute = null // la abierta en la lista del panel izquierdo
    const highlightRoute = (key) => {
      highlightedRoute = key
      if (!routeLinesLayer) return
      routeLinesLayer.classList.toggle('has-highlight', !!key)
      // Con una ruta resaltada, los iconos de biblioteca se atenúan para que se vean sus paradas
      if (libraryMarkerLayer) libraryMarkerLayer.style.opacity = key ? '0.35' : ''
      routeLinesLayer.querySelectorAll('g[data-route]').forEach(g => {
        g.classList.toggle('highlighted', g.getAttribute('data-route') === key)
      })
    }
    const selectRouteInList = (ruta) => {
      window.dispatchEvent(new CustomEvent('selectRoute', { detail: { ruta } }))
    }
    const handleListRoute = (event) => {
      listRoute = event.detail?.ruta || null
      highlightRoute(listRoute)
      // Al abrir una ruta en la lista, el mapa se va a ella
      if (listRoute && event.detail?.focus && routeLinesLayer && panZoom) {
        const g = [...routeLinesLayer.querySelectorAll('g[data-route]')].find(el => el.getAttribute('data-route') === listRoute)
        if (g) panZoom.fitTo(g.getBBox())
      }
    }

    const ROUTE_STYLE = `
      #route-lines polyline { fill: none; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
      #route-lines .route-casing { stroke: #fff; stroke-width: 6px; opacity: .9; }
      #route-lines .route-line { stroke-width: 3px; }
      #route-lines .route-casing { pointer-events: none; }
      #route-lines .route-hit { stroke: transparent; stroke-width: 10px; cursor: pointer; }
      #route-lines .route-stop { stroke: #fff; stroke-width: 1.5px; vector-effect: non-scaling-stroke; cursor: pointer; }
      #route-lines .route-stop.next-stop { stroke-width: 2.5px; }
      #route-lines g[data-route] { transition: opacity .15s ease; }
      #route-lines.has-highlight g[data-route] { opacity: .15; }
      #route-lines.has-highlight g.highlighted { opacity: 1; }
      #route-lines g.highlighted .route-line { stroke-width: 5px; }
      #route-lines g.highlighted .route-casing { stroke-width: 8px; }
    `

    const dibujarLineasRutas = () => {
      if (!svgDoc || !routeLinesLayer) return
      limpiarLineasRutas()
      const style = svgDoc.createElementNS(SVG_NS, 'style')
      style.textContent = ROUTE_STYLE
      routeLinesLayer.appendChild(style)

      for (const route of mergedRoutes.value) {
        // Pueblos de la ruta en orden de visita, cada uno una vez
        const points = []
        for (const stop of route.stops) {
          if (!stop.cod_ine) continue
          const base = getBaseCode(String(stop.cod_ine))
          if (points.some(p => p.ine === base)) continue
          const c = calcularCentroMunicipio(base)
          if (c) points.push({ ...c, ine: base })
        }
        if (!points.length) continue

        const g = svgDoc.createElementNS(SVG_NS, 'g')
        g.setAttribute('data-route', route.ruta)
        const title = svgDoc.createElementNS(SVG_NS, 'title')
        title.textContent = `${route.title}${route.label ? ` (${route.label})` : ''}`
        g.appendChild(title)
        if (points.length > 1) {
          const coords = points.map(p => `${p.x},${p.y}`).join(' ')
          // Borde blanco debajo para que la línea se lea sobre cualquier color de municipio
          for (const cls of ['route-casing', 'route-line', 'route-hit']) {
            const line = svgDoc.createElementNS(SVG_NS, 'polyline')
            line.setAttribute('points', coords)
            line.setAttribute('class', cls)
            if (cls === 'route-line') line.setAttribute('stroke', route.color)
            g.appendChild(line)
          }
        }
        // La parada de la próxima visita va más gorda
        const nextIne = route.nextStop?.cod_ine ? getBaseCode(String(route.nextStop.cod_ine)) : null
        for (const p of points) {
          const isNext = p.ine === nextIne
          const dot = svgDoc.createElementNS(SVG_NS, 'circle')
          dot.setAttribute('cx', p.x)
          dot.setAttribute('cy', p.y)
          dot.setAttribute('r', isNext ? ROUTE_STOP_R * NEXT_STOP_SCALE : ROUTE_STOP_R)
          dot.setAttribute('class', isNext ? 'route-stop next-stop' : 'route-stop')
          dot.setAttribute('fill', route.color)
          dot.addEventListener('click', (ev) => { ev.stopPropagation(); openTownCard(p.ine, ev); selectRouteInList(route.ruta) })
          if (isNext) {
            const tip = svgDoc.createElementNS(SVG_NS, 'title')
            tip.textContent = `Próxima visita: ${shortDay(route.nextStop.dia)}`
            dot.appendChild(tip)
          }
          g.appendChild(dot)
        }
        const nextDot = g.querySelector('.next-stop')
        if (nextDot) g.appendChild(nextDot)
        // Pulsar la línea: abrir la ruta en la lista del panel izquierdo
        g.querySelector('.route-hit')?.addEventListener('click', (ev) => { ev.stopPropagation(); selectRouteInList(route.ruta) })
        g.addEventListener('mouseenter', () => highlightRoute(route.ruta))
        g.addEventListener('mouseleave', () => highlightRoute(listRoute))
        routeLinesLayer.appendChild(g)
      }
      highlightRoute(highlightedRoute)
    }

    const dibujarMarcadoresBibliotecas = (municipiosPhysical = [], municipiosMobile = []) => {
      if (!svgDoc || !libraryMarkerLayer) return
      limpiarMarcadoresBibliotecas()

      const drawIcon = (codIne, href, dx = 0) => {
        const center = calcularCentroMunicipio(getBaseCode(String(codIne)))
        if (!center) return null
        const img = svgDoc.createElementNS(SVG_NS, 'image')
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href)
        const size = 18
        img.setAttribute('x', (center.x - size / 2 + dx).toString())
        img.setAttribute('y', (center.y - size).toString())
        img.setAttribute('width', size.toString())
        img.setAttribute('height', size.toString())
        img.setAttribute('style', 'pointer-events:auto; cursor:pointer')
        img.addEventListener('click', (ev) => { ev.stopPropagation(); openTownCard(codIne, ev) })
        libraryMarkerLayer.appendChild(img)
        return img
      }

      const physicalSet = new Set(municipiosPhysical)
      const mobileSet = new Set(municipiosMobile)
      new Set([...physicalSet, ...mobileSet]).forEach(codIne => {
        const both = physicalSet.has(codIne) && mobileSet.has(codIne)
        if (physicalSet.has(codIne)) {
          const el = drawIcon(codIne, '/assets/icons/libro.png', both ? -10 : 0)
          if (el) libraryMarkersMap.set(`${codIne}-physical`, el)
        }
        if (mobileSet.has(codIne)) {
          const el = drawIcon(codIne, '/assets/icons/libreria-digital.png', both ? 10 : 0)
          if (el) libraryMarkersMap.set(`${codIne}-mobile`, el)
        }
      })
    }

    // ---------- Estaciones meteorológicas ----------
    // El SVG no trae proyección: se ajusta una transformación afín lon/lat → SVG con los centros de los
    // 362 municipios (a la escala de la provincia el error es de pocos píxeles).
    let stationLayer = null
    let projectP = null
    const getProjection = () => {
      if (!projectP) {
        projectP = weatherApi.municipalities().then(({ municipalities }) => {
          const pairs = []
          for (const m of municipalities) {
            const c = calcularCentroMunicipio(m.id)
            if (c && Number.isFinite(m.lat)) pairs.push({ lon: m.lon, lat: m.lat, x: c.x, y: c.y })
          }
          return fitAffine(pairs)
        }).catch(() => { projectP = null; return null })
      }
      return projectP
    }
    const limpiarEstaciones = () => { if (stationLayer) stationLayer.remove(); stationLayer = null }
    const stationShape = (network, x, y, r) => {
      const shape = NETWORKS[network]?.shape || 'circle'
      if (shape === 'square') {
        const el = svgDoc.createElementNS(SVG_NS, 'rect')
        el.setAttribute('x', x - r * 0.9)
        el.setAttribute('y', y - r * 0.9)
        el.setAttribute('width', r * 1.8)
        el.setAttribute('height', r * 1.8)
        el.setAttribute('rx', 2)
        return el
      }
      if (shape === 'diamond') {
        const el = svgDoc.createElementNS(SVG_NS, 'polygon')
        el.setAttribute('points', `${x},${y - r * 1.25} ${x + r * 1.25},${y} ${x},${y + r * 1.25} ${x - r * 1.25},${y}`)
        return el
      }
      const el = svgDoc.createElementNS(SVG_NS, 'circle')
      el.setAttribute('cx', x)
      el.setAttribute('cy', y)
      el.setAttribute('r', r)
      return el
    }
    const dibujarEstaciones = async () => {
      if (!svgDoc) return
      const stations = props.weatherStations
      if (!stations.length) { limpiarEstaciones(); return }
      const project = await getProjection()
      if (!project || props.weatherStations !== stations) return
      limpiarEstaciones()
      const dark = theme.value === 'dark'
      const surface = dark ? '#1f262e' : '#ffffff'
      stationLayer = svgDoc.createElementNS(SVG_NS, 'g')
      stationLayer.setAttribute('id', 'weather-stations')
      // Las que no tienen dato reciente, debajo
      const sorted = stations.toSorted((a, b) => isRecent(a.lastObservationAt) - isRecent(b.lastObservationAt))
      for (const st of sorted) {
        if (!Number.isFinite(st.lat) || !Number.isFinite(st.lon)) continue
        const { x, y } = project(st.lon, st.lat)
        const t = isRecent(st.lastObservationAt) ? st.latest?.temperature?.value : null
        const bin = tempBin(t)
        const g = svgDoc.createElementNS(SVG_NS, 'g')
        g.setAttribute('class', 'wx-station')
        g.setAttribute('style', 'cursor:pointer; pointer-events:auto')
        g.setAttribute('tabindex', '0')
        g.setAttribute('role', 'button')
        // Zona de pulsación mayor que la marca
        const hit = svgDoc.createElementNS(SVG_NS, 'circle')
        hit.setAttribute('cx', x)
        hit.setAttribute('cy', y)
        hit.setAttribute('r', 14)
        hit.setAttribute('fill', 'transparent')
        g.appendChild(hit)
        // Rellena con el color de su temperatura; sin dato reciente, hueca y en gris discontinuo
        const mark = stationShape(st.network, x, y, 7)
        mark.setAttribute('fill', bin ? bin.color : surface)
        // contorno en tinta: el tramo 10–15 °C es gris claro, como los municipios
        mark.setAttribute('stroke', bin ? (dark ? '#eef2f6' : '#16202a') : (dark ? '#8a96a3' : '#7a858f'))
        mark.setAttribute('stroke-width', bin ? 1.5 : 2)
        if (!bin) mark.setAttribute('stroke-dasharray', '3 2')
        g.appendChild(mark)
        if (bin) {
          const label = svgDoc.createElementNS(SVG_NS, 'text')
          label.setAttribute('x', x)
          label.setAttribute('y', y - 12)
          label.setAttribute('text-anchor', 'middle')
          label.setAttribute('style', `font: 700 10px system-ui, sans-serif; fill: ${dark ? '#eef2f6' : '#16202a'}; stroke: ${surface}; stroke-width: 3px; paint-order: stroke; pointer-events: none`)
          label.textContent = `${Math.round(t)}°`
          g.appendChild(label)
        }
        const name = st.name + (st.municipality?.name ? ` (${st.municipality.name})` : '')
        const title = svgDoc.createElementNS(SVG_NS, 'title')
        title.textContent = `${NETWORKS[st.network]?.label || st.network} · ${name}\n${bin ? fmtTemp(t) : 'Sin datos recientes'} · ${ago(st.lastObservationAt)}`
        g.appendChild(title)
        g.setAttribute('aria-label', `Estación ${name}: ${bin ? fmtTemp(t) : 'sin datos recientes'}`)
        const open = (ev) => { ev.stopPropagation(); emit('stationSelected', st) }
        g.addEventListener('click', open)
        g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') open(ev) })
        stationLayer.appendChild(g)
      }
      svgDoc.querySelector('svg').appendChild(stationLayer)
    }
    watch(() => props.weatherStations, dibujarEstaciones)
    watch(() => theme.value, () => { if (props.weatherStations.length) dibujarEstaciones() })

    // ---------- Ruta cultural ----------
    // Como un plano de ruta: trazo grueso con borde oscuro de parada en parada, un círculo numerado en cada una
    // (el mismo número que en la lista del panel) y su nombre al lado. Las paradas van por sus coordenadas
    // (la iglesia, en la Ruta del Mudéjar) con la misma proyección que las estaciones.
    let routeLayer = null
    const limpiarRutaCultural = () => { if (routeLayer) routeLayer.remove(); routeLayer = null }
    const dibujarRutaCultural = async () => {
      const route = props.culturalRoute
      if (!svgDoc || !route) { limpiarRutaCultural(); return }
      const project = await getProjection()
      if (!project || props.culturalRoute !== route) return
      limpiarRutaCultural()
      const dark = theme.value === 'dark'
      const ink = dark ? '#eef2f6' : '#16202a'
      const halo = dark ? '#1f262e' : '#ffffff'
      routeLayer = svgDoc.createElementNS(SVG_NS, 'g')
      routeLayer.setAttribute('id', 'cultural-route')
      const at = (p) => project(p.lon, p.lat)
      const all = route.tramos.flatMap(t => t.paradas.map(at))
      const box = { x: Math.min(...all.map(p => p.x)), y: Math.min(...all.map(p => p.y)) }
      box.width = Math.max(...all.map(p => p.x)) - box.x
      box.height = Math.max(...all.map(p => p.y)) - box.y
      // Trazo de cada tramo (los senderos circulares de un solo pueblo no llevan línea)
      for (const t of route.tramos) {
        if (t.paradas.length < 2) continue
        const pts = t.paradas.map(at).map(({ x, y }) => `${x},${y}`).join(' ')
        // Como en un plano de ruta: trazo oscuro con borde claro, que se lee sobre los pueblos coloreados
        for (const [cls, color, w] of [['casing', halo, 8], ['line', ink, 3.5]]) {
          const line = svgDoc.createElementNS(SVG_NS, 'polyline')
          line.setAttribute('points', pts)
          line.setAttribute('class', `cr-${cls}`)
          line.setAttribute('style', `fill:none; stroke:${color}; stroke-width:${w}px; stroke-linecap:round; stroke-linejoin:round; vector-effect:non-scaling-stroke; pointer-events:none`)
          routeLayer.appendChild(line)
        }
      }
      // Nombre a la izquierda si la parada más cercana está a su derecha y pegada (Mudéjar: Turra, Galleguillos…)
      const near = Math.max(box.width, box.height) * 0.09
      const labelLeft = (x, y) => {
        let best = null
        for (const q of all) {
          const d = Math.hypot(q.x - x, q.y - y)
          if (d > 0.01 && (!best || d < best.d)) best = { d, dx: q.x - x }
        }
        return Boolean(best && best.d < near && best.dx > 0)
      }
      // Paradas: cada lugar una vez, con su número
      const seen = new Set()
      let n = 0
      for (const t of route.tramos) {
        for (const p of t.paradas) {
          const key = `${p.ine}|${p.localidad || ''}`
          if (seen.has(key)) continue
          seen.add(key)
          n++
          const { x, y } = at(p)
          // La parada se dibuja en el origen dentro de .cr-mark, que svgPanZoom escala con el zoom: mide lo
          // mismo en pantalla al abrir la ruta, al acercarse a mano y en el móvil
          const g = svgDoc.createElementNS(SVG_NS, 'g')
          g.setAttribute('transform', `translate(${x} ${y})`)
          g.setAttribute('style', 'cursor:pointer; pointer-events:auto')
          const mark = svgDoc.createElementNS(SVG_NS, 'g')
          mark.setAttribute('class', 'cr-mark')
          const c = svgDoc.createElementNS(SVG_NS, 'circle')
          c.setAttribute('r', 11)
          c.setAttribute('fill', ink)
          c.setAttribute('stroke', route.color)
          c.setAttribute('stroke-width', 3)
          mark.appendChild(c)
          const num = svgDoc.createElementNS(SVG_NS, 'text')
          num.setAttribute('y', 4)
          num.setAttribute('text-anchor', 'middle')
          num.setAttribute('style', `font: 800 11px system-ui, sans-serif; fill: ${halo}; pointer-events: none`)
          num.textContent = String(n)
          mark.appendChild(num)
          const label = svgDoc.createElementNS(SVG_NS, 'text')
          const left = labelLeft(x, y)
          label.setAttribute('x', left ? -15 : 15); label.setAttribute('y', 4.5)
          if (left) label.setAttribute('text-anchor', 'end')
          label.setAttribute('style', `font: 700 12px system-ui, sans-serif; fill: ${ink}; stroke: ${halo}; stroke-width: 3.5px; paint-order: stroke; pointer-events: none`)
          label.textContent = p.localidad || p.municipio
          mark.appendChild(label)
          g.appendChild(mark)
          const title = svgDoc.createElementNS(SVG_NS, 'title')
          title.textContent = `${n}. ${p.localidad || p.municipio}${p.lugar ? ` — ${p.lugar}` : ''}`
          g.appendChild(title)
          g.addEventListener('click', (ev) => { ev.stopPropagation(); highlightMunicipio(p.ine) })
          routeLayer.appendChild(g)
        }
      }
      svgDoc.querySelector('svg').appendChild(routeLayer)
      // El mapa se va a la ruta (margen para los nombres; las rutas pequeñas, como la del Mudéjar, se acercan más)
      if (panZoom) panZoom.fitTo({ x: box.x - 20, y: box.y - 30, width: box.width + 120, height: box.height + 60 }, { padding: 1.35, maxZoom: 4 })
    }
    watch(() => props.culturalRoute, dibujarRutaCultural)
    watch(() => theme.value, () => { if (props.culturalRoute) dibujarRutaCultural() })

    // Configurar listeners
    onMounted(() => {
      window.addEventListener('themeChanged', handleThemeChange)
      window.addEventListener('highlightMunicipio', handleHighlightMunicipio)
      window.addEventListener('highlightRoute', handleListRoute)
    })

    onUnmounted(() => {
      window.removeEventListener('themeChanged', handleThemeChange)
      window.removeEventListener('highlightMunicipio', handleHighlightMunicipio)
      window.removeEventListener('highlightRoute', handleListRoute)
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

    // Redibujar las rutas cuando cambien (o cuando llegan las comarcas, que fijan los colores)
    watch(mergedRoutes, (routes) => {
      if (!routes.length) {
        limpiarLineasRutas()
        listRoute = null
        highlightedRoute = null
      } else {
        dibujarLineasRutas()
      }
    })

    return {
      svgObject,
      mapSvgPath,
      zoomIn,
      zoomOut,
      resetView,
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
