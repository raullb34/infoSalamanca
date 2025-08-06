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
          <small class="stat-label text-muted">Municipios</small>
        </div>
        <div class="stat-item text-center">
          <div class="stat-number h4 mb-0">{{ routeCount }}</div>
          <small class="stat-label text-muted">En tu ruta</small>
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
}

.info-content h2 {
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

/* Info section */
.info-section ul {
  list-style-type: none !important;
  list-style: none !important;
  padding-left: 0 !important;
  margin: 0 !important;
}

.info-section ul li {
  padding: 8px 0;
  margin-bottom: 8px;
  list-style-type: none !important;
  list-style: none !important;
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
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 20px;
  margin-top: 15px;
}

.stat-item {
  flex: 1;
}

.stat-number {
  color: var(--primary-color);
  font-weight: 700;
  font-size: 2rem;
}

.stat-label {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Asegurar que no aparezcan subrayados ni puntos */
a {
  text-decoration: none !important;
}

ul, li {
  list-style: none !important;
  padding-left: 0 !important;
}
</style>
