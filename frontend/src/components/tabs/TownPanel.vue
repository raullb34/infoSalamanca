<template>
  <!-- Pueblo pulsado en el mapa: sus productores Tierra de Sabor y su agenda cultural.
       La ficha de la derecha se queda con los datos del pueblo; lo que ver va en la pestaña Rutas. -->
  <section class="town-panel" :aria-label="`En ${town.name}`">
    <header class="tp-head">
      <div>
        <p class="tp-kicker">Pueblo seleccionado</p>
        <h2 class="tp-title">En {{ town.name }}</h2>
      </div>
      <button type="button" class="tp-close" title="Quitar el pueblo" aria-label="Quitar el pueblo" @click="$emit('closeTown')">✕</button>
    </header>

    <!-- Tierra de Sabor -->
    <h3 class="tp-section">
      <span aria-hidden="true">🍯</span> Tierra de Sabor
      <span v-if="producers.length" class="tp-count">{{ producers.length }}</span>
    </h3>
    <p v-if="loadingProducers" class="tp-empty">Buscando productores…</p>
    <div v-else-if="producers.length" class="tp-list">
      <article
        v-for="p in producers"
        :key="p.idempresa"
        class="tp-card"
        tabindex="0"
        @click="selectedProducer = p"
        @keydown.enter="selectedProducer = p"
      >
        <ProducerAvatar :producer="p" :size="46" />
        <div class="tp-body">
          <h4 class="tp-name">{{ niceCase(p.nombre_comercial) }}</h4>
          <p class="tp-meta">{{ (p.secciones || []).join(', ') }}<template v-if="p.num_productos"> · {{ p.num_productos }} productos</template></p>
          <div class="tp-actions">
            <a v-if="p.venta?.online" :href="p.venta.online.url" target="_blank" rel="noopener noreferrer" class="tp-chip buy" @click.stop @keydown.enter.stop>🛒 Tienda</a>
            <a v-if="p.venta?.telefono" :href="`tel:${p.venta.telefono.replace(/\s/g, '')}`" class="tp-chip" @click.stop @keydown.enter.stop>📞 Llamar</a>
            <span class="tp-chip ghost">Ver productos →</span>
          </div>
        </div>
      </article>
    </div>
    <p v-else class="tp-empty">Ningún productor de este pueblo tiene el sello.</p>

    <!-- Agenda cultural -->
    <h3 class="tp-section">
      <span aria-hidden="true">🎭</span> Eventos culturales
      <span v-if="upcoming.length" class="tp-count">{{ upcoming.length }}</span>
    </h3>
    <p v-if="loading" class="tp-empty">Cargando agenda…</p>
    <div v-else-if="upcoming.length" class="tp-list">
      <article
        v-for="(ev, i) in upcoming"
        :key="ev.id || `${ev.titulo}-${i}`"
        class="tp-card"
        tabindex="0"
        @click="$emit('openEvent', ev)"
        @keydown.enter="$emit('openEvent', ev)"
      >
        <div class="tp-date" aria-hidden="true">
          <span class="tp-day">{{ dayOf(ev) }}</span>
          <span class="tp-month">{{ monthOf(ev) }}</span>
        </div>
        <div class="tp-body">
          <h4 class="tp-name">{{ ev.titulo || ev.title }}</h4>
          <p class="tp-meta">{{ [ev.categoria || ev.tematica, ev.hora_inicio].filter(Boolean).join(' · ') }}</p>
          <p v-if="ev.lugar_celebracion || ev.ubicacion || ev.location" class="tp-sub">📍 {{ ev.lugar_celebracion || ev.ubicacion || ev.location }}</p>
        </div>
      </article>
    </div>
    <p v-else class="tp-empty">No hay eventos culturales anunciados.</p>

    <!-- Cine del pueblo y lo que echa -->
    <template v-if="cines.length">
      <h3 class="tp-section"><span aria-hidden="true">🎬</span> En el cine</h3>
      <div class="tp-list">
        <article
          v-for="c in cines"
          :key="c.id"
          class="tp-card tp-cine"
          tabindex="0"
          @click="selectedCine = c"
          @keydown.enter="selectedCine = c"
        >
          <div class="tp-body">
            <h4 class="tp-name">{{ c.nombre }}</h4>
            <template v-if="nextDay(c)">
              <p class="tp-meta">{{ capitalize(dayLabel(nextDay(c).day)) }}:</p>
              <ul class="tp-films">
                <li v-for="f in nextDay(c).films.slice(0, 4)" :key="f.titulo">
                  <img v-if="f.cartel" :src="f.cartel" alt="" loading="lazy" />
                  <span v-else class="tp-noposter" aria-hidden="true">🎞️</span>
                  <span class="tp-film-title">{{ f.titulo }}</span>
                  <span class="tp-film-times">{{ timesOn(f, nextDay(c).day) }}</span>
                </li>
              </ul>
              <span class="tp-chip ghost">Ver toda la cartelera →</span>
            </template>
            <p v-else class="tp-sub">{{ cineSummary(c) }}</p>
          </div>
        </article>
      </div>
    </template>

    <!-- Qué ver: está en Rutas, para ir añadiendo sitios a la ruta -->
    <button type="button" class="tp-goto" @click="$emit('goTab', 'rutas')">
      <span aria-hidden="true">🏛️</span>
      <span><strong>Qué ver en {{ town.name }}</strong><small>{{ poiCount ? `${poiCount} ${poiCount === 1 ? 'lugar' : 'lugares'} · en la pestaña Rutas` : 'En la pestaña Rutas' }}</small></span>
      <span aria-hidden="true">→</span>
    </button>

    <CineDialog v-if="selectedCine" :cine="selectedCine" @close="selectedCine = null" />
    <TierraSaborShowcase v-if="selectedProducer" :producer="selectedProducer" @close="selectedProducer = null" />
  </section>
