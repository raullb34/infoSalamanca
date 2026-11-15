<template>
  <!-- Rutas culturales: la lista de rutas o, abierta una, su ficha con las paradas numeradas como en el mapa -->
  <div class="rc">
    <!-- Lista -->
    <template v-if="!route">
      <header class="rc-head">
        <div class="rc-title-row">
          <h2 class="rc-title">🗺️ Rutas culturales</h2>
          <button type="button" class="rc-clear" title="Quitar el filtro" @click="$emit('clearFilter')">Quitar filtro ✕</button>
        </div>
        <p class="rc-sub">{{ RUTAS.length }} rutas oficiales · {{ townCount }} pueblos. Elige una para verla en el mapa.</p>
      </header>
      <div class="rc-list">
        <button v-for="r in RUTAS" :key="r.id" type="button" class="rc-card" :style="{ '--c': r.color }" @click="open(r)">
          <span class="rc-card-icon" aria-hidden="true">{{ r.icono }}</span>
          <span class="rc-card-body">
            <strong>{{ r.nombre }}</strong>
            <small>{{ r.lema }}</small>
            <span class="rc-card-meta">{{ summary(r) }}</span>
          </span>
          <span class="rc-card-go" aria-hidden="true">→</span>
        </button>
      </div>
    </template>

    <!-- Ficha de una ruta -->
    <article v-else class="rc-route" :style="{ '--c': route.color }">
      <button type="button" class="rc-back" @click="close">← Todas las rutas</button>
      <header class="rc-hero">
        <span class="rc-hero-icon" aria-hidden="true">{{ route.icono }}</span>
        <div>
          <h2 class="rc-hero-title">{{ route.nombre }}</h2>
          <p class="rc-hero-lema">{{ route.lema }}</p>
        </div>
      </header>
      <p class="rc-desc">{{ route.descripcion }}</p>
      <p class="rc-facts">
        <span>{{ stops.length }} paradas</span>
        <span v-for="t in route.tramos.filter(t => t.km)" :key="t.nombre || 'km'">{{ t.nombre ? `${t.nombre}: ` : '' }}{{ t.km }} km</span>
        <span v-if="route.circular">Senderos circulares de 7 a 10 km</span>
      </p>

      <section v-for="(t, ti) in route.tramos" :key="ti" class="rc-tramo">
        <h3 v-if="t.nombre" class="rc-tramo-name">{{ t.nombre }}</h3>
        <ol class="rc-stops">
          <li v-for="(p, pi) in t.paradas" :key="`${ti}-${pi}`">
            <button type="button" class="rc-stop" @click="focusTown(p)">
              <span class="rc-n" :class="{ again: repeated(ti, p) }">{{ stopNumber(route, p) }}</span>
              <span v-if="photos[keyOf(p)]" class="rc-photo"><img :src="photos[keyOf(p)].src" :alt="photoAlt(p)" loading="lazy" @error="photos[keyOf(p)] = null" /></span>
              <span class="rc-stop-body">
                <strong>{{ p.localidad || p.municipio }}</strong>
                <small v-if="p.localidad">{{ p.municipio }}</small>
                <span v-if="p.lugar" class="rc-lugar">{{ p.lugar }}</span>
              </span>
            </button>
          </li>
        </ol>
      </section>

      <p v-if="route.fuera.length" class="rc-note">↔ Fuera del mapa: {{ route.fuera.join(' · ') }}</p>
      <p v-if="route.nota" class="rc-note">{{ route.nota }}</p>
      <p class="rc-source">
        Fuente: <a :href="route.fuente.url" target="_blank" rel="noopener">{{ route.fuente.nombre }}</a>.
        <template v-if="photoCredits.length"> Fotos: Wikimedia Commons ({{ photoCredits.join(', ') }}).</template>
      </p>
    </article>
  </div>
</template>

<script>
import { reactive, computed, watch } from 'vue'
import { RUTAS, state, selectedRoute, numberedStops, stopNumber, stopKey as keyOf, townCount } from '@/utils/rutasCulturales'
import { apiService } from '@/services/apiService'

// Solo se busca foto cuando el lugar nombra un monumento ("Iglesia de San Juan (BIC)", "Castillo…").
// Con dos iglesias (Alba de Tormes: San Juan y Santiago) se busca la segunda: "San Juan" a secas también
// encaja con la iglesia de San Juan de la Cruz, que es otra
const MONUMENT = /^(iglesia|iglesias|castillo|castro|convento|santuario|recinto|jard[ií]n|ermita|catedral|monasterio)/i
const photoName = (lugar) => String(lugar || '').replace(/\s*\(BIC\)/g, '').split(/[:,]/)[0].replace(/^Iglesias de (.+?) y de (.+)$/i, 'Iglesia de $2').trim()

