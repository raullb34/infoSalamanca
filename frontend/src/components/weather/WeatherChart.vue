<template>
  <!-- Gráfico de series temporales en SVG (sin librerías). Un solo eje Y; líneas de 2 px, barras finas
       con extremos redondeados, banda opcional (mín.–máx.), cruceta con tooltip al pasar el ratón.
       ≥ 2 series: leyenda siempre y etiqueta directa al final de cada línea. -->
  <figure class="wch" :aria-label="title">
    <figcaption v-if="title" class="wch-title">{{ title }}</figcaption>
    <ul v-if="series.length > 1" class="wch-legend">
      <li v-for="s in series" :key="s.id"><i :style="{ background: s.color }"></i>{{ s.label }}</li>
    </ul>
    <div ref="box" class="wch-box" @pointermove="onMove" @pointerleave="hover = null">
      <svg v-if="width" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="img">
        <!-- Rejilla y eje Y -->
        <g class="wch-grid">
          <g v-for="t in yTicks" :key="t">
            <line :x1="pad.l" :x2="width - pad.r" :y1="y(t)" :y2="y(t)" />
            <text :x="pad.l - 6" :y="y(t) + 4" text-anchor="end">{{ fmtTick(t) }}</text>
          </g>
          <line v-if="zeroLine" class="wch-zero" :x1="pad.l" :x2="width - pad.r" :y1="y(0)" :y2="y(0)" />
        </g>
        <!-- Eje X -->
        <g class="wch-x">
          <text v-for="t in xTicks" :key="t.getTime()" :x="x(t)" :y="height - 6" text-anchor="middle">{{ xLabel(t) }}</text>
        </g>
        <!-- Marca de "ahora" -->
        <line v-if="nowLine" class="wch-now" :x1="x(now)" :x2="x(now)" :y1="pad.t" :y2="height - pad.b" />
        <!-- Banda mín.–máx. -->
        <path v-if="band" class="wch-band" :d="bandPath" :fill="band.color" />
        <!-- Barras -->
        <g v-for="s in barSeries" :key="s.id">
          <path v-for="(p, i) in s.points" :key="i" :d="barPath(p, s)" :fill="s.color" />
        </g>
        <!-- Líneas -->
        <path v-for="s in lineSeries" :key="s.id" class="wch-line" :d="linePath(s)" :stroke="s.color" />
        <!-- Etiqueta directa al final de cada línea (≤ 4 series) -->
        <g v-if="lineSeries.length > 1 && lineSeries.length <= 4">
          <text v-for="l in endLabels" :key="l.id" class="wch-endlabel" :x="l.x + 6" :y="l.y + 4">{{ l.label }}</text>
        </g>
        <!-- Cruceta -->
        <g v-if="hover">
          <line class="wch-cross" :x1="hover.x" :x2="hover.x" :y1="pad.t" :y2="height - pad.b" />
          <circle v-for="h in hover.values.filter(v => v.kind !== 'bar' && v.v !== null)" :key="h.id" :cx="hover.x" :cy="y(h.v)" r="4" :fill="h.color" class="wch-dot" />
        </g>
      </svg>
      <div v-if="hover" class="wch-tip" :style="tipStyle">
        <strong>{{ tipTime(hover.t) }}</strong>
        <span v-for="h in hover.values" :key="h.id"><i :style="{ background: h.color }"></i>{{ h.label }}: {{ format(h.v) }}</span>
      </div>
      <p v-if="!hasData" class="wch-empty">Sin datos en este periodo</p>
    </div>
  </figure>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const TZ = 'Europe/Madrid'
const fmt = (opts) => new Intl.DateTimeFormat('es-ES', { timeZone: TZ, ...opts })

