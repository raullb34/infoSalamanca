<template>
  <div class="evolution">
    <!-- Población en los censos desde 1842 (INE) -->
    <section v-if="series.length" class="ev-block" aria-labelledby="ev-pop-title">
      <h4 id="ev-pop-title" class="ev-heading">Población en los censos</h4>
      <p class="ev-headline">
        <strong>{{ fmt(last.pop) }}</strong> hab. en {{ last.year }}
        <span v-if="peak.year !== last.year"> · máximo de {{ fmt(peak.pop) }} en {{ peak.year }} ({{ changeText }})</span>
      </p>

      <div class="ev-chart" ref="chartEl">
        <svg
          :viewBox="`0 0 ${W} ${H}`"
          class="ev-svg"
          role="img"
          :aria-label="`Población de ${townName} de ${first.year} a ${last.year}: de ${fmt(first.pop)} a ${fmt(last.pop)} habitantes, con un máximo de ${fmt(peak.pop)} en ${peak.year}.`"
          tabindex="0"
          @pointermove="onMove"
          @pointerleave="hover = null"
          @keydown.left.prevent="step(-1)"
          @keydown.right.prevent="step(1)"
          @blur="hover = null"
        >
          <!-- Rejilla discreta -->
          <g class="ev-grid">
            <g v-for="t in yTicks" :key="t">
              <line :x1="PAD.l" :x2="W - PAD.r" :y1="y(t)" :y2="y(t)" />
              <text :x="PAD.l - 6" :y="y(t) + 3" text-anchor="end">{{ short(t) }}</text>
            </g>
            <text v-for="yr in xTicks" :key="yr" :x="x(yr)" :y="H - 4" text-anchor="middle">{{ yr }}</text>
          </g>
          <path :d="areaPath" class="ev-area" />
          <path :d="linePath" class="ev-line" />
          <!-- Etiquetas selectivas: el máximo y el último censo -->
          <circle :cx="x(peak.year)" :cy="y(peak.pop)" r="3.5" class="ev-dot" />
          <circle :cx="x(last.year)" :cy="y(last.pop)" r="3.5" class="ev-dot" />
          <!-- Puntero -->
          <g v-if="hover">
            <line :x1="x(hover.year)" :x2="x(hover.year)" :y1="PAD.t" :y2="H - PAD.b" class="ev-cross" />
            <circle :cx="x(hover.year)" :cy="y(hover.pop)" r="5" class="ev-marker" />
          </g>
        </svg>
        <div
          v-if="hover"
          class="ev-tooltip"
          :style="{ left: `${(x(hover.year) / W) * 100}%`, top: `${(y(hover.pop) / H) * 100}%` }"
          role="status"
        >
          <strong>{{ hover.year }}</strong> · {{ fmt(hover.pop) }} hab.
        </div>
      </div>

      <details class="ev-details">
        <summary>Ver los datos</summary>
        <table class="ev-table">
          <caption class="visually-hidden">Población de {{ townName }} por censo</caption>
          <thead><tr><th scope="col">Censo</th><th scope="col">Habitantes</th></tr></thead>
          <tbody>
            <tr v-for="p in series" :key="p.year"><td>{{ p.year }}</td><td>{{ fmt(p.pop) }}</td></tr>
          </tbody>
        </table>
        <ul v-if="notes.length" class="ev-notes">
          <li v-for="(n, i) in notes" :key="i">{{ n }}</li>
        </ul>
      </details>
      <p class="ev-source">
        Fuente: <a href="https://www.ine.es/intercensal/" target="_blank" rel="noopener noreferrer">INE, censos de población desde 1842</a>
      </p>
    </section>

    <!-- Antes y ahora desde el aire (IGN) -->
    <section v-if="lat && lon" class="ev-block" aria-labelledby="ev-air-title">
      <h4 id="ev-air-title" class="ev-heading">Desde el aire: antes y ahora</h4>
      <div class="ev-chips" role="group" aria-label="Año de la foto antigua">
        <button
          v-for="f in FLIGHTS"
          :key="f.layer"
          type="button"
          class="ev-chip"
          :aria-pressed="flight.layer === f.layer"
          @click="flight = f"
        >{{ f.label }}</button>
      </div>
      <div class="ev-compare" :style="{ '--pos': `${pos}%` }">
        <img :src="afterUrl" :alt="`Foto aérea actual de ${townName}`" loading="lazy" class="ev-img" />
        <img :key="flight.layer" :src="beforeUrl" :alt="`Foto aérea de ${townName} en ${flight.label}`" loading="lazy" class="ev-img ev-before" />
        <span class="ev-tag left">{{ flight.label }}</span>
        <span class="ev-tag right">Hoy</span>
        <span class="ev-handle" aria-hidden="true"></span>
        <label class="visually-hidden" for="ev-range">Deslizar entre {{ flight.label }} y hoy</label>
        <input id="ev-range" v-model.number="pos" type="range" min="0" max="100" class="ev-range" />
      </div>
      <p class="ev-source">
        Ortofotos: <a href="https://www.ign.es/" target="_blank" rel="noopener noreferrer">© Instituto Geográfico Nacional</a> (PNOA, CC BY 4.0) · Desliza para comparar
      </p>
    </section>
  </div>
