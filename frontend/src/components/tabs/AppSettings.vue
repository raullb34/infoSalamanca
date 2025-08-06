<template>
  <div class="settings-content">
    <h2>⚙️ Configuración</h2>
    <div class="settings-section">
      <h3>🎨 Apariencia</h3>
      <div class="theme-setting mb-3">
        <label class="setting-label">
          Tema de la aplicación
        </label>
        <ThemeToggle />
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
import ThemeToggle from '../ThemeToggle.vue'

export default {
  name: 'AppSettings',
  components: {
    ThemeToggle
  },
  props: {
    showTooltips: {
      type: Boolean,
      default: true
    },
    autoExpandSidebar: {
      type: Boolean,
      default: true
    }
  },
  emits: ['toggleTooltips', 'toggleAutoExpand']
}
</script>

<style scoped>
.settings-content {
  padding: 0;
}

.settings-content h2 {
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

/* Configuración */
.settings-section h3 {
  color: var(--text-secondary);
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
  background: var(--bg-secondary);
  border-radius: 6px;
  padding: 12px 15px;
  border: 1px solid var(--border-color);
  transition: all 0.2s ease;
}

.form-check:hover {
  background: var(--bg-tertiary);
  border-color: var(--primary-color);
}

.form-check-input:checked {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
}

.form-check-label {
  margin-left: 8px;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
}

.theme-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 15px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  transition: all 0.2s ease;
}

.theme-setting:hover {
  background: var(--bg-tertiary);
  border-color: var(--primary-color);
}

.setting-label {
  font-weight: 500;
  color: var(--text-primary);
  margin: 0;
}
</style>
