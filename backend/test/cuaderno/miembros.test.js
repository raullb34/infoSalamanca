// Papeles dentro de una explotación (services/cuaderno): el titular da acceso; el asesor lee pero no registra; quien
// ejecuta registra pero no confirma (su parte queda en borrador hasta que confirme el titular); siempre un titular.
// Fincas de trabajo con varios recintos (discontinua) y partes de recintos.
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
    { type: 'Feature', geometry: square(-5.15, 40.96, 0.0015), properties: { agr: 0, zona: 0, pol: 502, par: 10, rec: 2, uso: 'TA', sup: 20000, reg: 0, cat: null } }
  ]
})

async function setup() {
  const store = memoryStore()
  const now = () => new Date('2026-11-20T10:00:00Z')
  const cu = cuentas.createService(store, { now })
  const ex = explotacion.createService(store, { now, fuenteSigpac: fuente })
  const user = async (email, nombre) => { await cu.registrar({ email, password: 'una-clave-larga', nombre }); return (await cu.entrar({ email, password: 'una-clave-larga' })).usuario }
  const ana = await user('ana@ejemplo.es', 'Ana')
  const luis = await user('luis@ejemplo.es', 'Luis')
  const pepe = await user('pepe@ejemplo.es', 'Pepe')
  const e = await ex.crearExplotacion(ana, { nombre: 'Finca Ana' })
  const r1 = await ex.guardarRecinto(ana, e._id, { ine: '37022', ref: { pol: 501, par: 77, rec: 1 } })
  const r2 = await ex.guardarRecinto(ana, e._id, { ine: '37022', ref: { pol: 502, par: 10, rec: 2 } })
  const c = await ex.crearCultivo(ana, e._id, { campaña: 2026, especie: 'Trigo', unidades: [{ recintoId: r1._id }] })
  return { ex, ana, luis, pepe, e, r1, r2, c }
}
const parte = (c) => ({ tipo: 'abonado', estado: 'confirmado', fechaEfectiva: '2026-11-10', ejecutor: { nombre: 'Pepe' }, imputaciones: [{ cultivoId: c._id }], lineas: [{ producto: { nombre: 'Urea', composicion: { N: 46, P2O5: 0, K2O: 0 } }, dosis: { valor: 100, unidad: 'kg/ha' } }] })

test('papeles: asesor lee y no registra; ejecutor registra en borrador; el titular confirma', async () => {
  const { ex, ana, luis, pepe, e, c } = await setup()
  await ex.ponerMiembro(ana, e._id, { email: 'luis@ejemplo.es', roles: ['asesor'] })
  await ex.ponerMiembro(ana, e._id, { email: 'pepe@ejemplo.es', roles: ['ejecutor'] })
  // El asesor ve, pero no escribe
  assert.strictEqual((await ex.listarRecintos(luis, e._id)).length, 2)
  await assert.rejects(ex.crearOperacion(luis, e._id, parte(c)), (err) => err.status === 403)
  // Quien ejecuta registra; pide confirmar pero no puede: queda en borrador con el pendiente
  const op = await ex.crearOperacion(pepe, e._id, parte(c))
  assert.strictEqual(op.estado, 'borrador')
  assert.ok(op.pendientes.some(p => p.campo === 'confirmacion'))
  // No puede administrar
  await assert.rejects(ex.ponerMiembro(pepe, e._id, { email: 'luis@ejemplo.es', roles: ['titular'] }), (err) => err.status === 403)
  // El titular lo confirma (rectificar con confirmar)
  const ok = await ex.rectificarOperacion(ana, e._id, op._id, { version: 1, confirmar: true })
  assert.strictEqual(ok.estado, 'confirmado')
  assert.strictEqual(ok.confirmado.por, ana.id)
  // Ver sus explotaciones con su papel
  assert.deepStrictEqual((await ex.listarExplotaciones(luis)).map(x => x.misRoles), [['asesor']])
})

test('miembros: la persona necesita cuenta; siempre queda un titular; quitar el acceso lo corta', async () => {
  const { ex, ana, luis, e } = await setup()
  await assert.rejects(ex.ponerMiembro(ana, e._id, { email: 'nadie@ejemplo.es', roles: ['asesor'] }), (err) => err.status === 404)
  await assert.rejects(ex.ponerMiembro(ana, e._id, { email: 'luis@ejemplo.es', roles: ['jefe'] }), (err) => err.status === 400)
  await assert.rejects(ex.quitarMiembro(ana, e._id, ana.id), /al menos un titular/)
  await ex.ponerMiembro(ana, e._id, { email: 'luis@ejemplo.es', roles: ['asesor'] })
  await ex.quitarMiembro(ana, e._id, luis.id)
  await assert.rejects(ex.listarRecintos(luis, e._id), (err) => err.status === 404)
})

test('finca de trabajo: discontinua (dos recintos), con parte de un recinto, alias y acceso', async () => {
  const { ex, ana, e, r1, r2 } = await setup()
  const f = await ex.crearFinca(ana, e._id, {
    nombre: 'La Hoya', alias: ['El de abajo'],
    recintos: [{ recintoId: r1._id, superficie: { metodo: 'declarada', valor: 40000 } }, { recintoId: r2._id }],
    accesos: [{ lat: 40.9402, lng: -5.1998, descripcion: 'Portera junto al camino', procedencia: 'dispositivo' }, { lat: 200, lng: 0 }]
  })
  assert.strictEqual(f.superficie.valor, 60000)
  assert.strictEqual(f.recintos[0].superficie.metodo, 'declarada')
  assert.strictEqual(f.accesos.length, 1, 'el acceso con coordenadas imposibles se descarta')
  assert.strictEqual((await ex.listarFincas(ana, e._id)).length, 1)
  await assert.rejects(ex.crearFinca(ana, e._id, { nombre: 'X', recintos: [{ recintoId: r2._id, superficie: { metodo: 'declarada', valor: 999999 } }] }), /supera/)
})
