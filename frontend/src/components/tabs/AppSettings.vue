<template>
  <div class="settings-content">
    <h2>⚙️ Configuración</h2>
    <div class="settings-section">
      <h3>🎨 Apariencia</h3>
      <div class="form-check mb-3">
        <input 
          class="form-check-input" 
          type="checkbox" 
          id="darkMode"
          :checked="darkMode" 
          @change="$emit('toggleDarkMode')"
        >
        <label class="form-check-label" for="darkMode">
          Modo oscuro
        </label>
      </div>
      
      <h3>🗺️ Mapa</h3>
      <div class="form-check mb-3">
        <input 
          class="form-check-input" 
          type="checkbox" 
          id="showTooltips"
          :checked="showTooltips" 
          @change="$emit('toggleTooltips')"
        >
        <label class="form-check-label" for="showTooltips">
          Mostrar tooltips al pasar el mouse
        </label>
      </div>
      
      <h3>📱 General</h3>
      <div class="form-check mb-3">
        <input 
          class="form-check-input" 
          type="checkbox" 
          id="autoExpandSidebar"
          :checked="autoExpandSidebar" 
          @change="$emit('toggleAutoExpand')"
        >
        <label class="form-check-label" for="autoExpandSidebar">
          Expandir sidebar automáticamente
        </label>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AppSettings',
  props: {
    darkMode: {
      type: Boolean,
      default: false
    },
    showTooltips: {
      type: Boolean,
      default: true
    },
    autoExpandSidebar: {
      type: Boolean,
      default: true
    }
  },
  emits: ['toggleDarkMode', 'toggleTooltips', 'toggleAutoExpand']
}
</script>

<style scoped>
.settings-content {
  padding: 0;
}

.settings-content h2 {
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

/* Configuración */
.settings-section h3 {
  color: #555;
  font-size: 1.1rem;
  margin-top: 25px;
  margin-bottom: 15px;
  padding-left: 25px;
  position: relative;
}

.settings-section h3:first-child {
  margin-top: 0;
}

.form-check {
  background: #f8f9fa;
  border-radius: 6px;
  padding: 12px 15px;
  border: 1px solid #e9ecef;
  transition: all 0.2s ease;
}

.form-check:hover {
  background: #e9ecef;
  border-color: #667eea;
}

.form-check-input:checked {
  background-color: #667eea;
  border-color: #667eea;
}

.form-check-label {
  margin-left: 8px;
  font-weight: 500;
  color: #495057;
  cursor: pointer;
}
</style>