export default {
  name: 'RutasCulturales',
  emits: ['clearFilter'],
  setup() {
    const route = computed(selectedRoute)
    const stops = computed(() => (route.value ? numberedStops(route.value) : []))
    const photos = reactive({})

    // Una parada que ya salió en otro camino (inicio y final comunes de la Ruta Teresiana)
    const repeated = (ti, p) => ti > 0 && route.value.tramos.slice(0, ti).some(t => t.paradas.some(o => o.ine === p.ine && (o.localidad || '') === (p.localidad || '')))

    const summary = (r) => {
      const n = numberedStops(r).length
      const parts = [`${n} ${n === 1 ? 'parada' : 'paradas'}`]
      if (r.tramos.length > 1) parts.push(`${r.tramos.length} ${r.circular ? 'senderos' : 'caminos'}`)
      const km = r.tramos.reduce((s, t) => s + (t.km || 0), 0)
      if (km && r.tramos.length === 1) parts.push(`${km} km`)
      return parts.join(' · ')
    }

    // Abrir una ruta: el mapa 2D se ajusta a ella (lo hace la capa) y el 3D vuela al primer tramo
    const open = (r) => {
      state.selectedId = r.id
      window.dispatchEvent(new CustomEvent('highlightRoute', { detail: { ruta: `cultural-${r.id}-0`, focus: true } }))
    }
    const close = () => { state.selectedId = null }
    const focusTown = (p) => window.dispatchEvent(new CustomEvent('highlightMunicipio', { detail: { municipioId: p.ine } }))

    // Fotos de los monumentos de las paradas (de una en una para no cargar Commons)
    watch(route, async (r) => {
      if (!r) return
      for (const p of numberedStops(r)) {
        if (!MONUMENT.test(p.lugar || '') || p.key in photos) continue
        photos[p.key] = null
        const foto = await apiService.getPlacePhoto({ lat: p.lat, lon: p.lon, nombre: photoName(p.lugar), pueblo: p.localidad || p.municipio })
        if (state.selectedId !== r.id) return
        photos[p.key] = foto
      }
    }, { immediate: true })
    const photoAlt = (p) => `${photoName(p.lugar)}, ${p.localidad || p.municipio}`
    const photoCredits = computed(() => [...new Set(stops.value.map(p => photos[p.key]?.author).filter(Boolean))].slice(0, 6))

    return { RUTAS, townCount, keyOf, route, stops, photos, repeated, summary, open, close, focusTown, stopNumber, photoAlt, photoCredits }
  }
}
</script>

<style scoped>
.rc-head {
  margin-bottom: 12px;
}
.rc-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.rc .rc-title {
  margin: 0;
  padding: 0;
  border: none;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-primary);
}
.rc-clear {
  flex-shrink: 0;
  padding: 2px 4px;
  border: none;
  border-radius: 6px;
  font-size: 0.78rem;
  color: var(--text-muted);
  background: none;
  cursor: pointer;
}
.rc-clear:hover {
  color: var(--danger-color, #e53935);
  background: var(--bg-secondary);
}
.rc-sub {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
}
.rc-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rc-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-light);
  border-left: 5px solid var(--c);
  border-radius: 12px;
  text-align: left;
  font: inherit;
  color: var(--text-primary);
  background: var(--bg-primary);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.rc-card:hover,
.rc-card:focus-visible {
  border-color: var(--c);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}
.rc-card-icon {
  font-size: 1.6rem;
}
.rc-card-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.rc-card-body strong {
  font-size: 0.95rem;
}
.rc-card-body small {
  font-size: 0.78rem;
  line-height: 1.3;
  color: var(--text-secondary);
}
.rc-card-meta {
  margin-top: 3px;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-muted);
}
.rc-card-go {
  color: var(--text-muted);
}
.rc-back {
  margin: 0 0 10px;
  padding: 4px 0;
  border: none;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--primary-color);
  background: none;
  cursor: pointer;
}
.rc-hero {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  color: #fff;
  background: linear-gradient(135deg, color-mix(in srgb, var(--c) 78%, #000), var(--c));
}
.rc-hero-icon {
  font-size: 2rem;
}
.rc .rc-hero-title {
  margin: 0;
  padding: 0;
  border: none;
  font-size: 1.2rem;
  font-weight: 800;
  line-height: 1.2;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}
.rc-hero-lema {
  margin: 2px 0 0;
  font-size: 0.82rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}
.rc-desc {
  margin: 12px 0 6px;
  font-size: 0.86rem;
  line-height: 1.5;
  color: var(--text-primary);
}
.rc-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 6px;
}
.rc-facts span {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-secondary);
}
.rc-tramo-name {
  margin: 14px 0 4px;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.rc-stops {
  position: relative;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}
/* La línea del recorrido, como en el mapa */
.rc-stops::before {
  content: '';
  position: absolute;
  top: 16px;
  bottom: 16px;
  left: 15px;
  width: 3px;
  border-radius: 2px;
  background: var(--c);
  opacity: 0.45;
}
.rc-stop {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 6px 4px 6px 0;
  border: none;
  border-radius: 10px;
  text-align: left;
  font: inherit;
  color: var(--text-primary);
  background: none;
  cursor: pointer;
}
.rc-stop:hover,
.rc-stop:focus-visible {
  background: var(--bg-secondary);
}
.rc-n {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 3px solid var(--bg-primary);
  border-radius: 50%;
  font-size: 0.82rem;
  font-weight: 800;
  color: #fff;
  background: #16202a;
  box-shadow: 0 0 0 2px var(--c);
}
.rc-n.again {
  color: #16202a;
  background: var(--bg-primary);
}
.rc-photo {
  flex: 0 0 auto;
  width: 64px;
  height: 48px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--bg-secondary);
}
.rc-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.rc-stop-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-top: 2px;
}
.rc-stop-body strong {
  font-size: 0.9rem;
  line-height: 1.25;
}
.rc-stop-body small {
  font-size: 0.74rem;
  color: var(--text-muted);
}
.rc-lugar {
  font-size: 0.78rem;
  line-height: 1.35;
  color: var(--text-secondary);
}
.rc-note {
  margin: 10px 0 0;
  font-size: 0.78rem;
  color: var(--text-secondary);
}
.rc-source {
  margin: 12px 0 0;
  font-size: 0.72rem;
  color: var(--text-muted);
}
.rc-source a {
  color: inherit;
}
[data-theme='dark'] .rc-n {
  border-color: var(--bg-primary);
  color: #16202a;
  background: #eef2f6;
}
[data-theme='dark'] .rc-n.again {
  color: #eef2f6;
  background: var(--bg-primary);
}
</style>