</template>

<script>
import { computed, ref, watch } from 'vue'
import { loadPoblacion } from '@/utils/poblacion'

// Vuelos históricos del IGN (servicio WMS pnoa-historico) y el PNOA actual
const FLIGHTS = [
  { layer: 'AMS_1956-1957', label: '1956' },
  { layer: 'Interministerial_1973-1986', label: '1973-86' }
]
const HALF = 1500 // metros desde el centro del pueblo (3 km de lado)
const PX = 512

// Recuadro en Web Mercator (EPSG:3857): en EPSG:4326 los dos servicios no coinciden en el orden de los ejes
function bbox3857(lat, lon) {
  const R = 6378137
  const x = R * lon * Math.PI / 180
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2))
  const h = HALF / Math.cos(lat * Math.PI / 180)
  return `${x - h},${y - h},${x + h},${y + h}`
}
const wms = (base, layer, lat, lon) =>
  `${base}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${layer}&STYLES=&CRS=EPSG:3857&BBOX=${bbox3857(lat, lon)}&WIDTH=${PX}&HEIGHT=${PX}&FORMAT=image/jpeg`

export default {
  name: 'TownEvolution',
  props: {
    ine: { type: String, default: null },
    townName: { type: String, default: '' },
    lat: { type: Number, default: null },
    lon: { type: Number, default: null }
  },
  setup(props) {
    // ---------- Población ----------
    const W = 320, H = 170
    const PAD = { l: 40, r: 10, t: 10, b: 20 }
    const data = ref(null)
    loadPoblacion().then(d => { data.value = d })

    const series = computed(() => {
      const t = data.value?.towns?.[props.ine]
      if (!t) return []
      return data.value.years.map((year, i) => ({ year, pop: t.pop[i] })).filter(p => p.pop != null)
    })
    const notes = computed(() => data.value?.towns?.[props.ine]?.notes || [])
    const first = computed(() => series.value[0] || { year: 0, pop: 0 })
    const last = computed(() => series.value[series.value.length - 1] || { year: 0, pop: 0 })
    const peak = computed(() => series.value.reduce((a, b) => (b.pop > a.pop ? b : a), first.value))
    const changeText = computed(() => {
      const pct = Math.round(((last.value.pop - peak.value.pop) / peak.value.pop) * 100)
      return `${pct > 0 ? '+' : ''}${pct} % desde entonces`
    })

    // Escala del eje: de 0 a un máximo "redondo"
    const yMax = computed(() => {
      const m = Math.max(...series.value.map(p => p.pop), 1)
      const mag = Math.pow(10, Math.floor(Math.log10(m)))
      return Math.ceil(m / mag) * mag
    })
    const yTicks = computed(() => [0, yMax.value / 2, yMax.value])
    const xTicks = computed(() => (series.value.length ? [first.value.year, 1900, 1950, last.value.year].filter((v, i, a) => a.indexOf(v) === i && v >= first.value.year && v <= last.value.year) : []))
    const x = (year) => PAD.l + ((year - first.value.year) / Math.max(1, last.value.year - first.value.year)) * (W - PAD.l - PAD.r)
    const y = (v) => PAD.t + (1 - v / yMax.value) * (H - PAD.t - PAD.b)
    const linePath = computed(() => series.value.map((p, i) => `${i ? 'L' : 'M'}${x(p.year).toFixed(1)},${y(p.pop).toFixed(1)}`).join(''))
    const areaPath = computed(() => series.value.length
      ? `${linePath.value}L${x(last.value.year).toFixed(1)},${y(0)}L${x(first.value.year).toFixed(1)},${y(0)}Z`
      : '')

    const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('es-ES'))
    const short = (n) => (n >= 1000 ? `${(n / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} mil` : String(n))

    // Puntero: el censo más cercano al ratón; con el teclado, flechas
    const hover = ref(null)
    const chartEl = ref(null)
    const onMove = (ev) => {
      const r = ev.currentTarget.getBoundingClientRect()
      const vx = ((ev.clientX - r.left) / r.width) * W
      hover.value = series.value.reduce((best, p) => (Math.abs(x(p.year) - vx) < Math.abs(x(best.year) - vx) ? p : best), series.value[0])
    }
    const step = (d) => {
      const i = hover.value ? series.value.indexOf(hover.value) : (d > 0 ? -1 : series.value.length)
      hover.value = series.value[Math.min(series.value.length - 1, Math.max(0, i + d))]
    }
    watch(() => props.ine, () => { hover.value = null })

    // ---------- Fotos aéreas ----------
    const flight = ref(FLIGHTS[0])
    const pos = ref(50)
    watch(() => props.ine, () => { pos.value = 50 })
    const beforeUrl = computed(() => wms('https://www.ign.es/wms/pnoa-historico', flight.value.layer, props.lat, props.lon))
    const afterUrl = computed(() => wms('https://www.ign.es/wms-inspire/pnoa-ma', 'OI.OrthoimageCoverage', props.lat, props.lon))

    return {
      W, H, PAD, series, notes, first, last, peak, changeText, yTicks, xTicks, x, y, linePath, areaPath, fmt, short,
      hover, chartEl, onMove, step, FLIGHTS, flight, pos, beforeUrl, afterUrl
    }
  }
}
</script>

