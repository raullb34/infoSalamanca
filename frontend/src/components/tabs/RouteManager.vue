<template>
  <div class="route-content">
    <h2>🗺️ Ruta de Visita</h2>
    <div class="route-list">
      <div 
        v-for="(item, index) in routeList" 
        :key="index"
        class="route-item d-flex justify-content-between align-items-center mb-2 p-2 bg-light rounded"
      >
        <span>{{ item.name }}</span>
        <button @click="removeFromRoute(index)" class="btn btn-sm btn-outline-danger">×</button>
      </div>
      <p v-if="routeList.length === 0" class="empty-route text-muted text-center">
        Haz clic en los municipios para añadirlos a tu ruta
      </p>
    </div>
    <button 
      class="btn btn-success w-100 mt-3" 
      @click="generateRoute"
      :disabled="routeList.length < 2"
    >
      Generar Ruta en Google Maps
    </button>
  </div>
</template>

<script>
export default {
  name: 'RouteManager',
  props: {
    routeList: {
      type: Array,
      default: () => []
    }
  },
  emits: ['generateRoute', 'removeFromRoute'],
  setup(props, { emit }) {
    const generateRoute = () => {
      emit('generateRoute')
    }

    const removeFromRoute = (index) => {
      emit('removeFromRoute', index)
    }

    return {
      generateRoute,
      removeFromRoute
    }
  }
}
</script>

<style scoped>
.route-content {
  padding: 0;
}

.route-content h2 {
  color: var(--text-primary);
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Route content */
.route-list {
  max-height: 250px;
  overflow-y: auto;
}

.route-item {
  border: 1px solid var(--border-color) !important;
  transition: all 0.2s ease;
}

.route-item:hover {
  border-color: var(--primary-color) !important;
  background: var(--bg-tertiary) !important;
}

.empty-route {
  padding: 40px 20px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 2px dashed var(--border-color);
}

/* Botones mejorados */
.btn-success {
  background: var(--primary-color);
  border: none;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.3s ease;
  color: var(--text-light);
}

.btn-success:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--shadow-color);
}

.btn-success:disabled {
  background: var(--text-secondary);
  opacity: 0.6;
  transform: none;
  box-shadow: none;
}
</style>
