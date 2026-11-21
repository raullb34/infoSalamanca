// Superficies sobre la Tierra para el cuaderno (croquis de una zona tratada, recintos). Sobre la esfera de radio
// medio, la misma fórmula del visor: frente a la superficie oficial del SIGPAC se separa menos de un 0,25 %.
// Admite polígonos con huecos y multipolígonos (GeoJSON, coordenadas [lng, lat]). Resultado en m².
const R = 6371008.8
const rad = (d) => (d * Math.PI) / 180

function ringArea(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0
  let s = 0
  for (let i = 0; i < ring.length; i++) {
    const p1 = ring[i]
    const p2 = ring[(i + 1) % ring.length]
    s += rad(p2[0] - p1[0]) * (2 + Math.sin(rad(p1[1])) + Math.sin(rad(p2[1])))
  }
  return Math.abs((s * R * R) / 2)
}

// Área de un Polygon / MultiPolygon (los huecos restan)
function geometryArea(g) {
  if (!g || !['Polygon', 'MultiPolygon'].includes(g.type)) return null
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  return polys.reduce((s, rings) => s + ringArea(rings[0]) - rings.slice(1).reduce((h, r) => h + ringArea(r), 0), 0)
}

// ¿Es una geometría de superficie válida? (anillos cerrados o cerrables, coordenadas en rango)
function validGeometry(g) {
  if (!g || !['Polygon', 'MultiPolygon'].includes(g.type) || !Array.isArray(g.coordinates)) return false
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  return polys.length > 0 && polys.every(rings => Array.isArray(rings) && rings.length > 0 && rings.every(r => Array.isArray(r) && r.length >= 3 &&
    r.every(p => Array.isArray(p) && p.length >= 2 && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)))
}

module.exports = { ringArea, geometryArea, validGeometry }
