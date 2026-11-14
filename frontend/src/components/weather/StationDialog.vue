<template>
  <Teleport to="body">
    <div class="wxd-overlay" role="dialog" aria-modal="true" :aria-label="`Estación ${station.name}`" @click.self="$emit('close')" @keydown.esc="$emit('close')">
      <article ref="panel" class="wxd" tabindex="-1">
        <header class="wxd-head">
          <button type="button" class="wxd-close" aria-label="Cerrar" @click="$emit('close')">✕</button>
          <p class="wxd-kicker">
            <span class="wxd-net" :class="station.network">{{ net.label }}</span> Estación {{ net.kind.toLowerCase() }}
          </p>
          <h2 class="wxd-title">{{ niceName }}</h2>
          <p class="wxd-sub">
            {{ station.municipality?.name }}<template v-if="station.altitude"> · {{ station.altitude }} m</template>
            · <span :class="{ stale: !fresh }">{{ fresh ? 'Actualizada' : 'Último dato' }} {{ ago(station.lastObservationAt) }}</span>
          </p>
          <p v-if="station.approximateLocation" class="wxd-note">Ubicación aproximada: el centro del municipio (la red no publica las coordenadas).</p>
        </header>

        <!-- Últimos valores -->
        <section class="wxd-tiles" aria-label="Últimos valores">
          <div v-for="t in tiles" :key="t.variable" class="wxd-tile">
            <span class="wxd-tile-label">{{ t.label }}</span>
            <strong>{{ t.value }}</strong>
            <small>{{ t.note }}</small>
          </div>
          <p v-if="!tiles.length && !loading" class="wxd-empty">Esta estación no tiene datos recientes.</p>
        </section>

        <!-- Gráfico -->
        <section class="wxd-chart">
          <div class="wxd-controls">
            <div class="wxd-seg" role="group" aria-label="Variable">
              <button v-for="v in variables" :key="v.id" type="button" :class="{ on: variable === v.id }" :aria-pressed="variable === v.id" @click="variable = v.id">{{ v.label }}</button>
            </div>
            <div class="wxd-seg" role="group" aria-label="Periodo">
              <button v-for="p in PERIODS" :key="p.id" type="button" :class="{ on: period === p.id }" :aria-pressed="period === p.id" @click="period = p.id">{{ p.label }}</button>
            </div>
          </div>
          <p v-if="historyLoading" class="wxd-empty">Cargando…</p>
          <WeatherChart
            v-else-if="chart"
            :series="chart.series"
            :band="chart.band"
            :format="(v) => fmtValue(variable, v)"
            :resolution="period === '30d' ? 'day' : 'hour'"
            :zero-based="variable === 'precipitation' || variable === 'relative_humidity'"
            :height="230"
          />
          <p v-if="history?.to" class="wxd-note">
            {{ periodNote }}<template v-if="station.network === 'inforiego'"> InfoRiego publica cada día los datos del día anterior.</template>
          </p>
          <details v-if="chart && chart.rows.length" class="wxd-table">
            <summary>Ver los datos en tabla</summary>
            <table>
              <thead><tr><th>Fecha</th><th v-for="c in chart.cols" :key="c">{{ c }}</th></tr></thead>
              <tbody><tr v-for="r in chart.rows" :key="r.t"><td>{{ r.t }}</td><td v-for="(c, i) in r.cells" :key="i">{{ c }}</td></tr></tbody>
            </table>
          </details>
        </section>

        <footer class="wxd-foot">
          <span v-if="station.network === 'meteoclimatic'">Hora aproximada: la tabla de Meteoclimatic no da la hora de cada estación.</span>
          <span v-for="a in attribution" :key="a.source">
            {{ a.attribution }}<template v-if="a.license && !/Pendiente/.test(a.license)"> · {{ a.license }}</template> ·
            <a :href="station.sourceUrl || a.url" target="_blank" rel="noopener">fuente</a>
          </span>
        </footer>
      </article>
    </div>
  </Teleport>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import WeatherChart from './WeatherChart.vue'
import { weatherApi, NETWORKS, ago, isRecent, fmtValue, compass, aggregationNote, VARIABLE_LABELS, dateTime, dayLong } from '@/utils/weather'

const PERIODS = [{ id: '24h', label: '24 h' }, { id: '7d', label: '7 días' }, { id: '30d', label: '30 días' }]
const CHARTABLE = ['temperature', 'relative_humidity', 'precipitation', 'wind_speed', 'pressure', 'pressure_msl', 'solar_radiation']
const TILE_ORDER = ['temperature', 'temperature_max', 'temperature_min', 'relative_humidity', 'wind_speed', 'wind_gust', 'precipitation', 'pressure', 'pressure_msl', 'solar_radiation']

