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
  left: 45%;
  bottom: 0;
  transform: translateX(-50%);
  width: 70vw;
  max-width: 700px;
  min-width: 420px;
  background: rgba(255, 255, 255, 0.95);
  border-top: 1px solid #ddd;
  border-radius: 0 0 16px 16px;
  padding: 12px 30px;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.08);
  z-index: 1000;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 24px;
}

label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 15px;
  color: #333;
  gap: 10px;
  margin: 0 10px;
}

.filter-checkbox {
  margin: 0;
}

#icon-legend {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

label:hover {
  background-color: rgba(76, 175, 80, 0.1);
  border-radius: 4px;
  padding: 2px 4px;
  margin: -2px -4px;
}
</style>
