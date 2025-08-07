<template>
  <div class="route-content">
    <h2>🗺️ Ruta de Visita</h2>
    <div class="route-list">
      <div 
        v-for="(item, index) in routeList" 
        :key="index"
        class="route-item d-flex justify-content-between align-items-center mb-2 p-2 rounded"
      >
        <span class="route-item-text">{{ item.name }}</span>
        <button @click="removeFromRoute(index)" class="btn btn-sm btn-remove">×</button>
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
  background: var(--bg-secondary);
  border: 1px solid var(--border-secondary) !important;
  transition: all 0.2s ease;
}

.route-item:hover {
  border-color: var(--primary-color) !important;
  background: var(--bg-tertiary) !important;
}

.route-item-text {
  color: var(--text-primary);
  font-weight: 500;
}

.btn-remove {
  background: transparent;
  border: 1px solid #dc3545;
  color: #dc3545;
  width: 24px;
  height: 24px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.btn-remove:hover {
  background: #dc3545;
  color: white;
  border-color: #dc3545;
}

[data-theme="dark"] .btn-remove {
  border-color: #ff6b6b;
  color: #ff6b6b;
}

[data-theme="dark"] .btn-remove:hover {
  background: #ff6b6b;
  border-color: #ff6b6b;
  color: white;
}

.empty-route {
  padding: 40px 20px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 2px dashed var(--border-secondary);
  color: var(--text-muted);
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