export default {
  name: 'StationDialog',
  components: { WeatherChart },
  props: { station: { type: Object, required: true } },
  emits: ['close'],
  setup(props) {
    const panel = ref(null)
    const latest = ref({})
    const attribution = ref([])
    const loading = ref(true)
    const variable = ref('temperature')
    const period = ref('24h')
    const history = ref(null)
    const historyLoading = ref(false)

    const net = computed(() => NETWORKS[props.station.network] || { label: props.station.network, kind: '' })
    const niceName = computed(() => (/[a-z]/.test(props.station.name) ? props.station.name
      : props.station.name.toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Del|La|Las|Los|El|Y)\b/g, w => w.toLowerCase())))
    const fresh = computed(() => isRecent(props.station.lastObservationAt, 3))

    const tiles = computed(() => TILE_ORDER.filter(v => latest.value[v]).map(v => {
      const o = latest.value[v]
      let value = fmtValue(v, o.value)
      if (v === 'wind_speed' && latest.value.wind_direction) value += ` ${compass(latest.value.wind_direction.value)}`
      return { variable: v, label: VARIABLE_LABELS[v], value, note: [aggregationNote(o), dateTime(o.observedAt)].filter(Boolean).join(' · ') }
    }))
    const variables = computed(() => {
      const have = new Set([...Object.keys(latest.value), ...(Array.isArray(props.station.variables) ? props.station.variables : Object.keys(props.station.variables || {}))])
      return CHARTABLE.filter(v => have.has(v)).map(id => ({ id, label: VARIABLE_LABELS[id] }))
    })

    async function loadLatest() {
      loading.value = true
      try {
        const r = await weatherApi.latest(props.station.id)
        latest.value = r.variables || {}
        attribution.value = r.attribution || []
      } catch { latest.value = {} }
      loading.value = false
    }
    async function loadHistory() {
      historyLoading.value = true
      try { history.value = await weatherApi.history(props.station.id, variable.value, period.value) } catch { history.value = null }
      historyLoading.value = false
    }
    watch([variable, period], loadHistory)
    watch(() => props.station.id, () => { loadLatest(); loadHistory() })
    onMounted(() => { loadLatest(); loadHistory(); panel.value?.focus() })

    // Serie única (sin leyenda: el título del control la nombra). 30 días: media + banda mín.–máx.
    const color = computed(() => (document.documentElement.getAttribute('data-theme') === 'dark' ? '#3987e5' : '#2a78d6'))
    const chart = computed(() => {
      const h = history.value
      if (!h?.points) return null
      const isPrecip = variable.value === 'precipitation'
      if (h.period === '24h') {
        const pts = h.points.map(p => ({ t: p.t, v: p.v }))
        return {
          series: [{ id: 'v', label: VARIABLE_LABELS[variable.value], color: color.value, kind: isPrecip ? 'bar' : 'line', points: pts }],
          band: null,
          cols: [VARIABLE_LABELS[variable.value]],
          rows: pts.map(p => ({ t: dateTime(p.t), cells: [fmtValue(variable.value, p.v)] }))
        }
      }
      const pts = h.points.map(p => ({ t: p.t, v: isPrecip ? p.sum : p.mean, min: p.min, max: p.max }))
      const daily = h.period === '30d'
      return {
        series: [{ id: 'v', label: isPrecip ? 'Total' : 'Media', color: color.value, kind: isPrecip ? 'bar' : 'line', points: pts }],
        band: daily && !isPrecip ? { color: color.value, points: pts } : null,
        cols: isPrecip ? ['Total'] : ['Media', 'Mínima', 'Máxima'],
        rows: pts.map(p => ({ t: daily ? dayLong(p.t) : dateTime(p.t), cells: isPrecip ? [fmtValue(variable.value, p.v)] : [p.v, p.min, p.max].map(v => fmtValue(variable.value, v)) }))
      }
    })
    const periodNote = computed(() => {
      const h = history.value
      if (!h) return ''
      return `${h.resolution === 'original' ? 'Valores tal como los da la estación' : h.resolution === 'hora' ? 'Medias por hora' : 'Por días (media, mínima y máxima)'}, hasta ${dateTime(h.to)}.`
    })

    return { panel, latest, attribution, loading, variable, period, history, historyLoading, net, niceName, fresh, tiles, variables, chart, periodNote, PERIODS, ago, fmtValue }
  }
}
</script>

