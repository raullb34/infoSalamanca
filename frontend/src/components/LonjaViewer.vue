<template>
  <div v-if="isOpen" class="lonja-overlay" @click.self="$emit('close')">
    <section
      class="lonja"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lonja-title"
      tabindex="-1"
      ref="dialogEl"
      @keydown.esc="$emit('close')"
    >
      <header class="lonja-head">
        <div>
          <h2 id="lonja-title">Lonja de Salamanca</h2>
          <p>Cotizaciones de cada lunes desde 2005<span v-if="updatedText"> · actualizado {{ updatedText }}</span></p>
        </div>
        <button type="button" class="lonja-close" aria-label="Cerrar" @click="$emit('close')">✕</button>
      </header>

      <div v-if="error" class="lonja-error">{{ error }}</div>
      <div v-else-if="!products.length" class="lonja-loading">Cargando cotizaciones…</div>

      <div v-else class="lonja-body">
        <!-- Productos: buscador y lista por mesa -->
        <aside class="lonja-side" :class="{ open: listOpen }">
          <button type="button" class="lonja-side-close" @click="listOpen = false">← Ver la gráfica</button>
          <label class="visually-hidden" for="lonja-search">Buscar producto</label>
          <input id="lonja-search" v-model="query" type="search" class="lonja-search" placeholder="Buscar: trigo, lechazo, añojo, jamón…" />
          <label class="lonja-check"><input v-model="onlyActive" type="checkbox" /> Solo los que siguen cotizando</label>
          <p class="lonja-hint">Elige hasta 4 para comparar</p>
          <div class="lonja-list">
            <section v-for="g in groups" :key="g.mesa">
              <h3 class="lonja-mesa">{{ g.mesa }}</h3>
              <button
                v-for="p in g.items"
                :key="p.id"
                type="button"
                class="lonja-item"
                :class="{ selected: isSelected(p.id) }"
                :aria-pressed="isSelected(p.id)"
                @click="toggle(p)"
              >
                <span class="lonja-dot" :style="{ background: colorOf(p.id) || 'transparent' }" aria-hidden="true"></span>
                <span class="lonja-item-name">
                  {{ nameOf(p) }}
                  <small v-if="!p.active">hasta {{ fmtDate(p.last) }}</small>
                </span>
                <span class="lonja-item-price">
                  {{ fmtPrice(p.lastPrice) }} <small>{{ p.unit }}</small>
                  <small v-if="p.active && p.weekChange != null" class="lonja-change" :class="changeClass(p.weekChange)">{{ arrow(p.weekChange) }} {{ fmtPct(p.weekChange) }}</small>
                </span>
              </button>
            </section>
            <p v-if="!groups.length" class="lonja-empty">No hay productos con «{{ query }}».</p>
          </div>
        </aside>

        <!-- Gráfica y análisis -->
        <div class="lonja-main">
          <button type="button" class="lonja-list-toggle" @click="listOpen = true">Elegir productos ({{ selected.length }}/4)</button>

          <div v-if="!selected.length" class="lonja-empty">Elige un producto de la lista para ver su evolución.</div>
          <template v-else>
            <!-- Leyenda: los productos elegidos (también se quitan desde aquí) -->
            <ul class="lonja-legend" aria-label="Productos en la gráfica">
              <li v-for="s in shown" :key="s.id">
                <span class="lonja-swatch" :style="{ background: s.color }" aria-hidden="true"></span>
                {{ nameOf(s) }} <small>({{ s.unit }})</small>
                <button type="button" class="lonja-remove" :aria-label="`Quitar ${nameOf(s)}`" @click="remove(s.id)">✕</button>
              </li>
            </ul>

            <div class="lonja-controls">
              <div class="lonja-seg" role="group" aria-label="Periodo">
                <button v-for="r in RANGES" :key="r.key" type="button" :aria-pressed="range === r.key" @click="range = r.key">{{ r.label }}</button>
              </div>
              <div class="lonja-seg" role="group" aria-label="Escala">
                <button type="button" :aria-pressed="!indexed" :disabled="mixedUnits" @click="forceIndex = false">Precio</button>
                <button type="button" :aria-pressed="indexed" @click="forceIndex = true">Índice (base 100)</button>
              </div>
            </div>
            <p v-if="mixedUnits" class="lonja-note">Tienen unidades distintas, así que se comparan como índice: 100 = su precio al principio del periodo.</p>

            <!-- Gráfica de líneas con un solo eje; la previsión, discontinua -->
            <div class="lonja-chart" ref="chartEl">
              <svg
                :viewBox="`0 0 ${W} ${H}`"
                class="lonja-svg"
                role="img"
                :aria-label="chartLabel"
                tabindex="0"
                @pointermove="onMove"
                @pointerleave="hoverIdx = null"
                @keydown.left.prevent="stepHover(-1)"
                @keydown.right.prevent="stepHover(1)"
                @blur="hoverIdx = null"
              >
                <g class="lonja-grid">
                  <g v-for="t in yTicks" :key="`y${t}`">
                    <line :x1="PAD.l" :x2="W - PAD.r" :y1="y(t)" :y2="y(t)" />
                    <text :x="PAD.l - 6" :y="y(t) + 4" text-anchor="end">{{ fmtTick(t) }}</text>
                  </g>
                  <text v-for="t in xTicks" :key="`x${t.t}`" :x="x(t.t)" :y="H - 6" text-anchor="middle">{{ t.label }}</text>
                </g>
                <!-- Banda de la previsión (solo con un producto, para no emborronar) -->
                <path v-if="bandPath" :d="bandPath" class="lonja-band" :style="{ fill: shown[0].color }" />
                <line v-if="forecastStartX" :x1="forecastStartX" :x2="forecastStartX" :y1="PAD.t" :y2="H - PAD.b" class="lonja-today" />
                <g v-for="s in plotted" :key="s.id">
                  <path :d="s.path" class="lonja-line" :style="{ stroke: s.color }" />
                  <path v-if="s.forecastPath" :d="s.forecastPath" class="lonja-line lonja-forecast" :style="{ stroke: s.color }" />
                  <!-- Etiqueta directa: último valor -->
                  <circle v-if="s.lastPt" :cx="s.lastPt.x" :cy="s.lastPt.y" r="4" class="lonja-end" :style="{ fill: s.color }" />
                </g>
                <g v-if="hoverRow">
                  <line :x1="hoverRow.x" :x2="hoverRow.x" :y1="PAD.t" :y2="H - PAD.b" class="lonja-cross" />
                  <circle v-for="v in hoverRow.values" :key="v.id" :cx="hoverRow.x" :cy="y(v.plot)" r="5" class="lonja-marker" :style="{ fill: v.color }" />
                </g>
              </svg>
              <div v-if="hoverRow" class="lonja-tooltip" :style="tooltipStyle">
                <strong>{{ fmtDate(hoverRow.date) }}{{ hoverRow.forecast ? ' · previsión' : '' }}</strong>
                <span v-for="v in hoverRow.values" :key="v.id">
                  <i :style="{ background: v.color }"></i>{{ nameOf(v) }}: {{ fmtPrice(v.price) }} {{ v.unit }}<template v-if="indexed"> ({{ fmtIndex(v.plot) }})</template>
                </span>
              </div>
              <p class="lonja-chart-note">Línea continua: cotizaciones · discontinua: previsión a 8 semanas<span v-if="bandPath"> · banda: margen probable (80 %)</span></p>
            </div>

            <!-- Una tarjeta por producto -->
            <div class="lonja-cards">
              <article v-for="s in shown" :key="s.id" class="lonja-card" :style="{ '--c': s.color }">
                <h3>{{ nameOf(s) }}</h3>
                <p class="lonja-big">{{ fmtPrice(s.lastPrice) }} <small>{{ s.unit }}</small></p>
                <p class="lonja-sub">{{ fmtDate(s.last) }}</p>
                <dl>
                  <div v-if="s.weekChange != null"><dt>Última semana</dt><dd :class="changeClass(s.weekChange)">{{ arrow(s.weekChange) }} {{ fmtPct(s.weekChange) }}</dd></div>
                  <div v-if="s.yearChange != null"><dt>En un año</dt><dd :class="changeClass(s.yearChange)">{{ arrow(s.yearChange) }} {{ fmtPct(s.yearChange) }}</dd></div>
                  <div v-if="s.trend"><dt>Tendencia (6 meses)</dt><dd>{{ trendText(s.trend) }}</dd></div>
                  <div v-if="s.forecast"><dt>Previsión a 8 semanas</dt><dd>{{ fmtPrice(lastOf(s.forecast.points).p) }} {{ s.unit }} <small>({{ fmtPrice(lastOf(s.forecast.points).lo) }}–{{ fmtPrice(lastOf(s.forecast.points).hi) }})</small></dd></div>
                </dl>
                <p v-if="s.seasonality" class="lonja-season">{{ seasonText(s.seasonality) }}</p>
              </article>
            </div>

            <details class="lonja-details">
              <summary>Ver los datos (últimas 12 sesiones)</summary>
              <table class="lonja-table">
                <thead>
                  <tr><th scope="col">Fecha</th><th v-for="s in shown" :key="s.id" scope="col">{{ nameOf(s) }} ({{ s.unit }})</th></tr>
                </thead>
                <tbody>
                  <tr v-for="row in tableRows" :key="row.date">
                    <td>{{ fmtDate(row.date) }}</td>
                    <td v-for="(v, i) in row.values" :key="i">{{ v == null ? '—' : fmtPrice(v) }}</td>
                  </tr>
                </tbody>
              </table>
            </details>
          </template>

          <p class="lonja-foot">
            Fuente: <a :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.name }}</a> ({{ source.license }}).
            Precio = centro de la horquilla de cada sesión. Unidades deducidas de la tabla. La tendencia y la previsión salen de modelos
            estadísticos sencillos (mínimos cuadrados y suavizado exponencial): son orientativas, no una recomendación.
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { apiService } from '@/services/apiService'

