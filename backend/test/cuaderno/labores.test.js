// Siembra, riego, labores y cosecha (services/cuaderno/labores.js): datos, lo que falta, cálculos, cuaderno y CSV.
// Cada hecho una vez: la siembra confirmada completa la fecha de siembra y la variedad del cultivo (sin pisar).
const test = require('node:test')
const assert = require('node:assert')
const { memoryStore } = require('../../src/services/cuaderno/store')
const cuentas = require('../../src/services/cuaderno/cuentas')
const explotacion = require('../../src/services/cuaderno/explotacion')
const labores = require('../../src/services/cuaderno/labores')
const { exportarCsv } = require('../../src/services/cuaderno/exportar')

const square = (x, y, d) => ({ type: 'Polygon', coordinates: [[[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]]] })
const fuente = async () => ({
  municipio: { ine: '37022', catastro: '37022', nombre: 'Aldeaseca' }, campaña: 2026, fuente: { datos: 'SIGPAC 2026' },
  features: [
    { type: 'Feature', geometry: square(-5.2, 40.94, 0.003), properties: { agr: 0, zona: 0, pol: 501, par: 77, rec: 1, uso: 'TA', sup: 50000, reg: 0, cat: null } },
    { type: 'Feature', geometry: square(-5.15, 40.96, 0.0015), properties: { agr: 0, zona: 0, pol: 502, par: 10, rec: 2, uso: 'TA', sup: 30000, reg: 0, cat: null } }
  ]
})

async function setup() {
  const store = memoryStore()
  const now = () => new Date('2026-11-20T10:00:00Z')
  const cu = cuentas.createService(store, { now })
  const ex = explotacion.createService(store, { now, fuenteSigpac: fuente })
  await cu.registrar({ email: 'ana@ejemplo.es', password: 'una-clave-larga', nombre: 'Ana' })
  const ana = (await cu.entrar({ email: 'ana@ejemplo.es', password: 'una-clave-larga' })).usuario
  const e = await ex.crearExplotacion(ana, { nombre: 'Finca Ana' })
  const r1 = await ex.guardarRecinto(ana, e._id, { ine: '37022', ref: { pol: 501, par: 77, rec: 1 } })
  const r2 = await ex.guardarRecinto(ana, e._id, { ine: '37022', ref: { pol: 502, par: 10, rec: 2 } })
  // Trigo dado de alta sin fecha de siembra ni variedad (como suele pasar)
  const c = await ex.crearCultivo(ana, e._id, { campaña: 2027, especie: 'Trigo blando', unidades: [{ recintoId: r1._id }, { recintoId: r2._id }] })
  return { store, ex, ana, e, r1, r2, c }
}
const parte = (c, tipo, labor, extra = {}) => ({ tipo, estado: 'confirmado', fechaEfectiva: '2026-10-28', ejecutor: { nombre: 'Ana' }, imputaciones: [{ cultivoId: c._id, recintoId: extra.r || undefined }].filter(Boolean), labor, ...extra })

test('siembra: cantidad de semilla y autorrelleno del cultivo (fecha y variedad, sin pisar)', async () => {
  const { store, ex, ana, e, r1, r2, c } = await setup()
  const op = await ex.crearOperacion(ana, e._id, {
    tipo: 'siembra', estado: 'confirmado', fechaEfectiva: '2026-10-28', ejecutor: { nombre: 'Ana' },
    imputaciones: [{ cultivoId: c._id, recintoId: r1._id }, { cultivoId: c._id, recintoId: r2._id }],
    labor: { semilla: { variedad: 'Nogal', lote: 'L-2026-14', certificada: true, tratada: true }, dosis: { valor: 180, unidad: 'kg/ha' }, maquina: 'Sembradora 4 m' }
  })
  assert.strictEqual(op.estado, 'confirmado')
  assert.strictEqual(op.lineas.length, 0, 'la siembra no lleva productos')
  assert.strictEqual(op.derivados.siembra.cantidad.valor, 1440) // 8 ha × 180 kg/ha
  const cult = await store.get('cultivos', c._id)
  assert.strictEqual(cult.fechaInicio, '2026-10-28')
  assert.strictEqual(cult.variedad, 'Nogal')
  assert.strictEqual(cult.autorrelleno.fechaInicio.desde, op._id)
  // Una segunda siembra (resiembra) no pisa lo que ya tenía
  await ex.crearOperacion(ana, e._id, { tipo: 'siembra', estado: 'confirmado', fechaEfectiva: '2026-11-12', ejecutor: { nombre: 'Ana' }, imputaciones: [{ cultivoId: c._id, recintoId: r2._id }], labor: { semilla: { variedad: 'Otra' }, dosis: { valor: 60, unidad: 'kg/ha' } } })
  const otra = await store.get('cultivos', c._id)
  assert.strictEqual(otra.fechaInicio, '2026-10-28')
  assert.strictEqual(otra.variedad, 'Nogal')
})

