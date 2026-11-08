<template>
  <div class="map-controls" role="group" aria-label="Zoom del mapa">
    <button type="button" title="Acercar" aria-label="Acercar" @click="$emit('zoomIn')">+</button>
    <button type="button" title="Alejar" aria-label="Alejar" @click="$emit('zoomOut')">−</button>
    <button type="button" title="Ver toda la provincia" aria-label="Ver toda la provincia" @click="$emit('reset')">⟲</button>
  </div>
</template>

<script>
// Botones de zoom del mapa (2D y 3D). App.vue los conecta con el mapa visible.
export default {
  name: 'MapControls',
  emits: ['zoomIn', 'zoomOut', 'reset']
}
</script>

<style scoped>
.map-controls {
  position: fixed;
  right: 16px;
  bottom: 24px;
  z-index: 900;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-primary);
  border: 1px solid var(--border-secondary);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
  transition: right 0.35s ease;
}

button {
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}

button + button {
  border-top: 1px solid var(--border-light);
}

button:hover {
  background: var(--hover-bg, rgba(0, 0, 0, 0.05));
}

button:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: -2px;
}
</style>

<style>
@media (min-width: 768px) {
  #app:has(#sidebar.open) .map-controls {
    right: calc(var(--right-panel-w) + 16px);
  }
}
/* En móvil con la ficha abierta no hay sitio: se zoomea con los dedos */
@media (max-width: 767px) {
  #app:has(#sidebar.open) .map-controls {
    display: none;
  }
}
</style>
