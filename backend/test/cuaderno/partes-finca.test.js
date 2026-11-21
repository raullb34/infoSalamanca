// Parte «en La Hoya»: la finca se convierte en los cultivos que había en sus recintos en la fecha del trabajo.
// Parte de un recinto (declarada en la finca) → esa superficie; recinto sin cultivo ese día → aviso, no se inventa.
const test = require('node:test')
const assert = require('node:assert')
const { memoryStore } = require('../../src/services/cuaderno/store')
const cuentas = require('../../src/services/cuaderno/cuentas')
const explotacion = require('../../src/services/cuaderno/explotacion')

const square = (x, y, d) => ({ type: 'Polygon', coordinates: [[[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]]] })
const fuente = async () => ({
  municipio: { ine: '37022', catastro: '37022', nombre: 'Aldeaseca' }, campaña: 2026, fuente: { datos: 'SIGPAC 2026' },
  features: [
    { type: 'Feature', geometry: square(-5.2, 40.94, 0.003), properties: { agr: 0, zona: 0, pol: 501, par: 77, rec: 1, uso: 'TA', sup: 60000, reg: 0, cat: null } },
    { type: 'Feature', geometry: square(-5.15, 40.96, 0.0015), properties: { agr: 0, zona: 0, pol: 502, par: 10, rec: 2, uso: 'TA', sup: 20000, reg: 0, cat: null } },
    { type: 'Feature', geometry: square(-5.1, 40.97, 0.0015), properties: { agr: 0, zona: 0, pol: 503, par: 5, rec: 1, uso: 'TA', sup: 20000, reg: 0, cat: null } }
  ]
})
const urea = [{ producto: { nombre: 'Urea', composicion: { N: 46, P2O5: 0, K2O: 0 } }, dosis: { valor: 200, unidad: 'kg/ha' } }]

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
  const r3 = await ex.guardarRecinto(ana, e._id, { ine: '37022', ref: { pol: 503, par: 5, rec: 1 } })
  // La Hoya: todo r1, una hectárea de r2 y todo r3 (discontinua)
  const hoya = await ex.crearFinca(ana, e._id, {
    nombre: 'La Hoya',
    recintos: [{ recintoId: r1._id }, { recintoId: r2._id, superficie: { metodo: 'declarada', valor: 10000 } }, { recintoId: r3._id }]
  })
  return { ex, ana, e, r1, r2, r3, hoya }
}

test('parte por finca: cultivos de esa fecha, parte del recinto y recinto sin cultivo', async () => {
  const { ex, ana, e, r1, r2, r3, hoya } = await setup()
  await ex.crearCultivo(ana, e._id, { campaña: 2027, especie: 'Trigo blando', fechaInicio: '2026-10-20', unidades: [{ recintoId: r1._id }, { recintoId: r2._id }] })
  // En r3 hubo girasol, pero terminó antes del abonado: no cuenta
  await ex.crearCultivo(ana, e._id, { campaña: 2026, especie: 'Girasol', fechaInicio: '2026-04-15', fechaFin: '2026-10-01', unidades: [{ recintoId: r3._id }] })

  const op = await ex.crearOperacion(ana, e._id, { tipo: 'abonado', estado: 'confirmado', fechaEfectiva: '2026-11-15', fincaId: hoya._id, ejecutor: { nombre: 'Ana' }, lineas: urea })
  assert.strictEqual(op.estado, 'confirmado')
  assert.deepStrictEqual(op.imputaciones.map(i => [i.especie, i.refTexto, i.superficie.valor]), [
    ['Trigo blando', r1.refTexto, 60000],
    ['Trigo blando', r2.refTexto, 10000] // la hectárea de r2 que es de La Hoya
  ])
  assert.strictEqual(op.imputaciones[1].superficie.procedencia, 'historial', 'propuesto por la finca guardada')
  assert.deepStrictEqual(op.finca, { fincaId: hoya._id, nombre: 'La Hoya', sinCultivo: [r3.refTexto] })
  assert.strictEqual(op.campaña, 2027)
  // 7 ha × 200 kg/ha
  assert.strictEqual(op.derivados.superficieEjecutada.valor, 70000)
  assert.strictEqual(op.derivados.lineas[0].cantidad.valor, 1400)

  // El mismo parte en el cuaderno
  const c = await ex.cuaderno(ana, e._id, { campaña: 2027 })
  assert.strictEqual(c.filas.length, 2)
  assert.deepStrictEqual(c.filas.map(x => x.finca), ['La Hoya', 'La Hoya'])
  const csv = require('../../src/services/cuaderno/exportar').exportarCsv(c, { base: 'https://x' })
  assert.match(csv, /;La Hoya;Trigo blando;/)
})

test('parte por finca: sin ningún cultivo ese día queda en borrador con «falta dónde»', async () => {
  const { ex, ana, e, hoya } = await setup()
  const op = await ex.crearOperacion(ana, e._id, { tipo: 'abonado', estado: 'confirmado', fechaEfectiva: '2026-11-15', fincaId: hoya._id, ejecutor: { nombre: 'Ana' }, lineas: urea })
  assert.strictEqual(op.estado, 'borrador')
  assert.ok(op.pendientes.some(p => p.campo === 'imputaciones'))
  assert.strictEqual(op.finca.sinCultivo.length, 3)
  await assert.rejects(ex.crearOperacion(ana, e._id, { tipo: 'abonado', fechaEfectiva: '2026-11-15', fincaId: 'no-existe', lineas: urea }), (err) => err.status === 404)
})

test('parte por finca: una parte cultivada menor que la de la finca no se pasa', async () => {
  const { ex, ana, e, r1, r2, hoya } = await setup()
  // En r2 solo se sembraron 0,5 ha; la finca dice 1 ha de r2 → se abona lo cultivado (0,5 ha)
  await ex.crearCultivo(ana, e._id, { campaña: 2027, especie: 'Cebada', fechaInicio: '2026-10-25', unidades: [{ recintoId: r1._id }, { recintoId: r2._id, superficie: { metodo: 'declarada', valor: 5000 } }] })
  const op = await ex.crearOperacion(ana, e._id, { tipo: 'abonado', fechaEfectiva: '2026-11-15', fincaId: hoya._id, ejecutor: { nombre: 'Ana' }, lineas: urea })
  assert.deepStrictEqual(op.imputaciones.map(i => i.superficie.valor), [60000, 5000])
})
