<template>
  <div class="info-content">
    <h2>ℹ️ Información</h2>
    <div class="info-section">
      <h3>📍 Sobre Salamanca</h3>
      <p>Explora la provincia de Salamanca a través de este mapa interactivo. Descubre municipios, eventos culturales, gastronomía y mucho más.</p>
      
      <h3>🎯 Cómo usar la aplicación</h3>
      <ul>
        <li><strong>Filtros:</strong> Usa la leyenda para activar filtros como Tierra de Sabor</li>
        <li><strong>Municipios:</strong> Haz clic en cualquier municipio para ver su información</li>
        <li><strong>Rutas:</strong> Añade municipios a tu ruta para planificar tu visita</li>
        <li><strong>Chat:</strong> Pregunta a SaLLMantino sobre cualquier municipio</li>
      </ul>

      <h3>📊 Estadísticas</h3>
      <div class="stats d-flex justify-content-around">
        <div class="stat-item text-center">
          <div class="stat-number h4 mb-0">362</div>
          <small class="stat-label">Municipios</small>
        </div>
        <div class="stat-item text-center">
          <div class="stat-number h4 mb-0">{{ routeCount }}</div>
          <small class="stat-label">En tu ruta</small>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AppInfo',
  props: {
    routeCount: {
      type: Number,
      default: 0
    }
  }
}
</script>

<style scoped>
.info-content {
  padding: 0;
  color: var(--text-secondary);
}

.info-content h2 {
  color: var(--text-primary);
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--border-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-section {
  color: var(--text-secondary);
}

.info-section h3 {
  color: var(--text-primary);
  font-size: 1.2rem;
  font-weight: 600;
  margin: 20px 0 12px 0;
}

.info-section p {
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 16px;
}

.info-section ul li {
  padding: 8px 0;
  margin-bottom: 8px;
  list-style-type: none !important;
  list-style: none !important;
  color: var(--text-secondary);
}

.info-section ul li strong {
  color: var(--text-primary);
}

.info-section ul li::before {
  content: none !important;
}

.info-section ul li::marker {
  content: none !important;
}

/* Estadísticas en Info */
.stats {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 20px;
  margin-top: 15px;
  display: flex;
  justify-content: space-around;
  align-items: center;
}

.stat-item {
  flex: 1;
  text-align: center;
}

.stat-number {
  color: var(--primary-color);
  font-weight: 700;
  font-size: 2rem;
  margin-bottom: 0;
}

.stat-label {
  color: var(--text-secondary);
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: block;
  margin-top: 4px;
}

/* Asegurar que no aparezcan subrayados ni puntos */
a {
  text-decoration: none !important;
  color: var(--primary-color);
}

a:hover {
  color: var(--primary-hover);
}

ul, li {
  list-style: none !important;
  padding-left: 0 !important;
  margin-left: 0 !important;
}

/* Estilos específicos para clases de Bootstrap que podrían interferir */
:deep(.h4) {
  color: var(--primary-color) !important;
}

:deep(.text-center) {
  color: inherit !important;
}

:deep(.mb-0) {
  margin-bottom: 0 !important;
}
</style>
