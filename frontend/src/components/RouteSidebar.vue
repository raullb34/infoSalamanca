<template>
  <div id="left-sidebar" :class="{ expanded: isExpanded }">
    <h2>Ruta de Visita</h2>
    <div id="route-list">
      <div 
        v-for="(item, index) in routeList" 
        :key="index"
        class="route-item"
      >
        {{ item.name }}
        <button @click="removeFromRoute(index)" class="remove-btn">×</button>
      </div>
      <p v-if="routeList.length === 0" class="empty-route">
        Haz clic en los municipios para añadirlos a tu ruta
      </p>
    </div>
    <button 
      id="generate-route-btn" 
      @click="generateRoute"
      :disabled="routeList.length < 2"
    >
      Generar Ruta en Google Maps
    </button>
  </div>
  <button 
    id="open-close-left-sidebar-btn" 
    class="arrow-button"
    :class="{ 'collapsed': !isExpanded }"
    @click="toggleSidebar"
    :style="{ left: isExpanded ? '280px' : '30px' }"
  >
    {{ isExpanded ? '⬅' : '➡' }}
  </button>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'RouteSidebar',
  props: {
    routeList: {
      type: Array,
      default: () => []
    }
  },
  emits: ['generateRoute', 'removeFromRoute'],
  setup(props, { emit }) {
    const isExpanded = ref(true)

    const toggleSidebar = () => {
      isExpanded.value = !isExpanded.value
    }

    const generateRoute = () => {
      if (props.routeList.length >= 2) {
        emit('generateRoute', props.routeList)
      }
    }

    const removeFromRoute = (index) => {
      emit('removeFromRoute', index)
    }

    return {
      isExpanded,
      toggleSidebar,
      generateRoute,
      removeFromRoute
    }
  }
}
</script>

<style scoped>
#left-sidebar {
  width: 300px;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  background-color: rgba(255, 255, 255, 0.95);
  box-shadow: 2px 0 5px rgba(0,0,0,0.5);
  padding: 20px;
  display: flex;
  flex-direction: column;
  z-index: 1000;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
#left-sidebar:not(.expanded) {
  transform: translateX(-250px);
  box-shadow: none;
}

#left-sidebar:not(.expanded) {
  transform: translateX(-250px);
}

#open-close-left-sidebar-btn {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 10px;
  cursor: pointer;
  border-radius: 0 8px 8px 0;
  z-index: 1001;
  transition: left 0.3s cubic-bezier(.4,2,.6,1), box-shadow 0.3s;
  font-size: 16px;
  box-shadow: 2px 0 5px rgba(0,0,0,0.15);
}
#open-close-left-sidebar-btn.collapsed {
  box-shadow: none;
  border-radius: 8px;
}

h2 {
  color: #333;
  margin-bottom: 20px;
  font-size: 1.3em;
}

#route-list {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 20px;
}

.route-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 10px;
  margin: 8px 0;
}

.remove-btn {
  background: #ff4444;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
}

.remove-btn:hover {
  background: #cc0000;
}

.empty-route {
  color: #666;
  font-style: italic;
  text-align: center;
  padding: 20px 0;
}

#generate-route-btn {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 12px 20px;
  cursor: pointer;
  border-radius: 6px;
  font-size: 16px;
  transition: background-color 0.2s;
}

#generate-route-btn:hover:not(:disabled) {
  background-color: #45a049;
}

#generate-route-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}
</style>
