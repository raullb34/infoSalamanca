// Cartografía agrícola (SIGPAC): usos del suelo, qué pueblos la tienen y cuentas de medición.
// Los datos los prepara backend/scripts/build-sigpac.js en public/data/sigpac/<ine>.json.

// Usos SIGPAC (catálogo del ITACyL) con un color legible sobre la ortofoto
export const USOS = {
  TA: { nombre: 'Tierras arables', color: '#f2c94c' },
  TH: { nombre: 'Huerta', color: '#2bb3a3' },
  PS: { nombre: 'Pastizal', color: '#9ccc65' },
  PR: { nombre: 'Pasto arbustivo', color: '#7cb342' },
  PA: { nombre: 'Pasto con arbolado', color: '#4f8a2b' },
  FO: { nombre: 'Forestal', color: '#1b6e3a' },
  MT: { nombre: 'Matorral', color: '#8d6e63' },
  VI: { nombre: 'Viñedo', color: '#9c4dcc' },
  VF: { nombre: 'Viñedo y frutal', color: '#b07bd6' },
  VO: { nombre: 'Viñedo y olivar', color: '#b07bd6' },
  OV: { nombre: 'Olivar', color: '#8a8f2e' },
  OF: { nombre: 'Olivar y frutal', color: '#a3a845' },
  FY: { nombre: 'Frutales', color: '#ff8a3d' },
  FS: { nombre: 'Frutos secos', color: '#b98b6e' },
  FL: { nombre: 'Frutos secos y olivar', color: '#b98b6e' },
  FV: { nombre: 'Frutos secos y viñedo', color: '#b98b6e' },
  IV: { nombre: 'Invernaderos', color: '#e0e0e0' },
  AG: { nombre: 'Agua', color: '#35a7e8' },
  CA: { nombre: 'Viales', color: '#a0a4a8' },
  ED: { nombre: 'Edificaciones', color: '#e5736f' },
  ZU: { nombre: 'Zona urbana', color: '#d9534f' },
  ZC: { nombre: 'Zona concentrada', color: '#c7b8a3' },
  IM: { nombre: 'Improductivo', color: '#c9c9c9' },
  EP: { nombre: 'Elemento del paisaje', color: '#6d4c41' },
  ZV: { nombre: 'Zona censurada', color: '#777777' }
}
export const usoDe = (code) => USOS[code] || { nombre: code || 'Sin uso', color: '#90a4ae' }

// ¿Qué pueblos tienen cartografía? (una consulta, compartida)
let indexPromise = null
export const sigpacIndex = () => (indexPromise ||= fetch('/data/sigpac/index.json').then(r => (r.ok ? r.json() : {})).catch(() => ({})))
export const loadSigpac = (ine) => fetch(`/data/sigpac/${ine}.json`).then(r => {
  if (!r.ok) throw new Error('No hay cartografía de este pueblo')
  return r.json()
})

// ---------- Medidas sobre la Tierra (esfera de radio medio; error < 0,5 % a esta escala) ----------
const R = 6371008.8
const rad = (d) => (d * Math.PI) / 180

// Distancia entre dos puntos [lng, lat] (haversine), en metros
export function distance(a, b) {
  const dLat = rad(b[1] - a[1])
  const dLng = rad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Longitud de una línea, en metros
export const lineLength = (pts) => pts.slice(1).reduce((s, p, i) => s + distance(pts[i], p), 0)

// Área de un anillo [lng, lat] en m² (exceso esférico, la misma fórmula que usan los visores web)
export function ringArea(ring) {
  if (ring.length < 3) return 0
  let s = 0
  for (let i = 0; i < ring.length; i++) {
    const p1 = ring[i]
    const p2 = ring[(i + 1) % ring.length]
    s += rad(p2[0] - p1[0]) * (2 + Math.sin(rad(p1[1])) + Math.sin(rad(p2[1])))
  }
  return Math.abs((s * R * R) / 2)
}

// Área de un Polygon / MultiPolygon de GeoJSON (los huecos restan)
export function geometryArea(g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  return polys.reduce((s, rings) => s + ringArea(rings[0]) - rings.slice(1).reduce((h, r) => h + ringArea(r), 0), 0)
}

// Perímetro exterior de un Polygon / MultiPolygon, en metros
export function geometryPerimeter(g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  return polys.reduce((s, rings) => s + lineLength(rings[0]), 0)
}

// "2,35 ha" · "850 m²"; "1,24 km" · "312 m"
const nf = (v, d) => v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })
export const fmtArea = (m2) => (m2 >= 10000 ? `${nf(m2 / 10000, 2)} ha` : `${nf(m2, 0)} m²`)
export const fmtLength = (m) => (m >= 1000 ? `${nf(m / 1000, 2)} km` : `${nf(m, 1)} m`)
