// Cuaderno: tratamientos fitosanitarios. Cuatro supuestos, cada uno con su ámbito explícito:
//   campo       → sobre cultivos y recintos (superficie tratada)
//   semilla     → semilla tratada (un lote de semilla, sin superficie)
//   poscosecha  → producto cosechado (un lote, sin superficie)
//   instalacion → almacén, nave, cámara… (una instalación, sin superficie)
//
// Cantidad de producto: dosis por hectárea × superficie, por tonelada × peso del lote, o total. Lo desconocido se queda
// desconocido. El uso autorizado (producto inscrito y autorizado para ese cultivo/uso en la fecha) NO se puede
// comprobar sin el Registro de Productos Fitosanitarios: queda siempre como pendiente (regla FITO-01, pendiente de
// revisión), nunca como «comprobado». Ver docs/cuaderno/obligaciones.md.
const SUBTIPOS = {
  campo: { label: 'Tratamiento en campo', ambito: 'superficie' },
  semilla: { label: 'Semilla tratada', ambito: 'lote' },
  poscosecha: { label: 'Tratamiento poscosecha', ambito: 'lote' },
  instalacion: { label: 'Tratamiento de instalación', ambito: 'instalacion' }
}

// Dosis admitidas: por superficie, por peso tratado o totales (L, kg y sus fracciones)
const DOSIS = {
  'L/ha': { base: 'ha', unidad: 'L', f: 1 }, 'mL/ha': { base: 'ha', unidad: 'L', f: 0.001 },
  'kg/ha': { base: 'ha', unidad: 'kg', f: 1 }, 'g/ha': { base: 'ha', unidad: 'kg', f: 0.001 },
  'L/t': { base: 't', unidad: 'L', f: 1 }, 'mL/t': { base: 't', unidad: 'L', f: 0.001 },
  'kg/t': { base: 't', unidad: 'kg', f: 1 }, 'g/t': { base: 't', unidad: 'kg', f: 0.001 },
  'mL/100kg': { base: 't', unidad: 'L', f: 0.01 }, 'g/100kg': { base: 't', unidad: 'kg', f: 0.01 },
  L: { base: 'total', unidad: 'L', f: 1 }, mL: { base: 'total', unidad: 'L', f: 0.001 },
  kg: { base: 'total', unidad: 'kg', f: 1 }, g: { base: 'total', unidad: 'kg', f: 0.001 }
}
const LOTE = { kg: 0.001, t: 1 } // → toneladas

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
const limpio = (v) => (v === null ? null : Math.round(v * 1e9) / 1e9)

/**
 * @param op { subtipo, imputaciones, lote, lineas }
 * → { superficieTratada, loteToneladas, lineas: [{ cantidad }], pendientes }
 */
function calcularTratamiento(op) {
  const pendientes = []
  const st = SUBTIPOS[op.subtipo]
  if (!st) pendientes.push({ campo: 'subtipo', motivo: 'Indica qué se trata: campo, semilla, poscosecha o instalación' })
  // Superficie tratada (solo en campo)
  let superficieTratada = null
  if (op.subtipo === 'campo') {
    const sup = (op.imputaciones || []).map(i => num(i.superficie?.valor))
    superficieTratada = { valor: sup.length && sup.every(v => v !== null) ? limpio(sup.reduce((s, v) => s + v, 0)) : null, unidad: 'm2', procedencia: 'calculado' }
  }
  // Peso del lote (semilla o poscosecha)
  let loteToneladas = null
  if (st?.ambito === 'lote') {
    const v = num(op.lote?.cantidad?.valor)
    const f = LOTE[op.lote?.cantidad?.unidad]
    loteToneladas = v !== null && f ? limpio(v * f) : null
  }

  const lineas = (op.lineas || []).map((l, i) => {
    const u = DOSIS[l.dosis?.unidad]
    const d = num(l.dosis?.valor)
    let valor = null
    if (!u) pendientes.push({ campo: `lineas[${i}].dosis.unidad`, motivo: `Unidad de dosis no admitida: «${l.dosis?.unidad ?? ''}»` })
    else if (d === null) pendientes.push({ campo: `lineas[${i}].dosis.valor`, motivo: 'Falta la dosis' })
    else if (u.base === 'total') valor = d * u.f
    else if (u.base === 'ha') {
      if (op.subtipo !== 'campo') pendientes.push({ campo: `lineas[${i}].dosis.unidad`, motivo: 'Dosis por hectárea en un tratamiento sin superficie: usa una dosis por tonelada o total' })
      else if (superficieTratada?.valor === null || superficieTratada?.valor === undefined) pendientes.push({ campo: 'imputaciones.superficie', motivo: 'Falta la superficie tratada' })
      else valor = d * u.f * (superficieTratada.valor / 10000)
    } else if (u.base === 't') {
      if (loteToneladas === null) pendientes.push({ campo: 'lote.cantidad', motivo: 'Dosis por peso: falta cuánto pesa el lote tratado' })
      else valor = d * u.f * loteToneladas
    }
    // Sin número de inscripción no se puede identificar el producto en el registro oficial
    if (!String(l.producto?.registro || '').trim()) pendientes.push({ campo: `lineas[${i}].producto.registro`, motivo: `Falta el número de registro de ${l.producto?.nombre || 'el producto'}` })
    // El uso autorizado no se comprueba aquí (sin acceso al registro): queda pendiente
    pendientes.push({ campo: `lineas[${i}].usoAutorizado`, motivo: `Uso autorizado de ${l.producto?.nombre || 'el producto'} para este cultivo y fecha: sin comprobar (falta consultar el Registro de Productos Fitosanitarios)`, regla: { id: 'FITO-01', estado: 'pendiente de revisión' } })
    return { cantidad: { valor: valor === null ? null : limpio(valor), unidad: u?.unidad || null, procedencia: 'calculado' } }
  })
  return { superficieTratada, loteToneladas, lineas, pendientes }
}

module.exports = { calcularTratamiento, SUBTIPOS, DOSIS }
