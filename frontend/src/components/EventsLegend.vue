<template>
  <div id="legend">
    <label 
      v-for="(value, filterName) in filters" 
      :key="filterName"
      @click="onFilterClick(filterName)"
    >
      <input 
        :id="getFilterId(filterName)"
        type="checkbox" 
        class="filter-checkbox" 
        :data-category="filterName"
        :checked="value"
        @change="handleFilterChange(filterName, $event.target.checked)"
      > 
      <object 
        v-if="getIconPath(filterName)"
        id="icon-legend" 
        type="image/svg+xml" 
        :data="getIconPath(filterName)"
      ></object>
      {{ filterName }}
    </label>
  </div>
</template>

<script>
export default {
  name: 'EventsLegend',
  props: {
    filters: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['filterChange'],
  setup(props, { emit }) {
    const handleFilterChange = (filterName, isChecked) => {
      emit('filterChange', filterName, isChecked)
    }

    const getFilterId = (filterName) => {
      return filterName.toLowerCase().replace(/\s+/g, '-')
    }

    const getIconPath = (filterName) => {
      const iconMap = {
        'Tierra de Sabor': 'assets/icons/tierra-sabor.svg',
        'Teatro': null,
        'Pantallas': null,
        'Exposición': null
      }
      return iconMap[filterName] || null
    }

    // Emitir evento especial al hacer click en Tierra de Sabor
    const onFilterClick = (filterName) => {
      if (filterName === 'Tierra de Sabor') {
        // Emitimos un evento especial para que el padre pinte la capa
        emit('filterClick', filterName)
      }
    }

    return {
      handleFilterChange,
      getFilterId,
      getIconPath,
      onFilterClick
    }
  }
}
</script>

<style scoped>
#legend {
  position: fixed;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  width: calc(100% - 40px);
  max-width: 700px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 16px;
  padding: 16px 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  z-index: 1000;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 20px;
  transition: var(--transition, all 0.3s ease);
}

#legend:hover {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}

label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  gap: 10px;
  margin: 0;
  padding: 8px 12px;
  border-radius: 8px;
  transition: var(--transition, all 0.3s ease);
  user-select: none;
}

label:hover {
  background: rgba(76, 175, 80, 0.1);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.2);
}

.filter-checkbox {
  margin: 0;
  width: 18px;
  height: 18px;
  accent-color: var(--primary-color, #4CAF50);
  cursor: pointer;
}

#icon-legend {
  width: 24px;
  height: 24px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

/* Responsive adjustments */
@media (max-width: 768px) {
  #legend {
    bottom: 10px;
    width: calc(100% - 20px);
    padding: 12px 16px;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }
  
  label {
    font-size: 13px;
    padding: 6px 10px;
    gap: 8px;
    flex: 1 1 calc(50% - 6px);
    min-width: 140px;
    justify-content: center;
  }
  
  #icon-legend {
    width: 20px;
    height: 20px;
  }
  
  .filter-checkbox {
    width: 16px;
    height: 16px;
  }
}

@media (max-width: 480px) {
  #legend {
    bottom: 5px;
    width: calc(100% - 10px);
    padding: 10px 12px;
    gap: 8px;
  }
  
  label {
    font-size: 12px;
    padding: 5px 8px;
    gap: 6px;
    flex: 1 1 100%;
    min-width: auto;
  }
  
  #icon-legend {
    width: 18px;
    height: 18px;
  }
  
  .filter-checkbox {
    width: 14px;
    height: 14px;
  }
}

/* Mejoras para accesibilidad */
label:focus-within {
  outline: 2px solid var(--primary-color, #4CAF50);
  outline-offset: 2px;
}

.filter-checkbox:focus {
  outline: none;
}

/* Animaciones para los checkboxes */
.filter-checkbox:checked {
  animation: checkboxPulse 0.3s ease;
}

@keyframes checkboxPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
</style>
