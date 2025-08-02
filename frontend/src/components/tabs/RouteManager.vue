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
  color: #333;
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #f0f0f0;
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
  border: 1px solid #e9ecef !important;
  transition: all 0.2s ease;
}

.route-item:hover {
  border-color: #667eea !important;
  background: #f8f9fa !important;
}

.empty-route {
  padding: 40px 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 8px;
  border: 2px dashed #dee2e6;
}

/* Botones mejorados */
.btn-success {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn-success:hover {
  background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-success:disabled {
  background: #6c757d;
  opacity: 0.6;
  transform: none;
  box-shadow: none;
}
</style>