export default {
  name: 'WeatherChart',
  props: {
    // [{ id, label, color, kind: 'line'|'bar', points: [{ t: Date|string, v: number|null }] }]
    series: { type: Array, required: true },
    // { color, points: [{ t, min, max }] }
    band: { type: Object, default: null },
    title: { type: String, default: '' },
    unit: { type: String, default: '' },
    format: { type: Function, default: (v) => (v === null || v === undefined ? '—' : String(v)) },
    height: { type: Number, default: 220 },
    zeroBased: { type: Boolean, default: false },
    nowLine: { type: Boolean, default: false },
    resolution: { type: String, default: 'hour' } // 'hour' | 'day'
  },
  setup(props) {
    const box = ref(null)
    const width = ref(0)
    const hover = ref(null)
    const now = new Date()
    const pad = { t: 12, r: 70, b: 26, l: 44 }
    let ro = null
    onMounted(() => {
      const measure = () => { width.value = box.value?.clientWidth || 0 }
      measure()
      ro = new ResizeObserver(measure)
      ro.observe(box.value)
    })
    onUnmounted(() => ro?.disconnect())

    const norm = (s) => ({ ...s, points: (s.points || []).map(p => ({ ...p, t: new Date(p.t) })).filter(p => !Number.isNaN(p.t.getTime())) })
    const all = computed(() => props.series.map(norm))
    const lineSeries = computed(() => all.value.filter(s => s.kind !== 'bar'))
    const barSeries = computed(() => all.value.filter(s => s.kind === 'bar'))
    const bandPts = computed(() => (props.band?.points || []).map(p => ({ ...p, t: new Date(p.t) })))
    const hasData = computed(() => all.value.some(s => s.points.some(p => p.v !== null && p.v !== undefined)))

    const times = computed(() => [...all.value.flatMap(s => s.points.map(p => p.t.getTime())), ...bandPts.value.map(p => p.t.getTime())])
    const tMin = computed(() => Math.min(...times.value))
    const tMax = computed(() => Math.max(...times.value))
    const values = computed(() => [
      ...all.value.flatMap(s => s.points.map(p => p.v)), ...bandPts.value.flatMap(p => [p.min, p.max])
    ].filter(v => v !== null && v !== undefined && Number.isFinite(v)))

    // Escala Y con márgenes "redondos"
    const yDomain = computed(() => {
      let lo = Math.min(...values.value)
      let hi = Math.max(...values.value)
      if (!Number.isFinite(lo)) { lo = 0; hi = 1 }
      if (props.zeroBased || barSeries.value.length) lo = Math.min(0, lo)
      if (hi - lo < 1) { hi += 0.5; lo -= props.zeroBased ? 0 : 0.5 }
      const step = niceStep((hi - lo) / 4)
      return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step, step]
    })
    function niceStep(raw) {
      const p = 10 ** Math.floor(Math.log10(raw))
      const f = raw / p
      return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p
    }
    const yTicks = computed(() => {
      const [lo, hi, step] = yDomain.value
      const out = []
      for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 100) / 100)
      return out
    })
    const zeroLine = computed(() => yDomain.value[0] < 0 && yDomain.value[1] > 0)
    const x = (t) => {
      const span = Math.max(1, tMax.value - tMin.value)
      return pad.l + ((new Date(t).getTime() - tMin.value) / span) * (width.value - pad.l - pad.r)
    }
    const y = (v) => {
      const [lo, hi] = yDomain.value
      return pad.t + (1 - (v - lo) / (hi - lo || 1)) * (props.height - pad.t - pad.b)
    }
    const fmtTick = (v) => v.toLocaleString('es-ES', { maximumFractionDigits: 1 })

    // Etiquetas del eje X: días a medianoche de Madrid (o cada pocas horas si el periodo es corto)
    const xTicks = computed(() => {
      if (!times.value.length) return []
      const span = tMax.value - tMin.value
      const hours = span / 3600e3
      const stepH = hours <= 30 ? 6 : hours <= 8 * 24 ? 24 : 24 * 5
      const out = []
      const start = new Date(tMin.value)
      start.setMinutes(0, 0, 0)
      for (let t = start.getTime(); t <= tMax.value; t += 3600e3) {
        const h = Number(fmt({ hour: '2-digit', hour12: false }).format(new Date(t)))
        const isMidnight = h === 0 || h === 24
        if (stepH >= 24 ? isMidnight : h % stepH === 0) out.push(new Date(t))
      }
      const maxTicks = Math.max(2, Math.floor((width.value - pad.l - pad.r) / 70))
      const every = Math.ceil(out.length / maxTicks)
      return out.filter((_, i) => i % every === 0)
    })
    const xLabel = (t) => (xTicks.value.length && (tMax.value - tMin.value) / 3600e3 <= 30
      ? fmt({ hour: '2-digit', minute: '2-digit' }).format(t)
      : fmt({ weekday: 'short', day: 'numeric' }).format(t))

    const linePath = (s) => {
      let d = ''
      let pen = false
      for (const p of s.points) {
        if (p.v === null || p.v === undefined) { pen = false; continue }
        d += `${pen ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`
        pen = true
      }
      return d
    }
    const bandPath = computed(() => {
      const pts = bandPts.value.filter(p => p.min !== null && p.max !== null)
      if (!pts.length) return ''
      return `M${pts.map(p => `${x(p.t).toFixed(1)},${y(p.max).toFixed(1)}`).join('L')}L${pts.slice().reverse().map(p => `${x(p.t).toFixed(1)},${y(p.min).toFixed(1)}`).join('L')}Z`
    })
    // Barra con extremo superior redondeado (4 px) apoyada en la línea base
    const barPath = (p, s) => {
      if (p.v === null || p.v === undefined || p.v <= 0) return ''
      const n = Math.max(1, s.points.length)
      const w = Math.max(2, Math.min(14, ((width.value - pad.l - pad.r) / n) - 2))
      const cx = x(p.t)
      const top = y(p.v)
      const base = y(Math.max(0, yDomain.value[0]))
      const r = Math.min(4, w / 2, (base - top) / 2)
      const l = cx - w / 2
      return `M${l},${base}V${top + r}Q${l},${top} ${l + r},${top}H${l + w - r}Q${l + w},${top} ${l + w},${top + r}V${base}Z`
    }
    const endLabels = computed(() => {
      const labels = lineSeries.value.map(s => {
        const last = [...s.points].reverse().find(p => p.v !== null && p.v !== undefined)
        return last ? { id: s.id, label: s.label, x: x(last.t), y: y(last.v) } : null
      }).filter(Boolean).sort((a, b) => a.y - b.y)
      for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 13) labels[i].y = labels[i - 1].y + 13
      return labels
    })

    // Cruceta: el instante más cercano al puntero
    function onMove(ev) {
      if (!hasData.value) return
      const rect = box.value.getBoundingClientRect()
      const px = ev.clientX - rect.left
      const ts = [...new Set(times.value)].sort((a, b) => a - b)
      let best = ts[0]
      for (const t of ts) if (Math.abs(x(t) - px) < Math.abs(x(best) - px)) best = t
      const vals = all.value.map(s => {
        const p = s.points.find(q => q.t.getTime() === best)
        return { id: s.id, label: s.label, color: s.color, kind: s.kind, v: p ? p.v : null }
      })
      const bp = bandPts.value.find(q => q.t.getTime() === best)
      if (bp && props.band) vals.push({ id: 'band', label: 'Mín.–máx.', color: props.band.color, kind: 'band', v: null, range: [bp.min, bp.max] })
      hover.value = { t: new Date(best), x: x(best), px, values: vals.map(v => (v.range ? { ...v, v: null, label: `${v.label} ${props.format(v.range[0])} / ${props.format(v.range[1])}` } : v)) }
    }
    const tipStyle = computed(() => {
      if (!hover.value) return {}
      const left = hover.value.x > width.value * 0.6 ? hover.value.x - 12 : hover.value.x + 12
      return { left: `${left}px`, transform: hover.value.x > width.value * 0.6 ? 'translateX(-100%)' : 'none' }
    })
    const tipTime = (t) => (props.resolution === 'day'
      ? fmt({ weekday: 'long', day: 'numeric', month: 'short' }).format(t)
      : fmt({ weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(t))

    return { box, width, hover, now, pad, lineSeries, barSeries, hasData, yTicks, zeroLine, x, y, fmtTick, xTicks, xLabel, linePath, bandPath, barPath, endLabels, onMove, tipStyle, tipTime }
  }
}
</script>

