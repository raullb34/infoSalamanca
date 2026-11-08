<template>
  <div class="map-view-switch" role="radiogroup" aria-label="Vista del mapa">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="radio"
      :aria-checked="mode === opt.value"
      :class="{ active: mode === opt.value }"
      :title="opt.title"
      @click="$emit('change', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script>
// Selector de vista del mapa: 2D (mapa de siempre) o 3D (relieve por altitud)
export default {
  name: 'MapViewSwitch',
  props: {
    mode: { type: String, default: '2d' }
  },
  emits: ['change'],
  setup() {
    const options = [
      { value: '2d', label: '2D', title: 'Mapa plano' },
      { value: '3d', label: '3D', title: 'Relieve: cada municipio con la altura de su altitud real' }
    ]
    return { options }
  }
}
</script>

<style scoped>
/* Va dentro de la barra superior (App.vue) */
.map-view-switch {
  flex-shrink: 0;
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  background: var(--bg-primary);
  border: 1px solid var(--border-secondary);
}

button {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.8rem;
  padding: 5px 14px;
  border-radius: 999px;
  cursor: pointer;
}

button.active {
  background: var(--primary-color);
  color: var(--text-light, #fff);
}

button:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

@media (max-width: 767px) {
  button {
    padding: 5px 10px;
  }
}
</style>

