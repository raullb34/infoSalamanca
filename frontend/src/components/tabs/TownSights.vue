<template>
  <!-- Qué ver en el pueblo seleccionado, para ir montando la ruta -->
  <section class="town-sights" :aria-label="`Qué ver en ${town.name}`">
    <p class="ts-kicker">Pueblo seleccionado</p>
    <h2 class="ts-title">🏛️ Qué ver en {{ town.name }}</h2>

    <p v-if="loading" class="ts-empty">Cargando lugares…</p>
    <ul v-else-if="pois.length" class="ts-list">
      <li v-for="(poi, i) in pois" :key="poi.identificador || poi.id || i" class="ts-item">
        <button type="button" class="ts-open" @click="selected = poi">
          <span class="ts-name">{{ poi.nombre || poi.name }}</span>
          <span v-if="poi.tipomonumento || poi.clasificacion" class="ts-type">{{ poi.tipomonumento || poi.clasificacion }}</span>
        </button>
        <button
          type="button"
          class="ts-add"
          :class="{ added: inRoute(poi) }"
          :disabled="inRoute(poi)"
          :title="inRoute(poi) ? 'Ya está en tu ruta' : 'Añadir a la ruta'"
          @click="add(poi)"
        >{{ inRoute(poi) ? '✓' : '+' }}</button>
      </li>
    </ul>
    <p v-else class="ts-empty">La Junta no tiene monumentos catalogados en este pueblo.</p>

    <!-- Fuera del panel: su transform encerraría el diálogo en 320 px -->
    <Teleport to="body">
      <POIDialog :isOpen="!!selected" :poi="selected || {}" @close="selected = null" @addToRoute="poi => { add(poi); selected = null }" />
    </Teleport>
  </section>
</template>

<script>
import { ref } from 'vue'
import POIDialog from '@/components/POIDialog.vue'

export default {
  name: 'TownSights',
  components: { POIDialog },
  props: {
    town: { type: Object, required: true },
    pois: { type: Array, default: () => [] },
    routeList: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false }
  },
  emits: ['addPoiToRoute'],
  setup(props, { emit }) {
    const selected = ref(null)
    // Mismo criterio que App.handleAddPoiToRoute para saber si ya está
    const inRoute = (poi) => props.routeList.some(r => (poi.id && r.id === poi.id) || r.name === (poi.nombre || poi.name))
    const add = (poi) => emit('addPoiToRoute', poi)
    return { selected, inRoute, add }
  }
}
</script>

<style scoped>
.town-sights {
  margin-bottom: 18px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-light);
}
.ts-kicker {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--primary-color);
}
.town-sights .ts-title {
  margin: 0 0 10px;
  padding: 0;
  border: none;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-primary);
}
.ts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ts-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px 4px 4px;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-primary);
}
.ts-item:hover {
  border-color: var(--primary-color);
}
.ts-open {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 6px 8px;
  border: none;
  border-radius: 8px;
  text-align: left;
  background: none;
  cursor: pointer;
}
.ts-name {
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--text-primary);
}
.ts-type {
  font-size: 0.75rem;
  color: var(--text-secondary);
}
.ts-add {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  font-size: 1.1rem;
  font-weight: 700;
  color: #fff;
  background: var(--primary-color);
  cursor: pointer;
}
.ts-add:hover:not(:disabled) {
  background: var(--primary-hover);
}
.ts-add.added {
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 15%, transparent);
  cursor: default;
}
.ts-empty {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-muted);
}
</style>