</template>

<script>
import { ref, computed, watch } from 'vue'
import TierraSaborShowcase from '@/components/TierraSaborShowcase.vue'
import { producersIn } from '@/utils/tierraSaborList'
import ProducerAvatar from '@/components/ProducerAvatar.vue'
import CineDialog from '@/components/CineDialog.vue'
import { apiService } from '@/services/apiService'
import { nextDay, dayLabel, cineSummary } from '@/utils/cines'
import { niceCase } from '@/utils/tierraSabor'

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const parseDay = (s) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
}
const startOf = (ev) => parseDay(ev.fecha_inicio || ev.date || ev.fecha)

export default {
  name: 'TownPanel',
  components: { TierraSaborShowcase, ProducerAvatar, CineDialog },
  props: {
    town: { type: Object, required: true },
    events: { type: Array, default: () => [] },
    poiCount: { type: Number, default: 0 },
    loading: { type: Boolean, default: false }
  },
  emits: ['openEvent', 'goTab', 'closeTown'],
  setup(props) {
    const producers = ref([])
    const loadingProducers = ref(false)
    const selectedProducer = ref(null)
    const cines = ref([])
    const selectedCine = ref(null)

    watch(() => props.town?.id, async (id) => {
      selectedProducer.value = null
      selectedCine.value = null
      producers.value = []
      cines.value = []
      if (!id) return
      apiService.getCines(id).then(list => { if (props.town?.id === id) cines.value = list })
      loadingProducers.value = true
      const list = await producersIn(id)
      if (props.town?.id === id) producers.value = list // por si ya se ha pulsado otro pueblo
      loadingProducers.value = false
    }, { immediate: true })

    // De hoy en adelante (si no tienen fecha, al final)
    const upcoming = computed(() => {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      return (props.events || [])
        .filter(ev => {
          const end = parseDay(ev.fecha_fin) || startOf(ev)
          return !end || end >= today
        })
        .sort((a, b) => (startOf(a) || Infinity) - (startOf(b) || Infinity))
    })

    const dayOf = (ev) => startOf(ev)?.getDate() ?? '—'
    const monthOf = (ev) => { const d = startOf(ev); return d ? MONTHS[d.getMonth()] : '' }

    const timesOn = (f, day) => f.sesiones.filter(s => s.inicio.startsWith(day)).map(s => s.inicio.slice(11, 16)).join(' · ')
    const capitalize = (t) => t.charAt(0).toUpperCase() + t.slice(1)

    return {
      producers, loadingProducers, selectedProducer, upcoming, dayOf, monthOf, niceCase,
      cines, selectedCine, nextDay, dayLabel, cineSummary, timesOn, capitalize
    }
  }
}
</script>

