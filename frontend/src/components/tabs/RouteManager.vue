<template>
  <!-- Tu ruta: los pueblos y sitios que has ido añadiendo, y abrirla en Google Maps.
       Colores del tema (sin clases de Bootstrap: su .text-muted fija un gris de modo claro con !important). -->
  <section class="rm" aria-labelledby="rm-title">
    <h2 id="rm-title" class="rm-title"><span aria-hidden="true">🧭</span> Tu ruta</h2>

    <ol v-if="routeList.length" class="rm-list">
      <li v-for="(item, index) in routeList" :key="`${item.name}-${index}`" class="rm-item">
        <span class="rm-num" aria-hidden="true">{{ index + 1 }}</span>
        <span class="rm-name">{{ item.name }}</span>
        <button type="button" class="rm-remove" :aria-label="`Quitar ${item.name} de la ruta`" @click="removeFromRoute(index)">✕</button>
      </li>
    </ol>
    <p v-else class="rm-empty">
      <span aria-hidden="true">👆</span>
      Pulsa pueblos en el mapa, o "Añadir a la ruta" en los sitios que ver, para ir armando tu escapada.
    </p>

    <button type="button" class="rm-go" :disabled="routeList.length < 2" @click="generateRoute">
      Abrir la ruta en Google Maps
    </button>
    <p v-if="routeList.length < 2" class="rm-hint">Hacen falta al menos dos paradas.</p>
  </section>
</template>

<script>
export default {
  name: 'RouteManager',
  props: {
    routeList: { type: Array, default: () => [] }
  },
  emits: ['generateRoute', 'removeFromRoute'],
  setup(props, { emit }) {
    return {
      generateRoute: () => emit('generateRoute'),
      removeFromRoute: (index) => emit('removeFromRoute', index)
    }
  }
}
</script>

<style scoped>
.rm {
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: var(--text-secondary);
}
.rm-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.rm-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid var(--border-primary);
  border-radius: 14px;
  background: var(--bg-secondary);
}
.rm-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
}
.rm-item + .rm-item {
  border-top: 1px solid var(--border-primary);
}
.rm-num {
  flex: none;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--primary-color);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}
.rm-name {
  flex: 1;
  min-width: 0;
  color: var(--text-primary);
  font-weight: 600;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.rm-remove {
  flex: none;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}
.rm-remove:hover {
  background: color-mix(in srgb, #e53935 15%, transparent);
  color: #e53935;
}
.rm-remove:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 1px;
}

.rm-empty {
  margin: 0;
  padding: 18px 16px;
  border: 2px dashed var(--border-primary);
  border-radius: 14px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.5;
  text-align: center;
}

.rm-go {
  padding: 11px 16px;
  border: 0;
  border-radius: 999px;
  background: var(--primary-color);
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.rm-go:hover:not(:disabled) {
  background: var(--primary-hover);
}
.rm-go:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}
/* Deshabilitado: legible en los dos temas (el gris sobre gris de antes no se leía en oscuro) */
.rm-go:disabled {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-primary);
  cursor: not-allowed;
}
.rm-hint {
  margin: -4px 0 0;
  font-size: 12px;
  text-align: center;
}
</style>