<style scoped>
.evolution {
  /* Color de la serie validado (dataviz): claro sobre blanco, oscuro sobre #1a1a1a */
  --ev-series: #b06f0a;
  font-size: 0.9rem;
}
.ev-block {
  margin-bottom: 1.1rem;
}
.ev-heading {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary, #5f6b77);
}
.ev-headline {
  margin: 0 0 0.4rem;
  color: var(--text-secondary, #555);
}
.ev-headline strong {
  font-size: 1.15rem;
  color: var(--text-primary, #222);
}
.ev-chart {
  position: relative;
}
.ev-svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  touch-action: pan-y;
  /* global.css da fondo, borde y sombra a todos los svg */
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}
.ev-svg:focus-visible {
  outline: 2px solid var(--ev-series);
  outline-offset: 2px;
}
.ev-grid line {
  stroke: var(--border-primary, #e0e0e0);
  stroke-width: 1;
}
.ev-grid text {
  font-size: 9px;
  fill: var(--text-secondary, #666);
}
.ev-area {
  fill: var(--ev-series);
  opacity: 0.14;
}
.ev-line {
  fill: none;
  stroke: var(--ev-series);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.ev-dot {
  fill: var(--ev-series);
  stroke: var(--bg-primary, #fff);
  stroke-width: 2;
}
.ev-cross {
  stroke: var(--text-secondary, #888);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.ev-marker {
  fill: var(--ev-series);
  stroke: var(--bg-primary, #fff);
  stroke-width: 2;
}
.ev-tooltip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 10px));
  background: var(--text-primary, #222);
  color: var(--bg-primary, #fff);
  font-size: 0.75rem;
  padding: 3px 8px;
  border-radius: 6px;
  white-space: nowrap;
  pointer-events: none;
}
.ev-details {
  margin-top: 4px;
  font-size: 0.8rem;
}
.ev-details summary {
  cursor: pointer;
  color: var(--text-secondary, #666);
}
.ev-table {
  border-collapse: collapse;
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}
.ev-table th,
.ev-table td {
  padding: 1px 12px 1px 0;
  text-align: right;
}
.ev-table th:first-child,
.ev-table td:first-child {
  text-align: left;
}
.ev-notes {
  margin: 6px 0 0;
  padding-left: 16px;
  color: var(--text-secondary, #666);
}
.ev-source {
  margin: 4px 0 0;
  font-size: 0.72rem;
  opacity: 0.8;
}

/* Comparador de fotos aéreas */
.ev-chips {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}
.ev-chip {
  border: 1px solid var(--border-primary, #ddd);
  background: var(--bg-primary, #fff);
  color: inherit;
  border-radius: 999px;
  padding: 2px 10px;
  font: inherit;
  font-size: 0.78rem;
  cursor: pointer;
}
.ev-chip[aria-pressed="true"] {
  background: var(--text-primary, #222);
  color: var(--bg-primary, #fff);
  border-color: var(--text-primary, #222);
}
.ev-compare {
  position: relative;
  aspect-ratio: 1;
  border-radius: 10px;
  overflow: hidden;
  background: var(--bg-secondary, #eee);
}
.ev-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
/* La foto antigua se recorta desde la derecha hasta la posición del deslizador */
.ev-before {
  clip-path: inset(0 calc(100% - var(--pos)) 0 0);
}
.ev-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--pos);
  width: 3px;
  margin-left: -1.5px;
  background: #fff;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}
.ev-handle::after {
  content: '⇆';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #fff;
  color: #333;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
}
.ev-tag {
  position: absolute;
  top: 8px;
  padding: 1px 8px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  pointer-events: none;
}
.ev-tag.left { left: 8px; }
.ev-tag.right { right: 8px; }
/* El deslizador invisible ocupa toda la foto: se arrastra en cualquier punto */
.ev-range {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: ew-resize;
}
.ev-compare:focus-within .ev-handle {
  background: var(--primary-color, #4caf50);
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>

<style>
/* Modo oscuro: tono de la serie validado contra el fondo oscuro */
[data-theme="dark"] .evolution {
  --ev-series: #b8842a;
}
</style>
