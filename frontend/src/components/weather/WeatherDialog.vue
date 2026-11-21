<template>
  <Teleport to="body">
    <div class="wxm-overlay" role="dialog" aria-modal="true" :aria-label="`El tiempo en ${name}`" @click.self="$emit('close')" @keydown.esc="$emit('close')">
      <article ref="panel" class="wxm" tabindex="-1">
        <header class="wxm-head">
          <button type="button" class="wxm-close" aria-label="Cerrar" @click="$emit('close')">✕</button>
          <p class="wxm-kicker">El tiempo en</p>
          <h2 class="wxm-title">{{ name }}</h2>
          <p class="wxm-sub">
            <template v-if="elevation !== null">{{ Math.round(elevation) }} m de altitud · </template>
            <button type="button" class="wxm-link" @click="share">{{ copied ? '¡Enlace copiado!' : 'Copiar enlace' }}</button>
          </p>
          <!-- El tiempo de este pueblo como icono o widget en el móvil (public/tiempo.html) -->
          <a class="wxm-phone" :href="`/tiempo.html?m=${encodeURIComponent(slug || String(town.id).split('_')[0])}`">
            <span aria-hidden="true">📲</span> Añadir a mi teléfono
            <small>Por horas y la semana, en tu pantalla de inicio</small>
          </a>
        </header>

        <p v-if="error" class="wxm-empty">No se ha podido cargar el tiempo. Prueba en un rato.</p>
        <template v-else>
          <!-- 1. Observado en estaciones cercanas -->
          <section class="wxm-sec">
            <h3>Ahora, medido cerca</h3>
            <p class="wxm-hint">Estaciones a menos de 30 km. Son mediciones de esas estaciones, no del propio pueblo.</p>
            <p v-if="loadingCurrent" class="wxm-empty">Cargando estaciones…</p>
            <ul v-else-if="observed.length" class="wxm-stations">
              <li v-for="s in observed" :key="s.id">
                <button type="button" class="wxm-station" @click="$emit('openStation', s)">
                  <span class="wxm-temp" :style="{ background: tempBin(s.variables.temperature?.value)?.color || 'var(--line)', color: tempBin(s.variables.temperature?.value)?.ink || 'var(--ink)' }">
                    {{ s.variables.temperature ? fmtTemp(s.variables.temperature.value) : '—' }}
                  </span>
                  <span class="wxm-st-body">
                    <strong>{{ stationName(s.name) }}</strong>
                    <small class="wxm-st-line">
                      <span class="wxm-net" :class="s.network">{{ NETWORKS[s.network]?.label }}</span>
                      <span>{{ fmtKm(s.distanceKm) }}</span>
                      <span v-if="s.altitudeDiff !== null && s.altitudeDiff !== undefined">{{ altText(s.altitudeDiff) }}</span>
                    </small>
                    <small class="wxm-st-line">
                      <span v-if="s.variables.relative_humidity" title="Humedad">💧 {{ fmtValue('relative_humidity', s.variables.relative_humidity.value) }}</span>
                      <span v-if="s.variables.wind_speed" title="Viento">💨 {{ fmtWind(s.variables.wind_speed.value) }}</span>
                      <span v-if="s.variables.precipitation" :title="`Precipitación ${aggregationNote(s.variables.precipitation)}`">🌧️ {{ fmtValue('precipitation', s.variables.precipitation.value) }}</span>
                    </small>
                  </span>
                  <span class="wxm-age" :class="{ stale: !s.recent }">{{ ago(s.lastObservationAt) }}</span>
                </button>
              </li>
            </ul>
            <p v-else class="wxm-empty">No hay estaciones con datos a menos de 30 km.</p>
          </section>

          <!-- 2. Lo que dicen los modelos ahora -->
          <section v-if="forecastNow.length" class="wxm-sec">
            <h3>Ahora, según la previsión</h3>
            <div class="wxm-now">
              <div v-for="m in forecastNow" :key="m.model" class="wxm-now-card">
                <span class="wxm-sw" :style="{ background: modelColor(m.model) }"></span>
                <span class="wxm-now-label">{{ m.label }}</span>
                <span class="wxm-now-sky" :title="skyOf(m.weather_code).label">{{ skyOf(m.weather_code).icon }}</span>
                <strong>{{ fmtTemp(m.temperature) }}</strong>
              </div>
            </div>
          </section>

          <!-- 3. Próximas horas -->
          <section class="wxm-sec">
            <div class="wxm-sec-head">
              <h3>Próximas 48 horas</h3>
            </div>
            <p v-if="loadingForecast" class="wxm-empty">Cargando previsión…</p>
            <template v-else-if="models.length">
              <div class="wxm-strip" role="list">
                <div v-for="h in strip" :key="h.t" class="wxm-hour" role="listitem">
                  <span>{{ h.label }}</span>
                  <span class="wxm-hour-sky" :title="skyOf(h.code).label">{{ skyOf(h.code).icon }}</span>
                  <strong>{{ h.temp === null ? '—' : `${Math.round(h.temp)}°` }}</strong>
                  <small v-if="h.prob !== null">{{ h.prob }} %</small>
                </div>
              </div>
              <p class="wxm-hint">Cada 3 horas, modelo {{ modelLabel(selectedModel) }}.</p>
              <WeatherChart :series="tempSeries" title="Temperatura prevista por cada modelo (°C)" :format="fmtTemp" :now-line="true" :height="220" />
              <WeatherChart :series="precipSeries" :title="`Precipitación prevista, ${modelLabel(selectedModel)} (mm por hora)`" :format="(v) => fmtValue('precipitation', v)" :zero-based="true" :height="140" />
            </template>
          </section>

          <!-- 4. Próximos días -->
          <section v-if="days.length" class="wxm-sec">
            <div class="wxm-sec-head">
              <h3>Próximos días</h3>
              <div class="wxm-seg" role="group" aria-label="Modelo">
                <button v-for="m in models" :key="m.model" type="button" :class="{ on: selectedModel === m.model }" :aria-pressed="selectedModel === m.model" @click="selectedModel = m.model">
                  <i :style="{ background: modelColor(m.model) }"></i>{{ m.label }}
                </button>
              </div>
            </div>
            <div class="wxm-days">
              <div v-for="d in days" :key="d.t" class="wxm-day">
                <span class="wxm-day-name">{{ d.name }}</span>
                <span class="wxm-day-sky" :title="skyOf(d.code).label">{{ skyOf(d.code).icon }}</span>
                <span class="wxm-day-temps"><strong>{{ d.max }}°</strong> <span>{{ d.min }}°</span></span>
                <small>{{ d.prob !== null ? `💧 ${d.prob} %` : '' }}{{ d.rain ? ` · ${d.rain} mm` : '' }}</small>
                <small v-if="d.wind !== null">💨 {{ fmtWind(d.wind) }}</small>
              </div>
            </div>
          </section>

          <!-- 5. Comparar modelos día a día -->
          <section v-if="compareRows.length" class="wxm-sec">
            <h3>Comparar modelos</h3>
            <p class="wxm-hint">Máxima / mínima y lluvia de cada día según cada modelo. Si se parecen, la previsión es más fiable.</p>
            <div class="wxm-table-wrap">
              <table class="wxm-table">
                <thead>
                  <tr><th>Día</th><th v-for="m in models" :key="m.model"><i :style="{ background: modelColor(m.model) }"></i>{{ m.label }}</th></tr>
                </thead>
                <tbody>
                  <tr v-for="r in compareRows" :key="r.t">
                    <td>{{ r.name }}</td>
                    <td v-for="c in r.cells" :key="c.model">{{ c.text }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="wxm-hint">
              <template v-for="(m, i) in models" :key="m.model">{{ i ? ' · ' : '' }}{{ m.label }} ({{ m.centre }}, {{ m.resolution }}): pasada de {{ dateTime(m.issuedAt) }}</template>
            </p>
          </section>
        </template>

        <footer class="wxm-foot">
          <span>Previsión: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Weather data by Open-Meteo.com</a> (CC BY 4.0).</span>
          <span v-for="a in stationAttribution" :key="a.source">{{ a.attribution }} · <a :href="a.url" target="_blank" rel="noopener">fuente</a></span>
        </footer>
      </article>
    </div>
  </Teleport>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import WeatherChart from './WeatherChart.vue'
import { weatherApi, NETWORKS, tempBin, skyOf, ago, fmtTemp, fmtWind, fmtValue, modelColor, dateTime, weatherLink, stationName, aggregationNote } from '@/utils/weather'

const TZ = 'Europe/Madrid'
const fmt = (opts) => new Intl.DateTimeFormat('es-ES', { timeZone: TZ, ...opts })

export default {
  name: 'WeatherDialog',
  components: { WeatherChart },
  // `town`: { id (INE o pieza del mapa), name, slug? }
  props: { town: { type: Object, required: true } },
  emits: ['close', 'openStation'],
  setup(props) {
    const panel = ref(null)
    const current = ref(null)
    const forecast = ref(null)
    const loadingCurrent = ref(true)
    const loadingForecast = ref(true)
    const error = ref(false)
    const selectedModel = ref('ecmwf_ifs025')
    const copied = ref(false)

    const name = computed(() => forecast.value?.municipality?.name || current.value?.municipality?.name || props.town.name)
    const elevation = computed(() => forecast.value?.municipality?.elevation ?? current.value?.municipality?.elevation ?? null)
    const slug = computed(() => forecast.value?.municipality?.slug || props.town.slug)

    async function load() {
      error.value = false
      loadingCurrent.value = true
      loadingForecast.value = true
      const id = String(props.town.id || props.town.slug).split('_')[0]
      const [c, f] = await Promise.allSettled([weatherApi.current(id), weatherApi.forecast(id, 168)])
      current.value = c.status === 'fulfilled' ? c.value : null
      forecast.value = f.status === 'fulfilled' ? f.value : null
      if (!current.value && !forecast.value) error.value = true
      loadingCurrent.value = false
      loadingForecast.value = false
    }
    watch(() => props.town.id, load)
    onMounted(() => { load(); panel.value?.focus() })

    // Estaciones: primero las que tienen dato reciente, luego por distancia
    const observed = computed(() => (current.value?.observations || [])
      .toSorted((a, b) => (b.recent - a.recent) || (a.distanceKm - b.distanceKm)).slice(0, 6))
    const forecastNow = computed(() => current.value?.forecastNow || [])
    const stationAttribution = computed(() => (current.value?.attribution || []).filter(a => a.source !== 'openmeteo'))
    const models = computed(() => forecast.value?.models || [])
    const sel = computed(() => models.value.find(m => m.model === selectedModel.value) || models.value[0])
    const modelLabel = (id) => models.value.find(m => m.model === id)?.label || id

    // Próximas 48 h
    const in48 = (m) => {
      const t = m.hourly.time.map(x => new Date(x))
      const end = Date.now() + 48 * 3600e3
      return t.map((d, i) => ({ d, i })).filter(({ d }) => d.getTime() <= end)
    }
    const strip = computed(() => {
      const m = sel.value
      if (!m) return []
      return in48(m).filter((_, k) => k % 3 === 0).map(({ d, i }) => ({
        t: d.toISOString(),
        label: fmt({ hour: '2-digit' }).format(d) + 'h',
        temp: m.hourly.temperature?.[i] ?? null,
        code: m.hourly.weather_code?.[i],
        prob: m.hourly.precipitation_probability?.[i] ?? null
      }))
    })
    const tempSeries = computed(() => models.value.map(m => ({
      id: m.model, label: m.label, color: modelColor(m.model), kind: 'line',
      points: in48(m).map(({ d, i }) => ({ t: d, v: m.hourly.temperature?.[i] ?? null }))
    })))
    const precipSeries = computed(() => {
      const m = sel.value
      if (!m) return []
      return [{ id: 'p', label: 'Precipitación', color: modelColor(m.model), kind: 'bar', points: in48(m).map(({ d, i }) => ({ t: d, v: m.hourly.precipitation?.[i] ?? null })) }]
    })

    // Próximos días (desde hoy, hora de Madrid)
    const dayName = (t) => {
      const d = new Date(t)
      const today = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
      const key = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
      const tomorrow = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 86400e3))
      if (key === today) return 'Hoy'
      if (key === tomorrow) return 'Mañana'
      return fmt({ weekday: 'short', day: 'numeric' }).format(d)
    }
    const round = (v) => (v === null || v === undefined ? '—' : Math.round(v))
    const days = computed(() => {
      const m = sel.value
      if (!m?.daily?.time) return []
      return m.daily.time.map((t, i) => ({
        t, name: dayName(t), code: m.daily.weather_code?.[i],
        max: round(m.daily.temperature_max?.[i]), min: round(m.daily.temperature_min?.[i]),
        prob: m.daily.precipitation_probability_max?.[i] ?? null,
        rain: m.daily.precipitation_sum?.[i] ? Math.round(m.daily.precipitation_sum[i] * 10) / 10 : 0,
        wind: m.daily.wind_speed_max?.[i] ?? null
      })).filter(d => d.max !== '—')
    })
    const compareRows = computed(() => {
      const base = models.value.find(m => m.daily?.time?.length)
      if (!base) return []
      return base.daily.time.map((t, i) => ({
        t, name: dayName(t),
        cells: models.value.map(m => {
          const j = (m.daily?.time || []).findIndex(x => new Date(x).getTime() === new Date(t).getTime())
          const mx = m.daily?.temperature_max?.[j]
          if (j < 0 || mx === null || mx === undefined) return { model: m.model, text: '—' }
          const rain = m.daily.precipitation_sum?.[j]
          return { model: m.model, text: `${round(mx)}° / ${round(m.daily.temperature_min?.[j])}°${rain ? ` · ${Math.round(rain * 10) / 10} mm` : ''}` }
        })
      }))
    })

    const fmtKm = (d) => (d < 1 ? 'a menos de 1 km' : `a ${Math.round(d)} km`)
    const altText = (diff) => (Math.abs(diff) < 50 ? 'misma altitud' : `${Math.abs(diff)} m más ${diff > 0 ? 'alta' : 'baja'}`)

    async function share() {
      const url = weatherLink(slug.value || props.town.id)
      try { await navigator.clipboard.writeText(url); copied.value = true; setTimeout(() => { copied.value = false }, 2000) } catch { window.prompt('Enlace', url) }
    }

    return {
      slug, panel, current, forecast, loadingCurrent, loadingForecast, error, selectedModel, copied, name, elevation, observed, forecastNow, stationAttribution,
      models, modelLabel, strip, tempSeries, precipSeries, days, compareRows, fmtKm, altText, stationName, aggregationNote, share,
      NETWORKS, tempBin, skyOf, ago, fmtTemp, fmtWind, fmtValue, modelColor, dateTime
    }
  }
}
</script>

