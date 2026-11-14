<template>
  <!-- El tiempo del pueblo en una tarjeta: la estación con dato reciente más cercana y lo previsto ahora.
       Al pulsarla se abre "El tiempo en {pueblo}" en grande. -->
  <div class="wxc-wrap">
    <button type="button" class="wxc" :aria-label="`El tiempo en ${town.name}`" @click="open = true">
      <span class="wxc-icon" aria-hidden="true">{{ now ? skyOf(now.weather_code).icon : '🌡️' }}</span>
      <span class="wxc-body">
        <strong>El tiempo</strong>
        <small v-if="loading">Cargando…</small>
        <template v-else>
          <small v-if="station">{{ fmtTemp(station.variables.temperature.value) }} en {{ nearName }}, a {{ Math.max(1, Math.round(station.distanceKm)) }} km · {{ ago(station.lastObservationAt) }}</small>
          <small v-if="now">Previsto ahora: {{ fmtTemp(now.temperature) }}, {{ skyOf(now.weather_code).label.toLowerCase() }}</small>
          <small v-if="!station && !now">Previsión y estaciones cercanas</small>
        </template>
      </span>
      <span class="wxc-go" aria-hidden="true">→</span>
    </button>
    <WeatherDialog v-if="open" :town="town" @close="open = false" @openStation="st => (selectedStation = st)" />
    <StationDialog v-if="selectedStation" :station="selectedStation" @close="selectedStation = null" />
  </div>
</template>

<script>
import { ref, watch, defineAsyncComponent } from 'vue'
import { weatherApi, skyOf, fmtTemp, ago, stationName } from '@/utils/weather'

const WeatherDialog = defineAsyncComponent(() => import('./WeatherDialog.vue'))
const StationDialog = defineAsyncComponent(() => import('./StationDialog.vue'))

export default {
  name: 'WeatherCard',
  components: { WeatherDialog, StationDialog },
  // `town`: { id (INE o pieza del mapa), name }
  props: { town: { type: Object, required: true } },
  setup(props) {
    const open = ref(false)
    const selectedStation = ref(null)
    const loading = ref(false)
    const station = ref(null)
    const now = ref(null)
    const nearName = ref('')

    watch(() => props.town?.id, async (id) => {
      open.value = false
      selectedStation.value = null
      station.value = null
      now.value = null
      if (!id) return
      loading.value = true
      try {
        const r = await weatherApi.current(String(id).split('_')[0])
        if (props.town?.id !== id) return // ya se ha pulsado otro pueblo
        station.value = (r.observations || []).filter(o => o.recent && o.variables?.temperature).sort((a, b) => a.distanceKm - b.distanceKm)[0] || null
        now.value = (r.forecastNow || []).find(m => m.model === 'ecmwf_ifs025') || (r.forecastNow || [])[0] || null
        nearName.value = station.value ? stationName(station.value.name).replace(/,.*$/, '') : ''
      } catch { /* sin datos: la tarjeta sigue abriendo el diálogo */ }
      if (props.town?.id === id) loading.value = false
    }, { immediate: true })

    return { open, selectedStation, loading, station, now, nearName, skyOf, fmtTemp, ago }
  }
}
</script>

<style scoped>
.wxc {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 0;
  border-radius: 14px;
  text-align: left;
  font: inherit;
  color: #fff;
  background: linear-gradient(135deg, #1c5cab, #2a78d6 60%, #6da7ec);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.wxc:hover,
.wxc:focus-visible {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(28, 92, 171, 0.35);
}
.wxc-icon {
  font-size: 1.8rem;
}
.wxc-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.wxc-body strong {
  font-size: 1rem;
}
.wxc-body small {
  font-size: 0.8rem;
  opacity: 0.95;
}
.wxc-go {
  font-size: 1.1rem;
}
@media (prefers-reduced-motion: reduce) {
  .wxc { transition: none; }
}
</style>
