<template>
  <!-- Cartografía agrícola (SIGPAC) de un pueblo, a pantalla completa: recintos por uso sobre la ortofoto,
       ficha de cada recinto y herramientas de medición. Datos: public/data/sigpac/<ine>.json
       (backend/scripts/build-sigpac.js). Es un <dialog> modal: tapa el resto de la web y Esc lo cierra. -->
  <dialog ref="dialog" class="ca" aria-labelledby="ca-title" @cancel="onCancel" @close="$emit('close')">
    <header class="ca-head">
      <button type="button" class="ca-back" @click="dialog.close()"><span aria-hidden="true">←</span> Volver<span class="ca-back-long"> al mapa</span></button>
      <div class="ca-titles">
        <h2 id="ca-title">Cartografía agrícola · {{ data?.municipio.nombre || name }}</h2>
        <p v-if="data">SIGPAC {{ data.campaña }} · {{ data.features.length.toLocaleString('es-ES') }} recintos · {{ fmtArea(totalArea) }}</p>
      </div>
      <button type="button" class="ca-mine" :aria-pressed="String(panel === 'explotacion')" @click="togglePanel">
        <span aria-hidden="true">🔒</span> Mi explotación
      </button>
      <div class="ca-base" role="group" aria-label="Fondo del mapa">
        <button v-for="b in BASES" :key="b.id" type="button" :aria-pressed="String(base === b.id)" @click="setBase(b.id)">{{ b.label }}</button>
      </div>
    </header>

    <div class="ca-body">
      <div class="ca-mapwrap">
        <div ref="mapEl" class="ca-map" :class="`mode-${mode}`" aria-label="Mapa de recintos"></div>

        <!-- Herramientas -->
        <div class="ca-tools" role="toolbar" aria-label="Herramientas">
          <button type="button" class="ca-gps" :aria-busy="String(locating)" title="Buscar el recinto donde estás" @click="locate">
            <span aria-hidden="true">📍</span><span class="ca-tool-label">{{ locating ? 'Buscando…' : 'Estoy aquí' }}</span>
          </button>
          <button v-for="t in TOOLS" :key="t.id" type="button" :aria-pressed="String(mode === t.id)" :title="t.help" @click="setMode(t.id)">
            <span aria-hidden="true">{{ t.icon }}</span><span class="ca-tool-label">{{ t.label }}</span>
          </button>
        </div>

        <!-- Croquis de la zona trabajada (lo pide un parte de «Mi explotación») -->
        <section v-if="croquis" class="ca-croquis" aria-live="polite">
          <p class="ca-croquis-tit">✏️ Dibuja la zona trabajada en <strong>{{ croquis.etiqueta }}</strong></p>
          <p class="ca-croquis-txt">{{ measure.points.length < 3 ? 'Toca el mapa en cada esquina de la zona (al menos 3).' : fmtArea(measure.area) }}</p>
          <p v-if="croquisAviso" class="ca-croquis-aviso" role="alert">{{ croquisAviso }}</p>
          <div class="ca-croquis-acc">
            <button type="button" :disabled="!measure.points.length" @click="undoPoint">Deshacer</button>
            <button type="button" @click="cancelarCroquis">Cancelar</button>
            <button type="button" class="ok" :disabled="measure.points.length < 3" @click="listoCroquis">Listo</button>
          </div>
        </section>

        <p v-if="loading" class="ca-state">Cargando los recintos…</p>
        <p v-else-if="error" class="ca-state error">{{ error }}</p>
      </div>

      <aside class="ca-side" :class="{ open: sideOpen }">
        <button type="button" class="ca-side-toggle" :aria-expanded="String(sideOpen)" @click="sideOpen = !sideOpen">
          {{ sideOpen ? 'Ocultar detalles' : panelTitle }}
        </button>

        <!-- Área privada: mi explotación, cultivos, partes y cuaderno -->
        <MiExplotacion
          v-if="panel === 'explotacion' && data"
          :ine="ine"
          :campaña-sigpac="data.campaña"
          :seleccion="selected"
          :abrir-parte-id="abrirParteId"
          :croquis-hecho="croquisHecho"
          @ver-recinto="verRecinto"
          @guardados="marcarGuardados"
          @dibujar="empezarCroquis"
        />

        <template v-if="panel === 'mapa'">
        <!-- Dónde estoy (GPS): el recinto seguro, o los candidatos si la posición no lo deja claro -->
        <section v-if="gps" class="ca-card" aria-live="polite">
          <div class="ca-card-head">
            <h3>📍 Tu posición</h3>
            <button type="button" class="ca-x" aria-label="Quitar la posición" @click="clearGps">✕</button>
          </div>
          <p v-if="gps.error" class="ca-hint">{{ gps.error }}</p>
          <template v-else>
            <p class="ca-sub">Precisión ± {{ Math.round(gps.accuracy) }} m · <button type="button" class="ca-link" @click="copy(gps.coords)">{{ copied ? 'Copiadas' : gps.coords }}</button></p>
            <p v-if="gps.fuera" class="ca-hint">Estás fuera de {{ data.municipio.nombre }} (a unos {{ gps.fuera }} km). No se asigna ningún recinto: elige uno en el mapa o búscalo por polígono y parcela.</p>
            <p v-else-if="gps.seguro" class="ca-hint">Estás en el recinto {{ sp.pol }}/{{ sp.par }}/{{ sp.rec }}.</p>
            <template v-else-if="gps.candidatos.length">
              <p class="ca-hint">{{ gps.candidatos.length > 1 ? 'La posición cae cerca de un límite. ¿En cuál estás?' : 'No está claro: confirma el recinto.' }}</p>
              <div class="ca-actions">
                <button v-for="c in gps.candidatos" :key="keyOf(c.feature)" type="button" @click="select(c.feature, { zoom: true })">
                  {{ c.feature.properties.pol }}/{{ c.feature.properties.par }}/{{ c.feature.properties.rec }} · {{ usoDe(c.feature.properties.uso).nombre }}{{ c.dentro ? ' (dentro)' : ` (a ${Math.round(c.distancia)} m)` }}
                </button>
              </div>
            </template>
            <p v-else class="ca-hint">No hay ningún recinto en tu posición. Elige uno en el mapa.</p>
          </template>
        </section>

        <!-- Buscar polígono y parcela -->
        <form class="ca-search" @submit.prevent="search">
          <label>Polígono <input id="ca-pol" v-model.trim="qPol" inputmode="numeric" pattern="[0-9]*" placeholder="501" /></label>
          <label>Parcela <input id="ca-par" v-model.trim="qPar" inputmode="numeric" pattern="[0-9]*" placeholder="77" /></label>
          <button type="submit">Buscar</button>
        </form>
        <p v-if="searchMsg" class="ca-msg" role="status">{{ searchMsg }}</p>

        <!-- Medición en curso -->
        <section v-if="mode === 'line' || mode === 'area'" class="ca-card" aria-live="polite">
          <h3>{{ mode === 'line' ? 'Medir distancia' : 'Medir superficie' }}</h3>
          <p class="ca-big">{{ mode === 'line' ? fmtLength(measure.length) : fmtArea(measure.area) }}</p>
          <p v-if="mode === 'area' && measure.points.length > 2" class="ca-sub">Perímetro {{ fmtLength(measure.perimeter) }}</p>
          <p v-if="mode === 'line' && measure.points.length > 1" class="ca-sub">Último tramo {{ fmtLength(measure.last) }} · {{ measure.points.length }} puntos</p>
          <p class="ca-hint">Toca el mapa para poner puntos. Doble clic o «Terminar» para acabar; luego puedes empezar otra.</p>
          <div class="ca-actions">
            <button type="button" :disabled="!measure.points.length" @click="undoPoint">Deshacer punto</button>
            <button type="button" :disabled="measure.points.length < 2" @click="finishMeasure">Terminar</button>
            <button type="button" :disabled="!hasDrawings" @click="clearMeasures">Borrar</button>
          </div>
        </section>

        <!-- Suma de recintos -->
        <section v-if="mode === 'sum'" class="ca-card" aria-live="polite">
          <h3>Sumar recintos</h3>
          <p class="ca-big">{{ fmtArea(sumArea) }}</p>
          <p class="ca-sub">{{ summed.length }} {{ summed.length === 1 ? 'recinto' : 'recintos' }} · superficie oficial del SIGPAC</p>
          <p v-if="!summed.length" class="ca-hint">Toca recintos para sumarlos; vuelve a tocar uno para quitarlo.</p>
          <ul v-else class="ca-sumlist">
            <li v-for="f in summed" :key="keyOf(f)">
              <span class="ca-dot" :style="{ background: usoDe(f.properties.uso).color }" aria-hidden="true"></span>
              {{ f.properties.pol }}/{{ f.properties.par }}/{{ f.properties.rec }} · {{ usoDe(f.properties.uso).nombre }}
              <strong>{{ fmtArea(f.properties.sup) }}</strong>
            </li>
          </ul>
          <div class="ca-actions"><button type="button" :disabled="!summed.length" @click="clearSum">Vaciar</button></div>
        </section>

        <!-- Ficha del recinto -->
        <section v-if="mode === 'select' && selected" class="ca-card">
          <div class="ca-card-head">
            <h3>Polígono {{ sp.pol }} · Parcela {{ sp.par }} · Recinto {{ sp.rec }}</h3>
            <button type="button" class="ca-x" aria-label="Quitar la selección" @click="select(null)">✕</button>
          </div>
          <p class="ca-uso"><span class="ca-dot" :style="{ background: usoDe(sp.uso).color }" aria-hidden="true"></span>{{ usoDe(sp.uso).nombre }} <code>{{ sp.uso }}</code></p>
          <dl class="ca-facts">
            <div><dt>Superficie (SIGPAC)</dt><dd>{{ fmtArea(sp.sup) }}</dd></div>
            <div><dt>Medida en el mapa</dt><dd>{{ fmtArea(selectedArea) }}</dd></div>
            <div><dt>Perímetro</dt><dd>{{ fmtLength(selectedPerimeter) }}</dd></div>
            <div><dt>Regadío</dt><dd>{{ sp.reg ? `Coeficiente ${sp.reg} %` : 'Secano' }}</dd></div>
            <div v-if="parcel.length > 1"><dt>Parcela completa</dt><dd>{{ parcel.length }} recintos · {{ fmtArea(parcelArea) }}</dd></div>
          </dl>
          <div class="ca-refs">
            <p><span>Referencia SIGPAC</span> <code>{{ sigpacRef }}</code></p>
            <p v-if="sp.cat"><span>Referencia catastral</span> <code>{{ sp.cat }}</code></p>
          </div>
          <div class="ca-actions">
            <button type="button" @click="copy(sigpacRef)">{{ copied ? 'Copiada' : 'Copiar referencia' }}</button>
            <a v-if="sp.cat" :href="`https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?refcat=${sp.cat.slice(0, 14)}`" target="_blank" rel="noopener noreferrer">Ver en el Catastro ↗</a>
          </div>
          <button v-if="!savedKeys.has(keyOf(selected))" type="button" class="ca-save" @click="panel = 'explotacion'; sideOpen = true">⭐ Guardar en mi explotación</button>
          <p v-else class="ca-sub">⭐ Está en tu explotación</p>
        </section>

        <!-- Resumen del pueblo por usos -->
        <section v-if="mode === 'select' && !selected && data" class="ca-card">
          <h3>Usos del suelo</h3>
          <p class="ca-hint">Toca un recinto para ver su ficha. Pasa por un uso para resaltarlo en el mapa.</p>
          <ul class="ca-usos">
            <li v-for="u in usoSummary" :key="u.code">
              <button
                type="button"
                class="ca-uso-row"
                :aria-pressed="String(focusUso === u.code)"
                @mouseenter="hoverUso = u.code"
                @mouseleave="hoverUso = null"
                @focus="hoverUso = u.code"
                @blur="hoverUso = null"
                @click="focusUso = focusUso === u.code ? null : u.code"
              >
                <span class="ca-dot" :style="{ background: u.color }" aria-hidden="true"></span>
                <span class="ca-uso-name">{{ u.nombre }}</span>
                <span class="ca-uso-val">{{ fmtArea(u.area) }}</span>
                <span class="ca-bar" aria-hidden="true"><span :style="{ width: `${(u.area / totalArea) * 100}%`, background: u.color }"></span></span>
              </button>
            </li>
          </ul>
        </section>

        </template>

        <footer v-if="data" class="ca-source">
          {{ data.fuente.datos }}. Cartografía: {{ data.fuente.cartografia }}<template v-if="data.fuente.fechaReferencia"> ({{ refDate }})</template>.
          Ortofoto y mapa: PNOA e IGN (CC BY 4.0). {{ data.fuente.licencia }}.
          Información orientativa: para la PAC vale el SIGPAC oficial.
        </footer>
      </aside>
    </div>
  </dialog>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch, shallowRef } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { loadSigpac, usoDe, USOS, geometryArea, geometryPerimeter, lineLength, ringArea, distance, fmtArea, fmtLength, candidatosEn, pointInGeometry, distanceToEdge } from '@/utils/sigpac'
