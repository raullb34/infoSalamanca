// Cuaderno: el resto del trabajo en el campo — siembra, riego, labores y cosecha. Cada tipo dice qué datos lleva, qué
// falta para poder confirmarlo y qué se calcula (lo desconocido se queda desconocido, nunca cero).
//   siembra  → semilla (variedad, lote, certificada, tratada) y dosis (por hectárea o total) → cantidad sembrada
//   riego    → volumen (mm, m³/ha o m³ totales), sistema, horas, origen del agua → m³ totales y mm
//   labor    → qué labor (alzar, gradear…), máquina, profundidad
//   cosecha  → cantidad recogida, humedad, destino y lote → rendimiento (kg/ha)
// La superficie es la de las imputaciones del parte (dónde se hizo de verdad), como en el abonado.

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
const txt = (v, n = 200) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim().slice(0, n))
const limpio = (v) => (v === null ? null : Math.round(v * 1e6) / 1e6)
const uno = (v, lista, defecto = null) => (lista.includes(v) ? v : defecto)

const CLASES_LABOR = {
  alzar: 'Alzar (vertedera)', subsolar: 'Subsolar', chisel: 'Chísel / cultivador pesado', gradear: 'Gradear', cultivador: 'Cultivador',
  rodillo: 'Pasar el rulo', rotovator: 'Fresadora (rotovator)', escarda: 'Escarda / binar', desbroce: 'Desbrozar', picar: 'Picar rastrojo',
  empacar: 'Empacar', otra: 'Otra labor'
}
const SISTEMAS_RIEGO = { aspersion: 'Aspersión', pivot: 'Pívot', goteo: 'Goteo', gravedad: 'Gravedad / a manta', otro: 'Otro' }
const DOSIS_SIEMBRA = { 'kg/ha': { base: 'ha', unidad: 'kg' }, 'semillas/m2': { base: 'm2', unidad: 'semillas' }, 'plantas/ha': { base: 'ha', unidad: 'plantas' }, kg: { base: 'total', unidad: 'kg' } }
const VOLUMEN_RIEGO = ['mm', 'm3/ha', 'm3']
const UNIDADES_COSECHA = { kg: 1, t: 1000 }

const TIPOS = {
  siembra: { label: 'Siembra' },
  riego: { label: 'Riego' },
  labor: { label: 'Labor' },
  cosecha: { label: 'Cosecha' }
}

// Datos de cada tipo, limpios (lo que no se entiende se queda vacío, no se inventa)
function normalizar(tipo, d = {}) {
  if (tipo === 'siembra') {
    return {
      semilla: {
        variedad: txt(d.semilla?.variedad, 120), lote: txt(d.semilla?.lote, 80), proveedor: txt(d.semilla?.proveedor, 120),
        certificada: d.semilla?.certificada === true ? true : d.semilla?.certificada === false ? false : null,
        tratada: d.semilla?.tratada === true ? true : d.semilla?.tratada === false ? false : null
      },
      dosis: num(d.dosis?.valor) !== null ? { valor: num(d.dosis.valor), unidad: uno(d.dosis.unidad, Object.keys(DOSIS_SIEMBRA)) } : null,
      maquina: txt(d.maquina, 120)
    }
  }
  if (tipo === 'riego') {
    return {
      volumen: num(d.volumen?.valor) !== null ? { valor: num(d.volumen.valor), unidad: uno(d.volumen.unidad, VOLUMEN_RIEGO) } : null,
      sistema: uno(d.sistema, Object.keys(SISTEMAS_RIEGO)),
      horas: num(d.horas),
      origen: txt(d.origen, 120) // pozo, canal, comunidad de regantes…
    }
  }
  if (tipo === 'labor') {
    return { clase: uno(d.clase, Object.keys(CLASES_LABOR)), detalle: txt(d.detalle, 200), maquina: txt(d.maquina, 120), profundidad: num(d.profundidad) }
  }
  if (tipo === 'cosecha') {
    return {
      cantidad: num(d.cantidad?.valor) !== null ? { valor: num(d.cantidad.valor), unidad: uno(d.cantidad.unidad, Object.keys(UNIDADES_COSECHA)) } : null,
      producto: txt(d.producto, 80), // grano, paja, forraje…
      humedad: num(d.humedad),
      destino: txt(d.destino, 160), // almacén propio, cooperativa…
      lote: txt(d.lote, 80)
    }
  }
  return null
}

// Lo esencial que falta para poder confirmar (además de fecha, dónde y quién, que comprueba el servicio)
function falta(tipo, l) {
  const f = []
  if (!l) return [{ campo: 'labor', motivo: 'Faltan los datos del trabajo' }]
  if (tipo === 'siembra') {
    if (!l.semilla?.variedad) f.push({ campo: 'labor.semilla.variedad', motivo: 'Falta la variedad sembrada' })
    if (!l.dosis?.unidad || !(l.dosis.valor > 0)) f.push({ campo: 'labor.dosis', motivo: 'Falta la dosis de siembra o su unidad' })
  }
  if (tipo === 'riego' && (!l.volumen?.unidad || !(l.volumen.valor > 0))) f.push({ campo: 'labor.volumen', motivo: 'Falta el agua aplicada (mm, m³/ha o m³)' })
  if (tipo === 'labor' && !l.clase) f.push({ campo: 'labor.clase', motivo: 'Falta qué labor se hizo' })
  if (tipo === 'cosecha' && (!l.cantidad?.unidad || !(l.cantidad.valor > 0))) f.push({ campo: 'labor.cantidad', motivo: 'Falta cuánto se cosechó' })
  return f
}

