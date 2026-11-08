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
        @click="$emit('selectCategory', activeCategory === cat.id ? null : cat.id)"
      >
        <span class="chip-icon" aria-hidden="true">{{ cat.icon }}</span>
        {{ cat.label }}
      </button>
    </div>

    <div v-if="currentFilters.length" class="chip-row sub">
      <button
        v-for="f in currentFilters"
        :key="f.name"
        type="button"
        class="chip small"
        :class="{ active: filters[f.name] }"
        :aria-pressed="!!filters[f.name]"
        @click="$emit('filterClick', f.name)"
      >
        <img v-if="f.icon" :src="f.icon" alt="" class="chip-img" />
        {{ f.label }}
      </button>
    </div>
  </nav>
</template>

<script>
import { computed } from 'vue'

// Solo las categorías y filtros que ya funcionan. Cuando se implementen Carnet Joven,
// Incendios, Cotos o Residuos (y Sociedad) se añaden aquí.
const CATEGORIES = [
  {
    id: 'cultura',
    label: 'Cultura',
    icon: '🎭',
    filters: [
      { name: 'Teatro', label: 'Teatro', icon: '/assets/icons/teatro.png' },
      { name: 'Exposición', label: 'Exposiciones', icon: '/assets/icons/exposición.png' },
      { name: 'Fiestas Patronales', label: 'Fiestas patronales', icon: '/assets/icons/fiesta.png' },
      { name: 'Bibliotecas y Bibliobuses', label: 'Bibliotecas y bibliobuses', icon: '/assets/icons/libreria-digital.png' }
    ]
  },
  {
    id: 'turismo',
    label: 'Turismo',
    icon: '🏛️',
    filters: [
      { name: 'Tierra de Sabor', label: 'Tierra de Sabor', icon: '/assets/icons/tierra-sabor.svg' },
      { name: 'Pantallas', label: 'Cines y pantallas', icon: '/assets/icons/pantalla.png' }
    ]
  },
  { id: 'historia', label: 'Historia', icon: '🏰', filters: [] }
]

export default {
  name: 'CategoryBar',
  props: {
    activeCategory: { type: String, default: null },
    // { 'Teatro': true, ... } con el estado de cada filtro
    filters: { type: Object, default: () => ({}) }
  },
  emits: ['selectCategory', 'filterClick'],
  setup(props) {
    const currentFilters = computed(() => CATEGORIES.find(c => c.id === props.activeCategory)?.filters || [])
    return { categories: CATEGORIES, currentFilters }
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
  gap: 6px;
  pointer-events: none; /* el mapa sigue recibiendo los clics entre chips */
  transition: left 0.35s ease, right 0.35s ease;
}

.chip-row {
  display: flex;
  gap: 8px;
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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

.chip:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.chip.small {
  font-size: 0.78rem;
  font-weight: 500;
  padding: 4px 12px 4px 6px;
}

.chip-img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  border-radius: 50%;
  background: #fff;
  padding: 2px;
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
  #app:has(#sidebar.open) .category-bar .chip-row.sub {
    display: none;
  }
}
</style>