import MiExplotacion from '@/components/MiExplotacion.vue'

const WMTS = (service, layer) => `https://www.ign.es/wmts/${service}?service=WMTS&request=GetTile&version=1.0.0&layer=${layer}&style=default&tilematrixset=GoogleMapsCompatible&format=image/jpeg&tilematrix={z}&tilerow={y}&tilecol={x}`
const BASES = [
  { id: 'orto', label: 'Ortofoto', url: WMTS('pnoa-ma', 'OI.OrthoimageCoverage'), attribution: 'PNOA © IGN' },
  { id: 'mapa', label: 'Mapa', url: WMTS('ign-base', 'IGNBaseTodo'), attribution: '© IGN' }
]
const TOOLS = [
  { id: 'select', icon: '👆', label: 'Recinto', help: 'Ver la ficha de un recinto' },
  { id: 'line', icon: '📏', label: 'Distancia', help: 'Medir una distancia' },
  { id: 'area', icon: '⬠', label: 'Superficie', help: 'Medir una superficie' },
  { id: 'sum', icon: '➕', label: 'Sumar', help: 'Sumar la superficie de varios recintos' }
]
const MEASURE_COLOR = '#ff3d71'
const keyOf = (f) => `${f.properties.agr}-${f.properties.zona}-${f.properties.pol}-${f.properties.par}-${f.properties.rec}`

