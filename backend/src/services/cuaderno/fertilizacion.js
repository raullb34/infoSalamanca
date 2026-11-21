// Cuaderno de explotación: cálculo de un abonado a partir de datos confirmados.
//
// Reglas (contrato de autorrelleno del plan):
//  - Se calcula solo con lo confirmado; lo desconocido se conserva como desconocido (null), nunca como cero.
//  - Unidades explícitas en cada valor; el redondeo se hace al presentar (`redondear`), no al guardar.
//  - Una dosis en volumen necesita la densidad para pasar a masa; sin ella, masa y nutrientes quedan pendientes.
//  - Cada resultado lleva su procedencia ("calculado") y la lista de pendientes que impiden completarlo.
//
// Superficies en m² (unidad de origen del SIGPAC); dosis por hectárea → × superficie / 10 000.
const NUTRIENTES = ['N', 'P2O5', 'K2O']

// Unidades de dosis admitidas: por hectárea o totales, de masa o de volumen
const DOSIS = {
  'kg/ha': { porHa: true, magnitud: 'masa', aKg: 1, unidad: 'kg' },
  't/ha': { porHa: true, magnitud: 'masa', aKg: 1000, unidad: 'kg' },
  'L/ha': { porHa: true, magnitud: 'volumen', aL: 1, unidad: 'L' },
  'm3/ha': { porHa: true, magnitud: 'volumen', aL: 1000, unidad: 'L' },
  kg: { porHa: false, magnitud: 'masa', aKg: 1, unidad: 'kg' },
  t: { porHa: false, magnitud: 'masa', aKg: 1000, unidad: 'kg' },
  L: { porHa: false, magnitud: 'volumen', aL: 1, unidad: 'L' },
  m3: { porHa: false, magnitud: 'volumen', aL: 1000, unidad: 'L' }
}
const DENSIDAD = { 'kg/L': 1, 't/m3': 1, 'g/mL': 1, 'kg/m3': 0.001 } // → kg/L

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
// Evita el ruido de coma flotante en lo guardado (918.0000000000001) sin redondear de verdad
const limpio = (v) => (v === null ? null : Math.round(v * 1e9) / 1e9)
const redondear = (v, d = 2) => (v === null || v === undefined ? null : Math.round(v * 10 ** d) / 10 ** d)

/**
 * Una línea de producto sobre una superficie ejecutada (m²).
 * → { cantidad: {valor, unidad}, masa: {valor, unidad:'kg'}|null, nutrientes: {N: {valor, unidad, procedencia}}, pendientes: [] }
 */
function calcularLinea(linea, superficieM2) {
  const pendientes = []
  const p = linea.producto || {}
  const u = DOSIS[linea.dosis?.unidad]
  const dosis = num(linea.dosis?.valor)
  const ha = num(superficieM2) === null ? null : Number(superficieM2) / 10000
  if (!u) pendientes.push({ campo: 'dosis.unidad', motivo: `Unidad de dosis no admitida: «${linea.dosis?.unidad ?? ''}» (usa kg/ha, t/ha, L/ha, m3/ha, kg, t, L o m3)` })
  if (dosis === null) pendientes.push({ campo: 'dosis.valor', motivo: 'Falta la dosis' })
  if (u?.porHa && ha === null) pendientes.push({ campo: 'superficie', motivo: 'Falta la superficie ejecutada' })

  let cantidad = { valor: null, unidad: u?.unidad || null, procedencia: 'calculado' }
  if (u && dosis !== null && (!u.porHa || ha !== null)) {
    const enOrigen = u.porHa ? dosis * ha : dosis
    cantidad.valor = limpio(enOrigen * (u.magnitud === 'masa' ? u.aKg : u.aL))
  }

  // Masa (kg): directa, o desde volumen con la densidad del producto
  let masa = null
  if (cantidad.valor !== null) {
    if (u.magnitud === 'masa') masa = { valor: cantidad.valor, unidad: 'kg', procedencia: 'calculado' }
    else {
      const d = num(p.densidad?.valor)
      const f = DENSIDAD[p.densidad?.unidad]
      if (d === null || !f) pendientes.push({ campo: 'producto.densidad', motivo: 'Dosis en volumen: falta la densidad del producto para calcular la masa y los nutrientes' })
      else masa = { valor: limpio(cantidad.valor * d * f), unidad: 'kg', procedencia: 'calculado' }
    }
  }

  // Nutrientes: masa × riqueza (% en peso); riqueza desconocida → nutriente desconocido
  const nutrientes = {}
  for (const n of NUTRIENTES) {
    const pct = num(p.composicion?.[n])
    if (pct === null) pendientes.push({ campo: `producto.composicion.${n}`, motivo: `Falta la riqueza en ${n} del producto` })
    nutrientes[n] = { valor: pct !== null && masa ? limpio((masa.valor * pct) / 100) : null, unidad: 'kg', procedencia: 'calculado' }
  }
  return { cantidad, masa, nutrientes, pendientes }
}

/**
 * Un parte de abonado: sus imputaciones (superficie ejecutada en cada unidad) y sus líneas de producto.
 * Las dosis por hectárea se aplican a la suma de superficies ejecutadas.
 */
function calcularAbonado({ imputaciones = [], lineas = [] }) {
  const sup = imputaciones.map(i => num(i.superficie?.valor))
  const desconocida = sup.some(v => v === null)
  const superficieEjecutada = { valor: desconocida ? null : limpio(sup.reduce((s, v) => s + v, 0)), unidad: 'm2', procedencia: 'calculado' }
  const pendientes = []
  if (!imputaciones.length) pendientes.push({ campo: 'imputaciones', motivo: 'El parte no dice dónde se hizo' })
  if (desconocida) pendientes.push({ campo: 'imputaciones.superficie', motivo: 'Falta la superficie ejecutada en alguna unidad' })
  if (!lineas.length) pendientes.push({ campo: 'lineas', motivo: 'El parte no tiene productos' })

  const calculadas = lineas.map((l, i) => {
    const r = calcularLinea(l, superficieEjecutada.valor)
    r.pendientes.forEach(p => pendientes.push({ ...p, campo: `lineas[${i}].${p.campo}` }))
    return r
  })
  const totales = {}
  for (const n of NUTRIENTES) {
    const vals = calculadas.map(c => c.nutrientes[n].valor)
    totales[n] = { valor: vals.length && vals.every(v => v !== null) ? limpio(vals.reduce((s, v) => s + v, 0)) : null, unidad: 'kg', procedencia: 'calculado' }
  }
  // Sin repetir el mismo pendiente
  const vistos = new Set()
  return {
    superficieEjecutada,
    lineas: calculadas,
    totales,
    pendientes: pendientes.filter(p => (vistos.has(p.campo) ? false : vistos.add(p.campo)))
  }
}

module.exports = { calcularLinea, calcularAbonado, redondear, NUTRIENTES, DOSIS }