<style scoped>
.wxd-overlay {
  position: fixed;
  inset: 0;
  z-index: 10003;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(12, 16, 22, 0.55);
  backdrop-filter: blur(6px);
  animation: wxd-fade 0.2s ease both;
}
.wxd {
  --ink: #16202a;
  --ink-soft: #5b6670;
  --paper: #f7f9fb;
  --card: #ffffff;
  --line: rgba(22, 32, 42, 0.1);
  --accent: #1c5cab;
  width: min(820px, 100%);
  max-height: min(92vh, 920px);
  overflow-y: auto;
  border-radius: 22px;
  color: var(--ink);
  background: var(--paper);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
  outline: none;
  animation: wxd-rise 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
}
.wxd-head {
  position: relative;
  padding: 24px 24px 8px;
}
.wxd-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  color: var(--ink);
  background: var(--line);
  cursor: pointer;
}
.wxd-kicker {
  margin: 0 0 4px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.wxd-net {
  display: inline-block;
  margin-right: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  color: #fff;
  background: #1c5cab;
}
.wxd-net.inforiego { background: #2d6a3e; }
.wxd-net.meteoclimatic { background: #6b4f9c; }
.wxd-title {
  margin: 0;
  padding-right: 40px;
  font-size: clamp(1.3rem, 3vw, 1.8rem);
  font-weight: 800;
  color: var(--ink);
}
.wxd-sub {
  margin: 4px 0 0;
  font-size: 0.9rem;
  color: var(--ink-soft);
}
.wxd-sub .stale {
  font-weight: 700;
  color: #a35a00;
}
.wxd-note {
  margin: 6px 0 0;
  font-size: 0.78rem;
  color: var(--ink-soft);
}
.wxd-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
  padding: 12px 24px 0;
}
.wxd-tile {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 12px;
  border-radius: 14px;
  background: var(--card);
  box-shadow: 0 1px 0 var(--line);
}
.wxd-tile-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.wxd-tile strong {
  font-size: 1.25rem;
  font-variant-numeric: tabular-nums;
}
.wxd-tile small {
  font-size: 0.72rem;
  color: var(--ink-soft);
}
.wxd-chart {
  margin: 14px 24px 0;
  padding: 16px;
  border-radius: 16px;
  background: var(--card);
  box-shadow: 0 1px 0 var(--line);
}
.wxd-controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.wxd-seg {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.wxd-seg button {
  padding: 5px 11px;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink);
  background: var(--paper);
  cursor: pointer;
}
.wxd-seg button.on {
  color: #fff;
  border-color: var(--accent);
  background: var(--accent);
}
.wxd-empty {
  margin: 0;
  padding: 24px 0;
  text-align: center;
  font-size: 0.85rem;
  color: var(--ink-soft);
}
.wxd-table {
  margin-top: 10px;
  font-size: 0.82rem;
}
.wxd-table summary {
  cursor: pointer;
  color: var(--accent);
  font-weight: 600;
}
.wxd-table table {
  width: 100%;
  margin-top: 8px;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
.wxd-table th,
.wxd-table td {
  padding: 4px 6px;
  border-bottom: 1px solid var(--line);
  text-align: left;
}
.wxd-foot {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 14px 24px 20px;
  font-size: 0.74rem;
  color: var(--ink-soft);
}
.wxd-foot a {
  color: inherit;
}
@keyframes wxd-fade { from { opacity: 0; } }
@keyframes wxd-rise { from { opacity: 0; transform: translateY(30px) scale(0.97); } }
@media (prefers-reduced-motion: reduce) {
  .wxd, .wxd-overlay { animation: none; }
}
@media (max-width: 640px) {
  .wxd-overlay { padding: 0; }
  .wxd { width: 100%; height: 100dvh; max-height: 100dvh; border-radius: 0; }
  .wxd-head { padding: 20px 16px 8px; }
  .wxd-tiles { padding: 12px 16px 0; grid-template-columns: 1fr 1fr; }
  .wxd-chart { margin: 14px 16px 0; padding: 12px; }
  .wxd-foot { margin: 14px 16px 20px; }
}
</style>

<style>
[data-theme='dark'] .wxd {
  --ink: #eef2f6;
  --ink-soft: #a9b4be;
  --paper: #161b21;
  --card: #1f262e;
  --line: rgba(255, 255, 255, 0.1);
  --accent: #3987e5;
}
[data-theme='dark'] .wxd .wxd-sub .stale { color: #f0a54a; }
</style>