export default {
  name: 'CartografiaAgricola',
  components: { MiExplotacion },
  props: {
    ine: { type: String, required: true },
    // Abrir directamente un parte del cuaderno (enlace de la exportación)
    abrirParteId: { type: String, default: null },
    name: { type: String, default: '' }
  },
  emits: ['close'],
  setup(props) {
    const dialog = ref(null)
    const mapEl = ref(null)
    const data = shallowRef(null)
    const loading = ref(true)
    const error = ref('')
    const base = ref('orto')
    const mode = ref('select')
    const sideOpen = ref(false)
    // Panel lateral: el visor público ('mapa') o el área privada ('explotacion')
    const panel = ref(props.abrirParteId ? 'explotacion' : 'mapa')
    // Recintos de mi explotación en este pueblo (se resaltan en el mapa)
    const savedKeys = ref(new Set())
    // Posición GPS: { lat, lng, accuracy, coords, candidatos, seguro, fuera, error }
    const gps = ref(null)
    const locating = ref(false)
    let gpsLayer = null
    const selected = shallowRef(null)
    const summed = shallowRef([])
    const hoverUso = ref(null)
    const focusUso = ref(null)
    const qPol = ref('')
    const qPar = ref('')
    const searchMsg = ref('')
    const copied = ref(false)
    const measure = ref({ points: [], length: 0, last: 0, area: 0, perimeter: 0 })
    const hasDrawings = ref(false)

    let map = null
    let baseLayer = null
    let recintos = null
    let drawLayer = null // mediciones terminadas y la que está en curso
    let current = null // { line|polygon, markers[] }
    const layerOf = new Map() // key → capa del recinto

    // ---------- Estilo de los recintos ----------
    const sp = computed(() => selected.value?.properties || {})
    const parcelKey = (p) => `${p.agr}-${p.zona}-${p.pol}-${p.par}`
    const parcel = computed(() => (selected.value && data.value ? data.value.features.filter(f => parcelKey(f.properties) === parcelKey(sp.value)) : []))
    const summedKeys = computed(() => new Set(summed.value.map(keyOf)))
    function styleOf(f) {
      const p = f.properties
      const u = usoDe(p.uso)
      const lit = hoverUso.value || focusUso.value
      const inParcel = selected.value && parcelKey(p) === parcelKey(sp.value)
      const isSel = selected.value && keyOf(f) === keyOf(selected.value)
      const isSum = summedKeys.value.has(keyOf(f))
      const isSaved = savedKeys.value.has(keyOf(f))
      const dim = lit && p.uso !== lit
      return {
        fillColor: u.color,
        fillOpacity: isSel || isSum ? 0.7 : dim ? 0.06 : base.value === 'orto' ? 0.32 : 0.5,
        color: isSel || isSum ? '#ffffff' : inParcel ? '#ffeb3b' : isSaved ? '#00e5ff' : '#ffffff',
        weight: isSel || isSum ? 3 : inParcel ? 2.5 : isSaved ? 2 : 0.7,
        opacity: dim ? 0.25 : 0.9
      }
    }
    const restyle = () => recintos?.setStyle(styleOf)
    watch([hoverUso, focusUso, selected, summed, base, savedKeys], restyle)

    // ---------- Mapa ----------
    function setBase(id) {
      base.value = id
      const b = BASES.find(x => x.id === id)
      if (baseLayer) map.removeLayer(baseLayer)
      baseLayer = L.tileLayer(b.url, { maxZoom: 20, maxNativeZoom: id === 'orto' ? 19 : 17, attribution: b.attribution }).addTo(map)
      baseLayer.bringToBack()
    }

    function buildMap() {
      map = L.map(mapEl.value, { preferCanvas: true, zoomControl: true, attributionControl: true, minZoom: 11 }) // zoom entero: con fracciones se ven las juntas entre teselas de la ortofoto
      map.attributionControl.setPrefix(false)
      setBase(base.value)
      drawLayer = L.layerGroup().addTo(map)
      recintos = L.geoJSON(data.value, {
        style: styleOf,
        onEachFeature: (f, layer) => {
          layerOf.set(keyOf(f), layer)
          layer.on('click', (e) => {
            L.DomEvent.stopPropagation(e)
            onRecintoClick(f, e)
          })
        }
      }).addTo(map)
      map.fitBounds(recintos.getBounds(), { padding: [8, 8] })
      map.on('click', (e) => { if (mode.value === 'line' || mode.value === 'area') addPoint(e.latlng) })
      map.on('dblclick', (e) => {
        if (mode.value === 'line' || mode.value === 'area') { L.DomEvent.stopPropagation(e); finishMeasure() }
      })
    }

    function onRecintoClick(f, e) {
      if (mode.value === 'line' || mode.value === 'area') return addPoint(e.latlng)
      if (mode.value === 'sum') {
        const k = keyOf(f)
        summed.value = summedKeys.value.has(k) ? summed.value.filter(x => keyOf(x) !== k) : [...summed.value, f]
        return
      }
      select(f)
    }

    function select(f, { zoom = false } = {}) {
      selected.value = f
      copied.value = false
      if (f) {
        sideOpen.value = true
        if (zoom) map.fitBounds(layerOf.get(keyOf(f)).getBounds(), { maxZoom: 17, padding: [40, 40] })
      }
    }

    // ---------- Medición ----------
    function setMode(m) {
      if (current) finishMeasure()
      mode.value = m
      measure.value = { points: [], length: 0, last: 0, area: 0, perimeter: 0 }
      if (m === 'line' || m === 'area') { map?.doubleClickZoom.disable(); sideOpen.value = true } else map?.doubleClickZoom.enable()
      if (m !== 'select') select(null)
    }

    function updateMeasure() {
      const pts = current.markers.map(mk => { const ll = mk.getLatLng(); return [ll.lng, ll.lat] })
      if (mode.value === 'line') {
        current.shape.setLatLngs(pts.map(([x, y]) => [y, x]))
        measure.value = { points: pts, length: lineLength(pts), last: pts.length > 1 ? distance(pts[pts.length - 2], pts[pts.length - 1]) : 0, area: 0, perimeter: 0 }
      } else {
        current.shape.setLatLngs(pts.map(([x, y]) => [y, x]))
        const closed = pts.length > 2 ? [...pts, pts[0]] : pts
        measure.value = { points: pts, length: 0, last: 0, area: ringArea(pts), perimeter: lineLength(closed) }
      }
      updateTooltip()
    }

    function updateTooltip() {
      if (!current || current.markers.length < 2) return
      const text = mode.value === 'line' ? fmtLength(measure.value.length) : fmtArea(measure.value.area)
      const at = current.markers[current.markers.length - 1]
      current.markers.forEach(mk => mk.unbindTooltip())
      at.bindTooltip(text, { permanent: true, direction: 'right', className: 'ca-tip', offset: [8, 0] }).openTooltip()
    }

    function addPoint(latlng) {
      // Los dos clics de un doble clic caen en el mismo sitio: no se repite el punto
      const last = current?.markers[current.markers.length - 1]?.getLatLng()
      if (last && map.latLngToContainerPoint(last).distanceTo(map.latLngToContainerPoint(latlng)) < 4) return
      if (!current) {
        const opts = { color: MEASURE_COLOR, weight: 3, dashArray: mode.value === 'line' ? '6 6' : null, fillColor: MEASURE_COLOR, fillOpacity: 0.18, interactive: false }
        current = { shape: (mode.value === 'line' ? L.polyline([], opts) : L.polygon([], opts)).addTo(drawLayer), markers: [] }
        hasDrawings.value = true
      }
      const mk = L.circleMarker(latlng, { radius: 5, color: '#fff', weight: 2, fillColor: MEASURE_COLOR, fillOpacity: 1, interactive: false }).addTo(drawLayer)
      current.markers.push(mk)
      updateMeasure()
    }

    function undoPoint() {
      if (!current?.markers.length) return
      drawLayer.removeLayer(current.markers.pop())
      if (!current.markers.length) { drawLayer.removeLayer(current.shape); current = null; measure.value = { points: [], length: 0, last: 0, area: 0, perimeter: 0 }; return }
      updateMeasure()
    }

    // Terminar: la medición se queda dibujada con su resultado y se puede empezar otra
    function finishMeasure() {
      if (!current) return
      if (current.markers.length < 2 || (mode.value === 'area' && current.markers.length < 3)) {
        current.markers.forEach(m => drawLayer.removeLayer(m))
        drawLayer.removeLayer(current.shape)
      }
      current = null
    }

    function clearMeasures() {
      drawLayer?.clearLayers()
      current = null
      hasDrawings.value = false
      measure.value = { points: [], length: 0, last: 0, area: 0, perimeter: 0 }
    }

    const sumArea = computed(() => summed.value.reduce((s, f) => s + f.properties.sup, 0))
    const clearSum = () => { summed.value = [] }

    // Esc: primero cancela la medición en curso; si no hay, cierra
    function onCancel(e) {
      if (current) { e.preventDefault(); finishMeasure(); clearMeasuresIfEmpty() }
    }
    const clearMeasuresIfEmpty = () => { if (!drawLayer?.getLayers().length) hasDrawings.value = false }

    // ---------- Buscar ----------
    function search() {
      searchMsg.value = ''
      if (!data.value || !qPol.value) return
      const hits = data.value.features.filter(f => String(f.properties.pol) === qPol.value && (!qPar.value || String(f.properties.par) === qPar.value))
      if (!hits.length) { searchMsg.value = `No hay ${qPar.value ? `parcela ${qPar.value} en el ` : ''}polígono ${qPol.value} en este pueblo.`; return }
      setMode('select')
      if (qPar.value) {
        select(hits.sort((a, b) => b.properties.sup - a.properties.sup)[0])
        map.fitBounds(L.featureGroup(hits.map(f => layerOf.get(keyOf(f)))).getBounds(), { maxZoom: 17, padding: [40, 40] })
      } else {
        map.fitBounds(L.featureGroup(hits.map(f => layerOf.get(keyOf(f)))).getBounds(), { padding: [30, 30] })
        searchMsg.value = `Polígono ${qPol.value}: ${hits.length} recintos.`
      }
    }

    // ---------- Datos y resumen ----------
    const totalArea = computed(() => (data.value ? data.value.features.reduce((s, f) => s + f.properties.sup, 0) : 0))
    const usoSummary = computed(() => {
      if (!data.value) return []
      const by = new Map()
      for (const f of data.value.features) by.set(f.properties.uso, (by.get(f.properties.uso) || 0) + f.properties.sup)
      return [...by.entries()].map(([code, area]) => ({ code, area, ...usoDe(code) })).sort((a, b) => b.area - a.area)
    })
    const selectedArea = computed(() => (selected.value ? geometryArea(selected.value.geometry) : 0))
    const selectedPerimeter = computed(() => (selected.value ? geometryPerimeter(selected.value.geometry) : 0))
    const parcelArea = computed(() => parcel.value.reduce((s, f) => s + f.properties.sup, 0))
    // Referencia SIGPAC: provincia:municipio:agregado:zona:polígono:parcela:recinto
    const sigpacRef = computed(() => (selected.value ? `${props.ine.slice(0, 2)}:${Number(data.value.municipio.catastro.slice(2))}:${sp.value.agr}:${sp.value.zona}:${sp.value.pol}:${sp.value.par}:${sp.value.rec}` : ''))
    const refDate = computed(() => { const d = data.value?.fuente.fechaReferencia; return d ? d.split('-').reverse().join('/') : '' })
    const panelTitle = computed(() => (selected.value ? 'Ver la ficha del recinto' : mode.value === 'select' ? 'Ver usos y buscar' : 'Ver la medición'))

    async function copy(text) {
      try { await navigator.clipboard.writeText(text); copied.value = true } catch { copied.value = false }
    }

    onMounted(async () => {
      dialog.value.showModal()
      try {
        data.value = await loadSigpac(props.ine)
        loading.value = false
        await nextTick()
        buildMap()
      } catch (e) {
        loading.value = false
        error.value = e.message || 'No se ha podido cargar la cartografía.'
      }
    })
    // ---------- Mi explotación ----------
    const togglePanel = () => { panel.value = panel.value === 'explotacion' ? 'mapa' : 'explotacion'; sideOpen.value = true }
    // Recintos guardados (de este pueblo) → resaltados en el mapa
    function marcarGuardados(list) {
      savedKeys.value = new Set(list.filter(r => r.ine === props.ine).map(r => `${r.ref.agr}-${r.ref.zona}-${r.ref.pol}-${r.ref.par}-${r.ref.rec}`))
    }
    // ---------- Croquis de la zona trabajada (para un parte) ----------
    // MiExplotacion pide dibujar en un recinto; aquí se dibuja con la herramienta de superficie y se devuelve la
    // geometría si todas las esquinas caen dentro del recinto (con 5 m de margen por la precisión del dedo y del GPS).
    const croquis = ref(null) // { recintoId, etiqueta, feature }
    const croquisAviso = ref('')
    const croquisHecho = ref(null) // { recintoId, geometria, area, seq }
    let croquisSeq = 0
    const BORDE_M = 5
    function empezarCroquis({ recintoId, ref: r, etiqueta }) {
      const feature = data.value?.features.find(x => keyOf(x) === `${r.agr}-${r.zona}-${r.pol}-${r.par}-${r.rec}`)
      if (!feature) return
      clearMeasures()
      setMode('area')
      croquis.value = { recintoId, etiqueta, feature }
      croquisAviso.value = ''
      map.fitBounds(layerOf.get(keyOf(feature)).getBounds(), { maxZoom: 18, padding: [30, 30] })
      if (window.innerWidth <= 820) sideOpen.value = false // en el móvil, todo el mapa para dibujar
    }
    function cerrarCroquis() {
      croquis.value = null
      croquisAviso.value = ''
      clearMeasures()
      setMode('select')
      sideOpen.value = true
    }
    function listoCroquis() {
      const pts = measure.value.points
      const g = croquis.value.feature.geometry
      const fuera = pts.filter(p => !pointInGeometry(p, g) && distanceToEdge(p, g) > BORDE_M).length
      if (fuera) { croquisAviso.value = `${fuera === 1 ? 'Una esquina está' : `${fuera} esquinas están`} fuera del recinto. Usa «Deshacer» y ponlas dentro.`; return }
      croquisHecho.value = { recintoId: croquis.value.recintoId, geometria: { type: 'Polygon', coordinates: [[...pts, pts[0]]] }, area: measure.value.area, seq: ++croquisSeq }
      cerrarCroquis()
    }
    const cancelarCroquis = () => cerrarCroquis()
    watch(mode, (m) => { if (m !== 'area' && croquis.value) { croquis.value = null; croquisAviso.value = '' } })

    function verRecinto(r) {
      const f = data.value?.features.find(x => keyOf(x) === `${r.ref.agr}-${r.ref.zona}-${r.ref.pol}-${r.ref.par}-${r.ref.rec}`)
      if (f) { select(f, { zoom: true }); sideOpen.value = window.innerWidth <= 820 ? false : sideOpen.value }
    }

    // ---------- Estoy aquí (GPS) ----------
    // Con posición segura se propone el recinto; cerca de un límite, los candidatos; fuera del pueblo o sin permiso,
    // se avisa y se sigue a mano. Nunca se asigna un recinto dudoso.
    function clearGps() {
      gps.value = null
      if (gpsLayer) { map?.removeLayer(gpsLayer); gpsLayer = null }
    }
    function locate() {
      if (!navigator.geolocation) { gps.value = { error: 'Este navegador no da la ubicación. Elige el recinto en el mapa o búscalo por polígono y parcela.' }; sideOpen.value = true; return }
      locating.value = true
      navigator.geolocation.getCurrentPosition((pos) => {
        locating.value = false
        const { latitude: lat, longitude: lng, accuracy } = pos.coords
        if (gpsLayer) map.removeLayer(gpsLayer)
        gpsLayer = L.layerGroup([
          L.circle([lat, lng], { radius: accuracy, color: '#2979ff', weight: 1, fillColor: '#2979ff', fillOpacity: 0.12, interactive: false }),
          L.circleMarker([lat, lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#2979ff', fillOpacity: 1, interactive: false })
        ]).addTo(map)
        const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        const inside = recintos.getBounds().pad(0.02).contains([lat, lng])
        if (!inside) {
          const km = Math.round(map.distance([lat, lng], recintos.getBounds().getCenter()) / 1000)
          gps.value = { lat, lng, accuracy, coords, candidatos: [], seguro: false, fuera: km }
          map.fitBounds(L.latLngBounds([[lat, lng]]).extend(recintos.getBounds()), { padding: [30, 30] })
        } else {
          const { candidatos, seguro } = candidatosEn(data.value.features, [lng, lat], accuracy)
          gps.value = { lat, lng, accuracy, coords, candidatos, seguro, fuera: 0 }
          setMode('select')
          if (seguro) select(candidatos[0].feature)
          map.setView([lat, lng], Math.max(map.getZoom(), 17))
        }
        sideOpen.value = true
        panel.value = 'mapa'
      }, (err) => {
        locating.value = false
        const msg = err.code === 1 ? 'Sin permiso para usar tu ubicación.' : err.code === 3 ? 'La ubicación ha tardado demasiado.' : 'No se ha podido saber tu ubicación.'
        gps.value = { error: `${msg} Elige el recinto en el mapa o búscalo por polígono y parcela.` }
        sideOpen.value = true
        panel.value = 'mapa'
      }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 })
    }

    onBeforeUnmount(() => { map?.remove(); map = null })

    return {
      dialog, mapEl, data, loading, error, base, mode, sideOpen, selected, summed, hoverUso, focusUso, qPol, qPar, searchMsg, copied,
      croquis, croquisAviso, croquisHecho, empezarCroquis, listoCroquis, cancelarCroquis,
      measure, hasDrawings, sp, parcel, sumArea, totalArea, usoSummary, selectedArea, selectedPerimeter, parcelArea, sigpacRef, refDate, panelTitle,
      panel, savedKeys, gps, locating, togglePanel, marcarGuardados, verRecinto, locate, clearGps,
      BASES, TOOLS, USOS, usoDe, fmtArea, fmtLength, keyOf,
      setBase, setMode, select, search, undoPoint, finishMeasure, clearMeasures, clearSum, onCancel, copy
    }
  }
}
</script>

<style scoped>
/* Pantalla completa sin scroll propio (el panel tiene el suyo; si el diálogo pudiera desplazarse, al enfocar el mapa
   se movería y el mapa taparía la cabecera y el panel) */
.ca {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  overflow: hidden;
  background: var(--bg-primary);
  color: var(--text-primary);
}
.ca[open] {
  display: flex;
  flex-direction: column;
}
.ca:modal {
  overscroll-behavior: contain;
}
.ca::backdrop {
  background: rgba(0, 0, 0, 0.5);
  overflow: hidden;
  overscroll-behavior: contain;
}

/* Cabecera */
.ca-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 10px max(16px, env(safe-area-inset-right, 0px)) 10px max(16px, env(safe-area-inset-left, 0px));
  border-bottom: 1px solid var(--border-primary);
  background: var(--bg-secondary);
}
.ca-back {
  padding: 8px 14px;
  border: 1px solid var(--border-primary);
  border-radius: 999px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.ca-titles {
  flex: 1;
  min-width: 0;
}
.ca-titles h2 {
  margin: 0;
  font-size: 1.1rem;
  line-height: 1.25;
}
.ca-titles p {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
.ca-base {
  display: flex;
  padding: 3px;
  border-radius: 999px;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
}
.ca-base button {
  padding: 6px 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.ca-base button[aria-pressed='true'] {
  background: var(--primary-color);
  color: #fff;
  font-weight: 600;
}

/* Cuerpo: mapa grande y panel a la derecha */
.ca-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
}
.ca-mapwrap {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.ca-map {
  position: absolute;
  inset: 0;
  background: #20262b;
}
.ca-map.mode-line,
.ca-map.mode-area {
  cursor: crosshair;
}
.ca-map.mode-line :deep(.leaflet-interactive),
.ca-map.mode-area :deep(.leaflet-interactive) {
  cursor: crosshair;
}
.ca-state {
  position: absolute;
  inset: 50% auto auto 50%;
  translate: -50% -50%;
  margin: 0;
  padding: 10px 16px;
  border-radius: 10px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  z-index: 500;
}
.ca-state.error {
  color: #e53935;
}

/* Croquis de un parte: barra sobre el mapa, abajo (al alcance del pulgar) */
.ca-croquis {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 28px;
  z-index: 600;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 460px;
  margin: 0 auto;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--bg-secondary);
  border: 2px solid var(--primary-color);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
  color: var(--text-primary);
}
.ca-croquis p { margin: 0; }
.ca-croquis-tit { font-size: 15px; }
.ca-croquis-txt { font-size: 20px; font-weight: 800; }
.ca-croquis-aviso { font-size: 14px; color: #e53935; }
.ca-croquis-acc { display: grid; grid-template-columns: 1fr 1fr 1.3fr; gap: 8px; }
.ca-croquis-acc button {
  min-height: 46px;
  border: 1px solid var(--border-primary);
  border-radius: 999px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}
.ca-croquis-acc button.ok { border-color: transparent; background: var(--primary-color); color: #fff; }
.ca-croquis-acc button:disabled { opacity: 0.5; cursor: not-allowed; }

/* Barra de herramientas sobre el mapa */
.ca-tools {
  position: absolute;
  top: 12px;
  left: 56px;
  z-index: 500;
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}
.ca-tools button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.ca-tools button[aria-pressed='true'] {
  background: var(--primary-color);
  color: #fff;
}
.ca-tools button:focus-visible,
.ca-base button:focus-visible,
.ca-back:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

/* Mi explotación (cabecera), Estoy aquí (barra) y Guardar (ficha) */
.ca-mine {
  padding: 7px 12px;
  border: 1px solid var(--border-primary);
  border-radius: 999px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.ca-mine[aria-pressed='true'] {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #fff;
}
.ca-tools .ca-gps {
  background: color-mix(in srgb, #2979ff 18%, transparent);
}
.ca-save {
  align-self: flex-start;
  padding: 8px 14px;
  border: 0;
  border-radius: 999px;
  background: var(--primary-color);
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.ca-link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--primary-color);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
.ca-body:has(.mx) {
  grid-template-columns: minmax(0, 1fr) 440px;
}

/* Panel */
.ca-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
  overflow-y: auto;
  border-left: 1px solid var(--border-primary);
  background: var(--bg-primary);
}
.ca-side-toggle {
  display: none;
}
.ca-search {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
  align-items: end;
}
.ca-search label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}
.ca-search input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--border-primary);
  border-radius: 10px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font: inherit;
}
.ca-search button,
.ca-actions button,
.ca-actions a {
  padding: 8px 14px;
  border: 1px solid var(--border-primary);
  border-radius: 999px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}
.ca-search button {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #fff;
}
.ca-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ca-msg {
  margin: -4px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}
.ca-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--border-primary);
  border-radius: 14px;
  background: var(--bg-secondary);
}
.ca-card h3 {
  margin: 0;
  font-size: 15px;
  line-height: 1.3;
}
.ca-card-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.ca-x {
  flex: none;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
}
.ca-big {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.ca-sub,
.ca-hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}
.ca-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ca-dot {
  flex: none;
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.2);
}
.ca-uso {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-weight: 600;
}
.ca-uso code,
.ca-refs code {
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
}
.ca-facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 0;
}
.ca-facts div {
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--bg-primary);
}
.ca-facts dt {
  font-size: 12px;
  color: var(--text-secondary);
}
.ca-facts dd {
  margin: 2px 0 0;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.ca-refs p {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 8px;
  margin: 0 0 4px;
  font-size: 13px;
  color: var(--text-secondary);
}
.ca-refs code {
  overflow-wrap: anywhere;
}
.ca-sumlist {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
  font-size: 13px;
}
.ca-sumlist li {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 0;
  border-top: 1px solid var(--border-primary);
}
.ca-sumlist strong {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}
.ca-usos {
  list-style: none;
  margin: 0;
  padding: 0;
}
.ca-uso-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 2px 8px;
  width: 100%;
  padding: 6px 4px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.ca-uso-row:hover,
.ca-uso-row[aria-pressed='true'] {
  background: var(--bg-primary);
}
.ca-uso-row:focus-visible {
  outline: 2px solid var(--primary-color);
}
.ca-uso-val {
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}
.ca-bar {
  grid-column: 2 / 4;
  height: 4px;
  border-radius: 2px;
  background: var(--bg-primary);
  overflow: hidden;
}
.ca-bar span {
  display: block;
  height: 100%;
  min-width: 2px;
}
.ca-source {
  margin-top: auto;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-secondary);
}