/**
 * Cálculos de un parte de labor. `superficie` en m² (la suma de lo ejecutado).
 * → { superficie, siembra?: { cantidad }, riego?: { m3, mm }, cosecha?: { kg, rendimiento }, pendientes }
 */
function calcular(tipo, l, superficie) {
  const ha = superficie > 0 ? superficie / 10000 : null
  const pendientes = []
  const out = { superficie: { valor: superficie || 0, unidad: 'm2' }, pendientes }
  if (!l) return out
  if (tipo === 'siembra' && l.dosis?.unidad) {
    const d = DOSIS_SIEMBRA[l.dosis.unidad]
    const cant = d.base === 'total' ? l.dosis.valor : d.base === 'ha' ? (ha === null ? null : l.dosis.valor * ha) : (superficie ? l.dosis.valor * superficie : null)
    out.siembra = { cantidad: { valor: limpio(cant), unidad: d.unidad } }
    if (cant === null) pendientes.push({ campo: 'labor.dosis', motivo: 'Sin superficie no se puede calcular cuánta semilla se usó' })
  }
  if (tipo === 'riego' && l.volumen?.unidad) {
    const v = l.volumen.valor
    // 1 mm sobre 1 ha = 10 m³
    const m3 = l.volumen.unidad === 'm3' ? v : ha === null ? null : l.volumen.unidad === 'mm' ? v * 10 * ha : v * ha
    const mm = l.volumen.unidad === 'mm' ? v : l.volumen.unidad === 'm3/ha' ? v / 10 : ha === null ? null : v / ha / 10
    out.riego = { m3: { valor: limpio(m3), unidad: 'm3' }, mm: { valor: limpio(mm), unidad: 'mm' } }
    if (m3 === null || mm === null) pendientes.push({ campo: 'labor.volumen', motivo: 'Sin superficie no se puede pasar el agua a m³ o a mm' })
  }
  if (tipo === 'cosecha' && l.cantidad?.unidad) {
    const kg = l.cantidad.valor * UNIDADES_COSECHA[l.cantidad.unidad]
    out.cosecha = { kg: { valor: limpio(kg), unidad: 'kg' }, rendimiento: { valor: ha ? limpio(kg / ha) : null, unidad: 'kg/ha' } }
  }
  out.resumen = resumen(tipo, l, out)
  return out
}

// Una línea de texto para el cuaderno y la ficha: qué se hizo y con qué
function resumen(tipo, l, calc) {
  if (!l) return ''
  const n = (v, d = 2) => (v === null || v === undefined ? '¿?' : Number(v).toLocaleString('es-ES', { maximumFractionDigits: d }))
  if (tipo === 'siembra') {
    return [l.semilla?.variedad && `Variedad ${l.semilla.variedad}`, l.semilla?.lote && `lote ${l.semilla.lote}`,
      l.semilla?.certificada === true && 'certificada', l.semilla?.tratada === true && 'semilla tratada',
      l.dosis && `${n(l.dosis.valor)} ${l.dosis.unidad}`, calc?.siembra?.cantidad?.valor != null && `(${n(calc.siembra.cantidad.valor, 1)} ${calc.siembra.cantidad.unidad})`].filter(Boolean).join(', ').replace(/, \(/g, ' (')
  }
  if (tipo === 'riego') {
    return [l.volumen && `${n(l.volumen.valor)} ${l.volumen.unidad}`, calc?.riego?.m3?.valor != null && `(${n(calc.riego.m3.valor, 1)} m³)`,
      l.sistema && SISTEMAS_RIEGO[l.sistema], l.horas != null && `${n(l.horas)} h`, l.origen && `agua de ${l.origen}`].filter(Boolean).join(', ').replace(/, \(/g, ' (')
  }
  if (tipo === 'labor') {
    return [l.clase && CLASES_LABOR[l.clase], l.detalle, l.maquina && `con ${l.maquina}`, l.profundidad != null && `a ${n(l.profundidad, 0)} cm`].filter(Boolean).join(', ').replace(/, \(/g, ' (')
  }
  if (tipo === 'cosecha') {
    return [l.producto, l.cantidad && `${n(l.cantidad.valor)} ${l.cantidad.unidad}`, calc?.cosecha?.rendimiento?.valor != null && `(${n(calc.cosecha.rendimiento.valor, 0)} kg/ha)`,
      l.humedad != null && `${n(l.humedad, 1)} % de humedad`, l.destino && `a ${l.destino}`, l.lote && `lote ${l.lote}`].filter(Boolean).join(', ').replace(/, \(/g, ' (')
  }
  return ''
}

module.exports = { TIPOS, CLASES_LABOR, SISTEMAS_RIEGO, DOSIS_SIEMBRA, VOLUMEN_RIEGO, UNIDADES_COSECHA, normalizar, falta, calcular, resumen }