// Paleta validada (dataviz): 4 colores en orden fijo; en modo oscuro, sus pasos para fondo oscuro
const COLORS = { light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'], dark: ['#3987e5', '#d95926', '#199e70', '#c98500'] }
const RANGES = [
  { key: '6m', label: '6 meses', weeks: 26 },
  { key: '1a', label: '1 año', weeks: 52 },
  { key: '5a', label: '5 años', weeks: 260 },
  { key: 'all', label: 'Todo', weeks: Infinity }
]
const DEFAULT_IDS = ['cereales-cereales-trigo-blando-p-e-72-kg-hl', 'ovino-lechazo-11-01-a-13-kg']
const MAX = 4
const DAY = 86400000

const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default {
  name: 'LonjaViewer',
  props: { isOpen: { type: Boolean, default: false } },
  emits: ['close'],
  setup(props) {
    const dialogEl = ref(null)
    const products = ref([])
    const updated = ref(null)
    const source = ref({ name: 'Lonja Agropecuaria de Salamanca', url: 'https://datosabiertossalamanca.es/', license: 'CC BY 4.0' })
    const error = ref('')
    const query = ref('')
    const onlyActive = ref(true)
    const listOpen = ref(false)
    const range = ref('1a')
    const forceIndex = ref(false)
    const selected = ref([]) // ids en el orden en que se eligieron (fija su color)
    const cache = reactive({}) // id → serie con puntos y análisis

    const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark'
    const palette = ref(isDark() ? COLORS.dark : COLORS.light)
    const onTheme = () => { palette.value = isDark() ? COLORS.dark : COLORS.light }
    window.addEventListener('themeChanged', onTheme)
    onBeforeUnmount(() => window.removeEventListener('themeChanged', onTheme))

    // ---------- Carga ----------
    async function loadProducts() {
      if (products.value.length) return
      const res = await apiService.getLonjaProducts()
      if (!res?.success) { error.value = res?.error || 'No se han podido cargar las cotizaciones.'; return }
      products.value = res.products
      updated.value = res.updated
      if (res.source) source.value = res.source
      if (!selected.value.length) selected.value = DEFAULT_IDS.filter(id => res.products.some(p => p.id === id))
    }
    async function loadSeries(ids) {
      const missing = ids.filter(id => !cache[id])
      if (!missing.length) return
      const res = await apiService.getLonjaSeries(missing)
      if (!res?.success) { error.value = res?.error || 'No se han podido cargar las cotizaciones.'; return }
      for (const s of res.series) {
        cache[s.id] = { ...s, points: s.points.map(([d, p]) => ({ t: new Date(d).getTime(), d, p })) }
      }
    }
    watch(() => props.isOpen, async (open) => {
      if (!open) return
      await nextTick()
      dialogEl.value?.focus()
      await loadProducts()
    }, { immediate: true })
    watch(selected, (ids) => { if (ids.length) loadSeries(ids) }, { immediate: true })

    // ---------- Lista ----------
    const nameOf = (p) => (plain(p.producto) === plain(p.mesa) || plain(p.producto) === 'cereales' ? p.categoria : `${p.producto} · ${p.categoria}`)
    const groups = computed(() => {
      const q = plain(query.value).trim()
      const out = new Map()
      for (const p of products.value) {
        if (onlyActive.value && !p.active) continue
        if (q && !plain(`${p.mesa} ${p.producto} ${p.categoria}`).includes(q)) continue
        if (!out.has(p.mesa)) out.set(p.mesa, [])
        out.get(p.mesa).push(p)
      }
      return [...out].map(([mesa, items]) => ({ mesa, items }))
    })
    const isSelected = (id) => selected.value.includes(id)
    // Cada producto conserva su color mientras está elegido (el color sigue al producto, no a su posición)
    const slots = reactive({})
    const assignSlot = (id) => {
      if (slots[id] != null) return
      const used = new Set(Object.values(slots))
      slots[id] = [0, 1, 2, 3].find(i => !used.has(i))
    }
    watch(selected, (ids) => {
      for (const id of Object.keys(slots)) if (!ids.includes(id)) delete slots[id]
      ids.forEach(assignSlot)
    }, { immediate: true })
    const colorOf = (id) => (slots[id] != null ? palette.value[slots[id]] : null)
    const toggle = (p) => {
      if (isSelected(p.id)) return remove(p.id)
      if (selected.value.length >= MAX) selected.value = [...selected.value.slice(1), p.id] // sale el más antiguo
      else selected.value = [...selected.value, p.id]
      listOpen.value = false
    }
    const remove = (id) => { selected.value = selected.value.filter(x => x !== id) }

    // ---------- Gráfica ----------
    // El dibujo tiene el ancho real del hueco: así los textos no se encogen en el móvil
    const chartEl = ref(null)
    const W = ref(720)
    const H = computed(() => (W.value < 500 ? 260 : 300))
    let ro = null
    watch(chartEl, (el) => {
      ro?.disconnect()
      if (!el) return
      ro = new ResizeObserver(() => { W.value = Math.max(300, Math.round(el.clientWidth)) })
      ro.observe(el)
    })
    onBeforeUnmount(() => ro?.disconnect())
    const PAD = { l: 52, r: 16, t: 14, b: 26 }
    const shown = computed(() => selected.value.map(id => cache[id] && { ...cache[id], color: colorOf(id) }).filter(Boolean))
    const mixedUnits = computed(() => new Set(shown.value.map(s => s.unit)).size > 1)
    const indexed = computed(() => mixedUnits.value || forceIndex.value)

    const lastT = computed(() => Math.max(...shown.value.map(s => s.points[s.points.length - 1].t), 0))
    const fromT = computed(() => {
      const r = RANGES.find(x => x.key === range.value)
      if (r.weeks === Infinity) return Math.min(...shown.value.map(s => s.points[0].t))
      return lastT.value - r.weeks * 7 * DAY
    })
    const showForecast = computed(() => range.value !== 'all')
    const toT = computed(() => {
      const f = showForecast.value ? Math.max(0, ...shown.value.map(s => (s.forecast ? new Date(s.forecast.points[s.forecast.points.length - 1].d).getTime() : 0))) : 0
      return Math.max(lastT.value, f)
    })

    // Series del periodo, en precio o en índice (100 = primer precio del periodo)
    const series = computed(() => shown.value.map(s => {
      const pts = s.points.filter(p => p.t >= fromT.value)
      const base = pts[0]?.p || 1
      const conv = (v) => (indexed.value ? (v / base) * 100 : v)
      const fc = showForecast.value && s.forecast ? s.forecast.points.map(p => ({ t: new Date(p.d).getTime(), p: conv(p.p), lo: conv(p.lo), hi: conv(p.hi), price: p.p })) : []
      return { ...s, pts: pts.map(p => ({ t: p.t, d: p.d, price: p.p, plot: conv(p.p) })), fc }
    }).filter(s => s.pts.length))

    const yDomain = computed(() => {
      const vals = series.value.flatMap(s => [...s.pts.map(p => p.plot), ...s.fc.flatMap(p => (series.value.length === 1 ? [p.lo, p.hi] : [p.p]))])
      if (!vals.length) return [0, 1]
      let lo = Math.min(...vals), hi = Math.max(...vals)
      if (lo === hi) { lo -= 1; hi += 1 }
      const pad = (hi - lo) * 0.08
      return [lo - pad, hi + pad]
    })
    const x = (t) => PAD.l + ((t - fromT.value) / Math.max(1, toT.value - fromT.value)) * (W.value - PAD.l - PAD.r)
    const y = (v) => PAD.t + (1 - (v - yDomain.value[0]) / (yDomain.value[1] - yDomain.value[0])) * (H.value - PAD.t - PAD.b)

    const niceStep = (span, n) => {
      const raw = span / n
      const mag = Math.pow(10, Math.floor(Math.log10(raw)))
      return [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw)
    }
    const yTicks = computed(() => {
      const [lo, hi] = yDomain.value
      const step = niceStep(hi - lo, 5)
      const out = []
      for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(Math.round(v * 1000) / 1000)
      return out
    })
    const xTicks = computed(() => {
      const span = toT.value - fromT.value
      const out = []
      const d = new Date(fromT.value)
      if (span > 3 * 365 * DAY) {
        const narrow = W.value < 500 ? 2 : 1 // en el móvil, la mitad de marcas
        const stepY = (span > 12 * 365 * DAY ? 4 : span > 6 * 365 * DAY ? 2 : 1) * narrow
        for (let yr = d.getFullYear() + 1; ; yr += stepY) {
          const t = new Date(yr, 0, 1).getTime()
          if (t > toT.value) break
          out.push({ t, label: String(yr) })
        }
      } else {
        const stepM = (span > 14 * 30 * DAY ? 3 : span > 7 * 30 * DAY ? 2 : 1) * (W.value < 500 ? 2 : 1)
        const m = new Date(d.getFullYear(), d.getMonth() + 1, 1)
        for (; m.getTime() <= toT.value; m.setMonth(m.getMonth() + stepM)) {
          out.push({ t: m.getTime(), label: m.toLocaleDateString('es-ES', { month: 'short', ...(m.getMonth() === 0 ? { year: '2-digit' } : {}) }) })
        }
      }
      return out
    })

    const pathOf = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.plot ?? p.p).toFixed(1)}`).join('')
    const plotted = computed(() => series.value.map(s => {
      const last = s.pts[s.pts.length - 1]
      return {
        id: s.id, color: s.color,
        path: pathOf(s.pts),
        forecastPath: s.fc.length ? pathOf([last, ...s.fc.map(p => ({ t: p.t, p: p.p }))]) : '',
        lastPt: { x: x(last.t), y: y(last.plot) }
      }
    }))
    const bandPath = computed(() => {
      if (series.value.length !== 1 || !series.value[0].fc.length) return ''
      const s = series.value[0]
      const last = s.pts[s.pts.length - 1]
      const top = [{ t: last.t, v: last.plot }, ...s.fc.map(p => ({ t: p.t, v: p.hi }))]
      const bottom = [...s.fc.map(p => ({ t: p.t, v: p.lo })).reverse(), { t: last.t, v: last.plot }]
      return [...top, ...bottom].map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('') + 'Z'
    })
    const forecastStartX = computed(() => (series.value.some(s => s.fc.length) ? x(lastT.value) : 0))

    // ---------- Puntero ----------
    // Fechas de todas las series (y de la previsión), para moverse por ellas con el ratón o las flechas
    const timeline = computed(() => {
      const ts = new Set()
      for (const s of series.value) { s.pts.forEach(p => ts.add(p.t)); s.fc.forEach(p => ts.add(p.t)) }
      return [...ts].sort((a, b) => a - b)
    })
    const hoverIdx = ref(null)
    const onMove = (ev) => {
      const r = ev.currentTarget.getBoundingClientRect()
      const vx = ((ev.clientX - r.left) / r.width) * W.value
      let best = 0
      timeline.value.forEach((t, i) => { if (Math.abs(x(t) - vx) < Math.abs(x(timeline.value[best]) - vx)) best = i })
      hoverIdx.value = best
    }
    const stepHover = (d) => {
      const n = timeline.value.length
      hoverIdx.value = hoverIdx.value == null ? (d > 0 ? 0 : n - 1) : Math.min(n - 1, Math.max(0, hoverIdx.value + d))
    }
    const hoverRow = computed(() => {
      if (hoverIdx.value == null) return null
      const t = timeline.value[hoverIdx.value]
      if (t == null) return null
      const values = []
      let forecast = false
      for (const s of series.value) {
        // La cotización de esa semana (o la más cercana anterior), o la previsión
        let p = [...s.pts].reverse().find(q => q.t <= t + 3 * DAY)
        const f = s.fc.find(q => Math.abs(q.t - t) < 3 * DAY)
        if (t > s.pts[s.pts.length - 1].t && f) { p = { plot: f.p, price: f.price }; forecast = true }
        if (p) values.push({ ...s, plot: p.plot, price: p.price })
      }
      return { x: x(t), date: new Date(t).toISOString().slice(0, 10), values, forecast }
    })
    const tooltipStyle = computed(() => {
      if (!hoverRow.value) return {}
      const left = (hoverRow.value.x / W.value) * 100
      return left > 60 ? { right: `${100 - left + 2}%` } : { left: `${left + 2}%` }
    })

    const chartLabel = computed(() => `Evolución del precio de ${shown.value.map(nameOf).join(', ')} en la Lonja de Salamanca`)

    // Tabla: últimas 12 sesiones de los productos elegidos
    const tableRows = computed(() => {
      const dates = [...new Set(shown.value.flatMap(s => s.points.slice(-12).map(p => p.d)))].sort().reverse().slice(0, 12)
      return dates.map(date => ({ date, values: shown.value.map(s => s.points.find(p => p.d === date)?.p ?? null) }))
    })

    // ---------- Formato ----------
    const fmtPrice = (v) => (v == null ? '—' : Number(v).toLocaleString('es-ES', { minimumFractionDigits: v < 10 ? 2 : 0, maximumFractionDigits: v < 10 ? 3 : 1 }))
    const fmtIndex = (v) => Number(v).toLocaleString('es-ES', { maximumFractionDigits: 1 })
    const fmtTick = (v) => (indexed.value ? fmtIndex(v) : fmtPrice(v))
    const fmtPct = (v) => `${v > 0 ? '+' : ''}${Number(v).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`
    const fmtDate = (d) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    const arrow = (v) => (v > 0.05 ? '▲' : v < -0.05 ? '▼' : '=')
    const changeClass = (v) => (v > 0.05 ? 'up' : v < -0.05 ? 'down' : 'flat')
    const lastOf = (arr) => arr[arr.length - 1]
    const trendText = (t) => (t.direction === 'estable' ? 'Estable' : `${t.direction === 'sube' ? 'Sube' : 'Baja'} ${fmtPct(Math.abs(t.perMonth)).replace('+', '')} al mes`)
    const seasonText = (s) => {
      const dir = s.medianChange > 0.5 ? 'subió' : s.medianChange < -0.5 ? 'bajó' : 'apenas cambió'
      const n = s.medianChange > 0.5 ? s.ups : s.medianChange < -0.5 ? s.downs : s.years - s.ups - s.downs
      return `Lo habitual en esta época: en ${n} de los últimos ${s.years} años ${dir} en las 8 semanas siguientes (mediana ${fmtPct(s.medianChange)}).`
    }
    const updatedText = computed(() => (updated.value ? fmtDate(updated.value) : ''))

    return {
      dialogEl, products, source, error, query, onlyActive, listOpen, range, forceIndex, selected, RANGES,
      groups, nameOf, isSelected, colorOf, toggle, remove, shown, mixedUnits, indexed,
      W, H, PAD, chartEl, x, y, yTicks, xTicks, plotted, bandPath, forecastStartX, hoverIdx, onMove, stepHover, hoverRow, tooltipStyle,
      chartLabel, tableRows, fmtPrice, fmtIndex, fmtTick, fmtPct, fmtDate, arrow, changeClass, lastOf, trendText, seasonText, updatedText
    }
  }
}
</script>

<style scoped>
.lonja-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(15, 20, 25, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.lonja {
  width: min(1120px, 100%);
  height: min(90vh, 820px);
  display: flex;
  flex-direction: column;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #222);
  border: 1px solid var(--border-primary, #ddd);
  border-radius: 18px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  outline: none;
}
.lonja-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-primary, #e5e5e5);
}
.lonja-head h2 {
  margin: 0;
  font-size: 1.2rem;
}
.lonja-head p {
  margin: 2px 0 0;
  font-size: 0.82rem;
  color: var(--text-secondary, #666);
}
.lonja-close {
  border: 0;
  background: var(--bg-secondary, #f2f2f2);
  color: inherit;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 15px;
}
.lonja-loading,
.lonja-error,
.lonja-empty {
  padding: 30px;
  text-align: center;
  color: var(--text-secondary, #666);
}
.lonja-error {
  color: #c62828;
}
.lonja-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 300px 1fr;
}

/* Lista de productos */
.lonja-side {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--border-primary, #e5e5e5);
  padding: 12px;
  gap: 6px;
}
.lonja-search {
  width: 100%;
  border: 1px solid var(--border-primary, #ddd);
  border-radius: 10px;
  padding: 8px 10px;
  font: inherit;
  font-size: 0.9rem;
  background: var(--bg-secondary, #fafafa);
  color: inherit;
}
.lonja-search:focus {
  outline: 2px solid var(--primary-color, #4caf50);
  outline-offset: -1px;
}
.lonja-check {
  font-size: 0.8rem;
  color: var(--text-secondary, #555);
  display: flex;
  gap: 6px;
  align-items: center;
}
.lonja-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-secondary, #777);
}
.lonja-list {
  flex: 1;
  overflow-y: auto;
  margin: 0 -4px;
  padding: 0 4px;
}
.lonja-mesa {
  position: sticky;
  top: 0;
  margin: 8px 0 2px;
  padding: 4px 0;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary, #666);
  background: var(--bg-primary, #fff);
}
.lonja-item {
  width: 100%;
  display: grid;
  grid-template-columns: 10px 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 6px 6px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.83rem;
  text-align: left;
  cursor: pointer;
}
.lonja-item:hover,
.lonja-item:focus-visible {
  background: var(--bg-secondary, #f3f4f6);
  outline: none;
}
.lonja-item.selected {
  background: color-mix(in srgb, var(--primary-color, #4caf50) 12%, transparent);
  font-weight: 600;
}
.lonja-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.lonja-item-name small {
  display: block;
  font-weight: 400;
  color: var(--text-secondary, #888);
}
.lonja-item-price {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.lonja-item-price small {
  color: var(--text-secondary, #777);
}
.lonja-change {
  display: block;
}
.up { color: #2e7d32; }
.down { color: #c62828; }
.flat { color: var(--text-secondary, #777); }

/* Gráfica y tarjetas */
.lonja-main {
  min-height: 0;
  overflow-y: auto;
  padding: 12px 18px 16px;
}
.lonja-list-toggle,
.lonja-side-close {
  display: none;
}
.lonja-legend {
  list-style: none;
  margin: 0 0 8px;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  font-size: 0.85rem;
}
.lonja-legend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.lonja-legend small {
  color: var(--text-secondary, #777);
}
.lonja-swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}
.lonja-remove {
  border: 0;
  background: none;
  color: var(--text-secondary, #888);
  cursor: pointer;
  padding: 0 2px;
  font-size: 11px;
}
.lonja-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: space-between;
  margin-bottom: 6px;
}
.lonja-seg {
  display: inline-flex;
  border: 1px solid var(--border-primary, #ddd);
  border-radius: 9px;
  overflow: hidden;
}
.lonja-seg button {
  border: 0;
  background: var(--bg-primary, #fff);
  color: inherit;
  font: inherit;
  font-size: 0.8rem;
  padding: 5px 10px;
  cursor: pointer;
}
.lonja-seg button + button {
  border-left: 1px solid var(--border-primary, #ddd);
}
.lonja-seg button[aria-pressed="true"] {
  background: var(--text-primary, #222);
  color: var(--bg-primary, #fff);
}
.lonja-seg button:disabled {
  opacity: 0.45;
  cursor: default;
}
.lonja-note {
  margin: 0 0 6px;
  font-size: 0.78rem;
  color: var(--text-secondary, #666);
}
.lonja-chart {
  position: relative;
}
.lonja-svg {
  width: 100%;
  height: auto;
  display: block;
  touch-action: pan-y;
  overflow: visible;
  /* global.css da fondo, borde y sombra a todos los svg */
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}
.lonja-svg:focus-visible {
  outline: 2px solid var(--primary-color, #4caf50);
  outline-offset: 2px;
}
.lonja-grid line {
  stroke: var(--border-primary, #e6e6e6);
  stroke-width: 1;
}
.lonja-grid text {
  font-size: 11px;
  fill: var(--text-secondary, #666);
  font-variant-numeric: tabular-nums;
}
.lonja-line {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.lonja-forecast {
  stroke-dasharray: 5 4;
}
.lonja-band {
  opacity: 0.14;
}
.lonja-today {
  stroke: var(--text-secondary, #999);
  stroke-width: 1;
  stroke-dasharray: 2 3;
}
.lonja-end,
.lonja-marker {
  stroke: var(--bg-primary, #fff);
  stroke-width: 2;
}
.lonja-cross {
  stroke: var(--text-secondary, #888);
  stroke-width: 1;
}
.lonja-tooltip {
  position: absolute;
  top: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--text-primary, #222);
  color: var(--bg-primary, #fff);
  font-size: 0.78rem;
  pointer-events: none;
  max-width: 60%;
}
.lonja-tooltip i {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 5px;
}
.lonja-chart-note {
  margin: 2px 0 10px;
  font-size: 0.72rem;
  color: var(--text-secondary, #777);
}
.lonja-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 10px;
}
.lonja-card {
  border: 1px solid var(--border-primary, #e3e3e3);
  border-top: 4px solid var(--c);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 0.82rem;
}
.lonja-card h3 {
  margin: 0;
  font-size: 0.88rem;
}
.lonja-big {
  margin: 4px 0 0;
  font-size: 1.35rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.lonja-big small {
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--text-secondary, #777);
}
.lonja-sub {
  margin: 0 0 6px;
  font-size: 0.75rem;
  color: var(--text-secondary, #777);
}
.lonja-card dl {
  margin: 0;
}
.lonja-card dl div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0;
}
.lonja-card dt {
  color: var(--text-secondary, #666);
}
.lonja-card dd {
  margin: 0;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.lonja-season {
  margin: 6px 0 0;
  font-size: 0.76rem;
  color: var(--text-secondary, #555);
}
.lonja-details {
  margin-top: 10px;
  font-size: 0.8rem;
}
.lonja-details summary {
  cursor: pointer;
  color: var(--text-secondary, #666);
}
.lonja-table {
  border-collapse: collapse;
  margin-top: 6px;
  font-variant-numeric: tabular-nums;
}
.lonja-table th,
.lonja-table td {
  padding: 3px 10px 3px 0;
  text-align: right;
  border-bottom: 1px solid var(--border-primary, #eee);
}
.lonja-table th:first-child,
.lonja-table td:first-child {
  text-align: left;
}
.lonja-foot {
  margin: 12px 0 0;
  font-size: 0.72rem;
  color: var(--text-secondary, #777);
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* Móvil: la lista se abre encima de la gráfica */
@media (max-width: 767px) {
  .lonja-overlay { padding: 0; }
  .lonja { height: 100dvh; border-radius: 0; }
  .lonja-body { grid-template-columns: 1fr; position: relative; }
  .lonja-side {
    display: none;
    position: absolute;
    inset: 0;
    z-index: 2;
    background: var(--bg-primary, #fff);
    border-right: 0;
  }
  .lonja-side.open { display: flex; }
  .lonja-list-toggle,
  .lonja-side-close {
    display: block;
    width: 100%;
    margin-bottom: 8px;
    padding: 8px;
    border: 1px solid var(--border-primary, #ddd);
    border-radius: 10px;
    background: var(--bg-secondary, #f5f5f5);
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
}
</style>