<style scoped>
.wch {
  margin: 0;
}
.wch-title {
  margin: 0 0 6px;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ink, var(--text-primary));
}
.wch-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0 0 6px;
  padding: 0;
  list-style: none;
  font-size: 0.8rem;
  color: var(--ink-soft, var(--text-secondary));
}
.wch-legend i,
.wch-tip i {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 5px;
  border-radius: 2px;
  vertical-align: -1px;
}
.wch-box {
  position: relative;
  width: 100%;
  touch-action: pan-y;
}
.wch-box svg {
  display: block;
  overflow: visible;
  border-radius: 0 !important;
  box-shadow: none !important;
  background: none !important;
}
.wch-grid line {
  stroke: var(--line, rgba(0, 0, 0, 0.08));
  stroke-width: 1;
}
.wch-zero {
  stroke: var(--ink-soft, #777) !important;
  stroke-opacity: 0.5;
}
.wch-grid text,
.wch-x text {
  font-size: 11px;
  fill: var(--ink-soft, var(--text-secondary));
}
.wch-line {
  fill: none;
  stroke-width: 2px;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.wch-band {
  opacity: 0.22;
}
.wch-endlabel {
  font-size: 11px;
  font-weight: 600;
  fill: var(--ink, var(--text-primary));
}
.wch-now {
  stroke: var(--ink-soft, #777);
  stroke-dasharray: 3 3;
  stroke-opacity: 0.7;
}
.wch-cross {
  stroke: var(--ink-soft, #777);
  stroke-opacity: 0.6;
}
.wch-dot {
  stroke: var(--card, #fff);
  stroke-width: 2px;
}
.wch-tip {
  position: absolute;
  top: 4px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 140px;
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 0.78rem;
  line-height: 1.35;
  color: var(--ink, var(--text-primary));
  background: var(--card, #fff);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  pointer-events: none;
  white-space: nowrap;
}
.wch-empty {
  margin: 0;
  padding: 40px 0;
  text-align: center;
  font-size: 0.85rem;
  color: var(--ink-soft, var(--text-secondary));
}
</style>
