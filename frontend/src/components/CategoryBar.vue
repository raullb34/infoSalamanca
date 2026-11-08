<template>
  <nav class="category-bar" aria-label="Categorías del mapa">
    <div class="chip-row">
      <button
        v-for="cat in categories"
        :key="cat.id"
        type="button"
        class="chip"
        :class="{ active: activeCategory === cat.id }"
        :aria-pressed="activeCategory === cat.id"
        :aria-expanded="cat.filters.length ? activeCategory === cat.id : undefined"
        @click="$emit('selectCategory', activeCategory === cat.id ? null : cat.id)"
      >
        <span class="chip-icon" aria-hidden="true">{{ cat.icon }}</span>
        {{ cat.label }}
      </button>
    </div>

    <!-- Tarjeta con los filtros de la categoría elegida -->
    <transition name="tray">
      <div v-if="currentFilters.length" class="filter-tray" role="group" :aria-label="`Filtros de ${currentLabel}`">
        <div class="tray-options">
          <button
            v-for="f in currentFilters"
            :key="f.name"
            type="button"
            class="tray-option"
            :class="{ active: filters[f.name] }"
            :aria-pressed="!!filters[f.name]"
            @click="$emit('filterClick', f.name)"
          >
            <img v-if="f.icon" :src="f.icon" alt="" class="option-icon" />
            <span>{{ f.label }}</span>
            <span v-if="filters[f.name]" class="option-check" aria-hidden="true">✓</span>
          </button>
        </div>

        <div v-if="legend.length || resultCount" class="tray-footer">
          <div class="map-legend">
            <span v-for="item in legend" :key="item.label" class="legend-item">
              <span class="legend-dot" :style="{ background: item.color }"></span>
              {{ item.label }}
            </span>
          </div>
          <button v-if="resultCount" type="button" class="see-list" @click="$emit('openList')">
            Ver lista ({{ resultCount }}) →
          </button>
        </div>
      </div>
    </transition>
  </nav>
</template>

<script>
import { computed } from 'vue'

// Solo las categorías y filtros que ya funcionan. Cuando se implementen Exposiciones, Pantallas,
// Carnet Joven, Incendios, Cotos o Residuos (y Sociedad) se añaden aquí.
const CATEGORIES = [
  {
    id: 'cultura',
    label: 'Cultura',
    icon: '🎭',
    filters: [
      { name: 'Teatro', label: 'Teatro', icon: '/assets/icons/teatro.png' },
      { name: 'Fiestas Patronales', label: 'Fiestas patronales', icon: '/assets/icons/fiesta.png' },
      { name: 'Bibliotecas y Bibliobuses', label: 'Bibliotecas y bibliobuses', icon: '/assets/icons/libreria-digital.png' }
    ]
  },
  {
    id: 'turismo',
    label: 'Turismo',
    icon: '🏛️',
    filters: [
      { name: 'Tierra de Sabor', label: 'Tierra de Sabor', icon: '/assets/icons/tierra-sabor.svg' }
    ]
  },
  { id: 'historia', label: 'Historia', icon: '🏰', filters: [] }
]

export default {
  name: 'CategoryBar',
  props: {
    activeCategory: { type: String, default: null },
    // { 'Teatro': true, ... } con el estado de cada filtro
    filters: { type: Object, default: () => ({}) },
    // [{ color, label }]: colores que pinta el filtro activo en el mapa
    legend: { type: Array, default: () => [] },
    // Nº de resultados del filtro activo (para "Ver lista")
    resultCount: { type: Number, default: 0 }
  },
  emits: ['selectCategory', 'filterClick', 'openList'],
  setup(props) {
    const current = computed(() => CATEGORIES.find(c => c.id === props.activeCategory))
    const currentFilters = computed(() => current.value?.filters || [])
    const currentLabel = computed(() => current.value?.label || '')
    return { categories: CATEGORIES, currentFilters, currentLabel }
  }
}
</script>

<style scoped>
.category-bar {
  position: fixed;
  top: calc(var(--topbar-h) + 10px);
  left: 12px;
  right: 12px;
  z-index: 900;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  pointer-events: none; /* el mapa sigue recibiendo los clics fuera de las chips */
  transition: left 0.35s ease, right 0.35s ease;
}

.chip-row {
  display: flex;
  gap: 8px;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 2px;
}

.chip-row::-webkit-scrollbar {
  display: none;
}

.chip {
  pointer-events: auto;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border-secondary);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.85rem;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 999px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.chip:hover {
  border-color: var(--primary-color);
}

.chip.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #fff;
}

.chip:focus-visible,
.tray-option:focus-visible,
.see-list:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

/* ---------- Tarjeta de filtros ---------- */
.filter-tray {
  pointer-events: auto;
  max-width: min(100%, 640px);
  background: var(--bg-primary);
  border: 1px solid var(--border-secondary);
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: 8px;
}

.tray-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tray-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 8px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.tray-option:hover {
  border-color: var(--border-secondary);
}

.tray-option.active {
  background: color-mix(in srgb, var(--primary-color) 14%, var(--bg-primary));
  border-color: var(--primary-color);
  color: var(--text-primary);
  font-weight: 600;
}

.option-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.option-check {
  color: var(--primary-color);
  font-weight: 700;
}

.tray-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  padding: 8px 4px 2px;
  border-top: 1px solid var(--border-light);
}

.map-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 0.76rem;
  color: var(--text-secondary);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 11px;
  height: 11px;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.15);
}

.see-list {
  flex-shrink: 0;
  border: none;
  background: none;
  padding: 2px 4px;
  color: var(--primary-color);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.see-list:hover {
  text-decoration: underline;
}

/* Entrada y salida de la tarjeta */
.tray-enter-active,
.tray-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.tray-enter-from,
.tray-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 767px) {
  .category-bar {
    top: calc(var(--topbar-h) + 8px);
    left: 8px;
    right: 8px;
  }

  .chip {
    font-size: 0.8rem;
    padding: 5px 12px;
  }

  .filter-tray {
    max-width: 100%;
    width: 100%;
  }

  .tray-options {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tray-option {
    flex-shrink: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tray-enter-active,
  .tray-leave-active {
    transition: none;
  }
}
</style>

<style>
/* Las chips ocupan el hueco libre del mapa, sin taparse con los paneles abiertos */
@media (min-width: 768px) {
  #app:has(#filter-sidebar.expanded) .category-bar {
    left: calc(var(--left-panel-w) + 12px);
  }
  #app:has(#sidebar.open) .category-bar {
    right: calc(var(--right-panel-w) + 12px);
  }
}
/* En móvil con la ficha abierta solo caben las categorías */
@media (max-width: 767px) {
  #app:has(#sidebar.open) .category-bar .filter-tray {
    display: none;
  }
}
</style>