<style scoped>
.town-panel {
  margin-bottom: 18px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-light);
  animation: tp-in 0.3s ease backwards;
}
.tp-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.tp-kicker {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--primary-color);
}
.town-panel .tp-title {
  margin: 0;
  padding: 0;
  border: none;
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-primary);
}
.tp-close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  font-size: 0.8rem;
  color: var(--text-muted);
  background: var(--bg-secondary);
  cursor: pointer;
}
.tp-close:hover {
  color: var(--text-primary);
}
.town-panel .tp-section {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 16px 0 8px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.tp-count {
  padding: 0 7px;
  border-radius: 999px;
  font-size: 0.7rem;
  line-height: 1.6;
  color: #fff;
  background: var(--primary-color);
}
.tp-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tp-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-primary);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.tp-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}
.tp-card:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}
.tp-date {
  flex-shrink: 0;
  width: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0;
  border-radius: 10px;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 12%, var(--bg-primary));
}
.tp-day {
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.1;
}
.tp-month {
  font-size: 0.66rem;
  font-weight: 600;
  text-transform: uppercase;
}
.tp-body {
  flex: 1;
  min-width: 0;
}
.town-panel .tp-name {
  margin: 0 0 2px;
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--text-primary);
}
.tp-meta,
.tp-sub {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.35;
  color: var(--text-secondary);
}
.tp-sub {
  font-size: 0.75rem;
  color: var(--text-muted);
}
.tp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin-top: 6px;
}
.tp-chip {
  padding: 3px 8px;
  border: 1px solid var(--border-primary);
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  text-decoration: none;
  color: var(--text-primary) !important;
}
.tp-chip.buy {
  border-color: var(--primary-color);
  color: #fff !important;
  background: var(--primary-color);
}
.tp-chip.ghost {
  border-color: transparent;
  color: var(--primary-color) !important;
}
.tp-films {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 6px 0 8px;
  padding: 0;
  list-style: none;
}
.tp-films li {
  display: grid;
  grid-template-columns: 28px 1fr;
  grid-template-rows: auto auto;
  column-gap: 8px;
  align-items: center;
  font-size: 0.8rem;
}
.tp-films img {
  grid-row: span 2;
  width: 28px;
  height: 40px;
  object-fit: cover;
  border-radius: 3px !important;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2) !important;
}
.tp-noposter {
  grid-row: span 2;
  display: grid;
  place-items: center;
  width: 28px;
  height: 40px;
  border-radius: 3px;
  background: var(--bg-secondary);
}
.tp-film-title {
  font-weight: 600;
  line-height: 1.2;
  color: var(--text-primary);
}
.tp-film-times {
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}
.tp-empty {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-muted);
}
.tp-goto {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-top: 16px;
  padding: 12px 14px;
  border: 1px dashed var(--primary-color);
  border-radius: 12px;
  text-align: left;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--primary-color) 7%, var(--bg-primary));
  cursor: pointer;
}
.tp-goto > span:first-child {
  font-size: 1.4rem;
}
.tp-goto > span:nth-child(2) {
  flex: 1;
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
}
.tp-goto small {
  font-size: 0.75rem;
  color: var(--text-secondary);
}
.tp-goto:hover {
  border-style: solid;
}
@keyframes tp-in {
  from { opacity: 0; transform: translateY(8px); }
}
@media (prefers-reduced-motion: reduce) {
  .town-panel { animation: none; }
}
</style>