<style scoped>
.wxm-overlay {
  position: fixed;
  inset: 0;
  z-index: 10002;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(12, 16, 22, 0.55);
  backdrop-filter: blur(6px);
  animation: wxm-fade 0.2s ease both;
}
.wxm {
  --ink: #16202a;
  --ink-soft: #5b6670;
  --paper: #f7f9fb;
  --card: #ffffff;
  --line: rgba(22, 32, 42, 0.1);
  --accent: #1c5cab;
  width: min(900px, 100%);
  max-height: min(94vh, 980px);
  overflow-y: auto;
  border-radius: 22px;
  color: var(--ink);
  background: var(--paper);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
  outline: none;
  animation: wxm-rise 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
}
.wxm-head {
  position: relative;
  padding: 24px 24px 10px;
  color: #fff;
  background: linear-gradient(135deg, #1c5cab, #2a78d6 60%, #6da7ec);
}
.wxm-close {
  position: absolute;
  z-index: 1;
  top: 14px;
  right: 14px;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  color: #fff;
  background: rgba(0, 0, 0, 0.2);
  cursor: pointer;
}
.wxm-kicker {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.9;
}
.wxm-title {
  margin: 0;
  font-size: clamp(1.5rem, 3.6vw, 2.2rem);
  font-weight: 800;
  color: #fff;
}
.wxm-sub {
  margin: 4px 0 8px;
  font-size: 0.88rem;
  opacity: 0.95;
}
/* Añadir a mi teléfono: el acceso al widget, bien visible bajo el nombre del pueblo */
.wxm-phone {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 8px;
  margin-top: 10px;
  padding: 9px 14px;
  border-radius: 14px;
  background: #1b5e20;
  color: #fff;
  font-weight: 700;
  text-decoration: none;
}
.wxm-phone small {
  flex-basis: 100%;
  padding-left: 26px;
  font-weight: 400;
  font-size: 12px;
  opacity: 0.85;
}
.wxm-phone:hover {
  background: #2e7d32;
}
.wxm-phone:focus-visible {
  outline: 3px solid #8fd694;
  outline-offset: 2px;
}
.wxm-link {
  padding: 0;
  border: 0;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  color: #fff;
  background: none;
  cursor: pointer;
}
.wxm-sec {
  margin: 14px 24px 0;
  padding: 16px;
  border-radius: 16px;
  background: var(--card);
  box-shadow: 0 1px 0 var(--line);
}
.wxm-sec h3 {
  margin: 0 0 4px;
  font-size: 1rem;
  font-weight: 800;
  color: var(--ink);
}
.wxm-sec-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.wxm-hint {
  margin: 4px 0 10px;
  font-size: 0.78rem;
  color: var(--ink-soft);
}
.wxm-empty {
  margin: 0;
  padding: 18px;
  text-align: center;
  font-size: 0.85rem;
  color: var(--ink-soft);
}
.wxm-stations {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.wxm-station {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 14px;
  text-align: left;
  color: var(--ink);
  background: var(--paper);
  cursor: pointer;
}
.wxm-station:hover,
.wxm-station:focus-visible {
  border-color: var(--accent);
}
.wxm-temp {
  flex: 0 0 auto;
  min-width: 66px;
  padding: 8px 6px;
  border-radius: 10px;
  text-align: center;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.wxm-st-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.wxm-st-body strong {
  font-size: 0.9rem;
  line-height: 1.2;
}
.wxm-st-body small {
  font-size: 0.75rem;
  color: var(--ink-soft);
}
.wxm-st-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 8px;
  margin-top: 2px;
}
.wxm-st-line > span {
  white-space: nowrap;
}
.wxm-net {
  display: inline-block;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  color: #fff;
  background: #1c5cab;
}
.wxm-net.inforiego { background: #2d6a3e; }
.wxm-net.meteoclimatic { background: #6b4f9c; }
.wxm-age {
  flex: 0 0 auto;
  align-self: flex-start;
  font-size: 0.7rem;
  color: var(--ink-soft);
}
.wxm-age.stale {
  font-weight: 700;
  color: #a35a00;
}
.wxm-now {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.wxm-now-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--paper);
}
.wxm-sw,
.wxm-seg i,
.wxm-table i {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
.wxm-now-label {
  font-size: 0.8rem;
  color: var(--ink-soft);
}
.wxm-now-sky {
  font-size: 1.3rem;
}
.wxm-strip {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 6px;
  scrollbar-width: thin;
}
.wxm-hour {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 52px;
  padding: 8px 4px;
  border-radius: 12px;
  font-size: 0.75rem;
  color: var(--ink-soft);
  background: var(--paper);
}
.wxm-hour-sky {
  font-size: 1.3rem;
}
.wxm-hour strong {
  font-size: 0.95rem;
  color: var(--ink);
}
.wxm-seg {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.wxm-seg button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink);
  background: var(--paper);
  cursor: pointer;
}
.wxm-seg button.on {
  border-color: var(--ink);
  box-shadow: inset 0 0 0 1px var(--ink);
}
.wxm-days {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 8px;
}
.wxm-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 6px;
  border-radius: 14px;
  text-align: center;
  background: var(--paper);
}
.wxm-day-name {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: capitalize;
}
.wxm-day-sky {
  font-size: 1.8rem;
}
.wxm-day-temps strong {
  font-size: 1.05rem;
}
.wxm-day-temps span {
  color: var(--ink-soft);
}
.wxm-day small {
  font-size: 0.72rem;
  color: var(--ink-soft);
}
.wxm-table-wrap {
  overflow-x: auto;
}
.wxm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
  font-variant-numeric: tabular-nums;
}
.wxm-table th,
.wxm-table td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  white-space: nowrap;
}
.wxm-table th i {
  margin-right: 5px;
}
.wxm-table td:first-child {
  font-weight: 700;
  text-transform: capitalize;
}
.wxm-foot {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 14px 24px 20px;
  font-size: 0.74rem;
  color: var(--ink-soft);
}
.wxm-foot a {
  color: inherit;
}
:deep(.wch) + :deep(.wch) {
  margin-top: 14px;
}
@keyframes wxm-fade { from { opacity: 0; } }
@keyframes wxm-rise { from { opacity: 0; transform: translateY(30px) scale(0.97); } }
@media (prefers-reduced-motion: reduce) {
  .wxm, .wxm-overlay { animation: none; }
}
@media (max-width: 640px) {
  .wxm-overlay { padding: 0; }
  .wxm { width: 100%; height: 100dvh; max-height: 100dvh; border-radius: 0; }
  .wxm-head { padding: 20px 16px 10px; }
  .wxm-sec { margin: 12px 12px 0; padding: 12px; }
  .wxm-foot { margin: 14px 16px 20px; }
}
</style>

<style>
[data-theme='dark'] .wxm {
  --ink: #eef2f6;
  --ink-soft: #a9b4be;
  --paper: #161b21;
  --card: #1f262e;
  --line: rgba(255, 255, 255, 0.1);
  --accent: #3987e5;
}
[data-theme='dark'] .wxm .wxm-age.stale { color: #f0a54a; }
</style>
