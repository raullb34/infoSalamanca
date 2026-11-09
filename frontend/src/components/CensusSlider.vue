<template>
  <!-- Deslizador de los censos (1842–2021): el mapa colorea cada pueblo con su población de ese año -->
  <div class="census" role="group" aria-label="Año del censo">
    <button
      type="button"
      class="census-play"
      :aria-label="playing ? 'Pausar' : 'Reproducir los censos'"
      @click="toggle"
    >{{ playing ? '❚❚' : '▶' }}</button>
    <div class="census-body">
      <div class="census-head">
        <span class="census-year">{{ years[index] }}</span>
        <span class="census-caption">Población en el censo</span>
      </div>
      <input
        type="range"
        class="census-range"
        :min="0"
        :max="years.length - 1"
        :value="index"
        :aria-valuetext="`Censo de ${years[index]}`"
        aria-label="Año del censo"
        @input="select(Number($event.target.value))"
      />
      <div class="census-ticks" aria-hidden="true">
        <span>{{ years[0] }}</span><span>1900</span><span>1950</span><span>{{ years[years.length - 1] }}</span>
      </div>
    </div>
    <ul class="census-legend" aria-label="Habitantes">
      <li v-for="b in buckets" :key="b.label">
        <span class="census-swatch" :style="{ background: b.color }"></span>{{ b.label }}
      </li>
    </ul>
  </div>
</template>

<script>
import { computed, onBeforeUnmount, ref } from 'vue'

export default {
  name: 'CensusSlider',
  props: {
    years: { type: Array, required: true },
    modelValue: { type: Number, required: true }, // año seleccionado
    buckets: { type: Array, default: () => [] } // [{ color, label }]
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const index = computed(() => Math.max(0, props.years.indexOf(props.modelValue)))
    const select = (i) => emit('update:modelValue', props.years[i])

    // Reproducir: un censo cada 0,9 s (sin animación si el sistema pide menos movimiento, igual avanza)
    const playing = ref(false)
    let timer = null
    const stop = () => { playing.value = false; clearInterval(timer) }
    const toggle = () => {
      if (playing.value) return stop()
      playing.value = true
      if (index.value >= props.years.length - 1) select(0)
      timer = setInterval(() => {
        if (index.value >= props.years.length - 1) return stop()
        select(index.value + 1)
      }, 900)
    }
    onBeforeUnmount(stop)

    return { index, select, playing, toggle }
  }
}
</script>

<style scoped>
.census {
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  z-index: 940;
  width: min(560px, calc(100vw - 32px));
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  align-items: center;
  padding: 10px 14px;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #222);
  border: 1px solid var(--border-primary, #ddd);
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}
.census-play {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 0;
  background: var(--primary-color, #4caf50);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}
.census-play:focus-visible {
  outline: 2px solid var(--text-primary, #222);
  outline-offset: 2px;
}
.census-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.census-year {
  font-size: 1.3rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.census-caption {
  font-size: 0.8rem;
  color: var(--text-secondary, #666);
}
.census-range {
  width: 100%;
  accent-color: var(--primary-color, #4caf50);
}
.census-ticks {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  color: var(--text-secondary, #666);
}
.census-legend {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.72rem;
  color: var(--text-secondary, #555);
}
.census-legend li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.census-swatch {
  width: 14px;
  height: 10px;
  border-radius: 2px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
}
</style>

<style>
/* Con la ficha abierta, el deslizador se centra en el hueco del mapa */
@media (min-width: 768px) {
  #app:has(#sidebar.open) .census {
    left: calc(50% - var(--right-panel-w) / 2);
  }
}
</style>