/* Etiqueta de la medida junto al último punto */
:deep(.ca-tip) {
  padding: 3px 8px;
  border: 0;
  border-radius: 8px;
  background: #1d2228;
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
:deep(.ca-tip)::before {
  display: none;
}

/* Móvil: el mapa ocupa todo y el panel es una hoja que se despliega desde abajo */
@media (max-width: 820px) {
  .ca-body,
  .ca-body:has(.mx) {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) auto;
  }
  .ca-side {
    border-left: 0;
    border-top: 1px solid var(--border-primary);
    max-height: 46px;
    overflow: hidden;
    padding-top: 6px;
    padding-bottom: max(10px, env(safe-area-inset-bottom, 0px));
    transition: max-height 0.25s ease;
  }
  .ca-side.open {
    max-height: 55dvh;
    overflow-y: auto;
  }
  .ca-side-toggle {
    display: block;
    flex: none;
    padding: 8px;
    border: 0;
    background: none;
    color: var(--primary-color);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .ca-tools {
    left: 50%;
    translate: -50% 0;
    top: auto;
    bottom: 12px;
  }
  .ca-tool-label {
    display: none;
  }
  .ca-tools button {
    font-size: 18px;
    padding: 8px 12px;
  }
  /* Cabecera en dos filas: Volver y el fondo arriba; el título debajo, a todo el ancho */
  .ca-head {
    gap: 6px 10px;
    padding-block: 8px;
  }
  .ca-back {
    padding: 6px 12px;
  }
  .ca-back-long {
    display: none;
  }
  .ca-base {
    margin-left: auto;
  }
  .ca-titles {
    order: 3;
    flex-basis: 100%;
  }
  .ca-titles h2 {
    font-size: 1rem;
  }
  .ca-titles p {
    font-size: 12px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ca-side {
    transition: none;
  }
}
</style>