test('lo que falta para confirmar: variedad y dosis, agua, qué labor, cuánto se cosechó', async () => {
  const { ex, ana, e, c } = await setup()
  const casos = [
    ['siembra', { dosis: { valor: 180, unidad: 'kg/ha' } }, 'labor.semilla.variedad'],
    ['riego', { sistema: 'pivot' }, 'labor.volumen'],
    ['labor', { maquina: 'Tractor' }, 'labor.clase'],
    ['cosecha', { humedad: 12 }, 'labor.cantidad']
  ]
  for (const [tipo, labor, campo] of casos) {
    const op = await ex.crearOperacion(ana, e._id, { tipo, estado: 'confirmado', fechaEfectiva: '2026-10-28', ejecutor: { nombre: 'Ana' }, imputaciones: [{ cultivoId: c._id, recintoId: (await ex.listarRecintos(ana, e._id))[0]._id }], labor })
    assert.strictEqual(op.estado, 'borrador', tipo)
    assert.ok(op.pendientes.some(p => p.campo === campo), `${tipo}: ${campo}`)
  }
  // Valores raros no se inventan: unidad desconocida → vacía
  assert.strictEqual(labores.normalizar('riego', { volumen: { valor: 20, unidad: 'cubos' } }).volumen.unidad, null)
})

test('riego, labor y cosecha: cálculos, cuaderno y hoja de cálculo', async () => {
  const { ex, ana, e, r1, r2, c } = await setup()
  const en = (r) => [{ cultivoId: c._id, recintoId: r._id }]
  const riego = await ex.crearOperacion(ana, e._id, { tipo: 'riego', estado: 'confirmado', fechaEfectiva: '2026-11-05', ejecutor: { nombre: 'Ana' }, imputaciones: en(r1), labor: { volumen: { valor: 25, unidad: 'mm' }, sistema: 'pivot', horas: 10, origen: 'pozo' } })
  assert.deepStrictEqual([riego.derivados.riego.m3.valor, riego.derivados.riego.mm.valor], [1250, 25]) // 25 mm × 5 ha × 10
  const r2m3 = labores.calcular('riego', { volumen: { valor: 900, unidad: 'm3' } }, 30000)
  assert.strictEqual(r2m3.riego.mm.valor, 30) // 900 m³ en 3 ha = 300 m³/ha = 30 mm
  const alzar = await ex.crearOperacion(ana, e._id, { tipo: 'labor', estado: 'confirmado', fechaEfectiva: '2026-10-10', ejecutor: { nombre: 'Luis' }, imputaciones: en(r2), labor: { clase: 'alzar', maquina: 'Vertedera 4 cuerpos', profundidad: 30 } })
  assert.strictEqual(alzar.estado, 'confirmado')
  const cosecha = await ex.crearOperacion(ana, e._id, { tipo: 'cosecha', estado: 'confirmado', fechaEfectiva: '2026-11-18', ejecutor: { nombre: 'Ana' }, imputaciones: [...en(r1), ...en(r2)], labor: { producto: 'Grano', cantidad: { valor: 36, unidad: 't' }, humedad: 12.5, destino: 'cooperativa', lote: 'C-1' } })
  assert.strictEqual(cosecha.derivados.cosecha.rendimiento.valor, 4500) // 36 t en 8 ha

  const cu = await ex.cuaderno(ana, e._id, { campaña: 2027 })
  assert.match(cu.ambito, /siembra, riego, labores y cosecha/)
  assert.strictEqual(cu.labores.length, 4) // riego 1, labor 1, cosecha 2 (una por recinto)
  const filasCosecha = cu.labores.filter(l => l.tipo === 'Cosecha')
  assert.deepStrictEqual(filasCosecha.map(l => l.cantidad.valor), [22500, 13500]) // repartido por superficie (5 y 3 ha)
  assert.match(cu.labores.find(l => l.tipo === 'Labor').detalle, /Alzar \(vertedera\), con Vertedera 4 cuerpos, a 30 cm/)
  const csv = exportarCsv(cu, { base: 'https://x' })
  assert.match(csv, /Siembra, riego, labores y cosecha/)
  assert.match(csv, /2026-11-05;Riego;.*25 mm \(1250 m³\), Pívot, 10 h, agua de pozo;1250,00;m3;Ana/)

  // Rectificar una labor: nueva versión y recálculo
  const rect = await ex.rectificarOperacion(ana, e._id, cosecha._id, { version: 1, motivo: 'Báscula de la cooperativa', cambios: { labor: { cantidad: { valor: 34000, unidad: 'kg' } } } })
  assert.strictEqual(rect.version, 2)
  assert.strictEqual(rect.derivados.cosecha.rendimiento.valor, 4250)
  assert.strictEqual(rect.labor.humedad, 12.5, 'lo que no se cambia se conserva')
})
