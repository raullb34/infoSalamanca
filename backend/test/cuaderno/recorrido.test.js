// Primer recorrido del cuaderno (services/cuaderno) con el almacén en memoria y un SIGPAC sintético:
// cuenta → explotación → recinto guardado desde el visor → cultivo de campaña → parte de abonado parcial → cuaderno.
// Y las pruebas de aceptación que ya aplican: permisos entre cuentas, superficies sin doble cómputo, reintentos sin
// duplicar, edición simultánea, nueva campaña SIGPAC y plazos.
const test = require('node:test')
const assert = require('node:assert')
const { memoryStore } = require('../../src/services/cuaderno/store')
const cuentas = require('../../src/services/cuaderno/cuentas')
const explotacion = require('../../src/services/cuaderno/explotacion')
const { redondear } = require('../../src/services/cuaderno/fertilizacion')

// SIGPAC sintético de un municipio: un recinto de 6 ha (TA) y otro de 2 ha
const square = (x, y, d) => ({ type: 'Polygon', coordinates: [[[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]]] })
const sigpac = (campaña, sup = 60000) => ({
  municipio: { ine: '37022', catastro: '37022', nombre: 'Aldeaseca de la Frontera' }, campaña,
  fuente: { datos: `SIGPAC ${campaña} · ITACyL`, url: 'http://ejemplo/37022.zip', fechaReferencia: `${campaña - 1}-12-15` },
  features: [
    { type: 'Feature', geometry: square(-5.2, 40.94, 0.003), properties: { agr: 0, zona: 0, pol: 501, par: 77, rec: 1, uso: 'TA', sup, reg: 0, cat: '37022A501000770000JD' } },
    { type: 'Feature', geometry: square(-5.19, 40.95, 0.0015), properties: { agr: 0, zona: 0, pol: 501, par: 78, rec: 1, uso: 'TA', sup: 20000, reg: 0, cat: null } }
  ]
})

async function setup({ now = () => new Date('2026-11-20T10:00:00Z') } = {}) {
  const store = memoryStore()
  let fuente = sigpac(2026)
  const cu = cuentas.createService(store, { now })
  const ex = explotacion.createService(store, { now, fuenteSigpac: async (ine) => (ine === '37022' ? fuente : null) })
  await cu.registrar({ email: 'ana@ejemplo.es', password: 'una-clave-larga', nombre: 'Ana' })
  await cu.registrar({ email: 'otro@ejemplo.es', password: 'otra-clave-larga', nombre: 'Otro' })
  const ana = (await cu.entrar({ email: 'ana@ejemplo.es', password: 'una-clave-larga' })).usuario
  const otro = (await cu.entrar({ email: 'otro@ejemplo.es', password: 'otra-clave-larga' })).usuario
  return { store, cu, ex, ana, otro, setFuente: (f) => { fuente = f } }
}

test('cuentas: contraseña con hash, sesión por token, sin revelar qué correos existen', async () => {
  const { store, cu } = await setup()
  const [u] = await store.find('usuarios', { email: 'ana@ejemplo.es' })
  assert.match(u.hash, /^scrypt\$/)
  assert.ok(!JSON.stringify(u).includes('una-clave-larga'))
  const { token } = await cu.entrar({ email: 'ANA@ejemplo.es', password: 'una-clave-larga' })
  assert.strictEqual((await cu.usuarioDeSesion(token)).email, 'ana@ejemplo.es')
  const [s] = await store.find('sesiones', {})
  assert.notStrictEqual(s.hash, token, 'en la base no está el token, solo su hash')
  await assert.rejects(cu.entrar({ email: 'ana@ejemplo.es', password: 'mala' }), /Correo o contraseña incorrectos/)
  await assert.rejects(cu.entrar({ email: 'nadie@ejemplo.es', password: 'x' }), /Correo o contraseña incorrectos/)
  await assert.rejects(cu.registrar({ email: 'ana@ejemplo.es', password: 'una-clave-larga' }), /Ya hay una cuenta/)
  await cu.salir(token)
  assert.strictEqual(await cu.usuarioDeSesion(token), null)
})

test('recorrido: recinto → cultivo → abonado parcial de 5,10 ha a 180 kg/ha → 918 kg y 137,7 kg de N en el cuaderno', async () => {
  const { ex, ana } = await setup()
  const e = await ex.crearExplotacion(ana, { nombre: 'Finca Ana' })
  const r = await ex.guardarRecinto(ana, e._id, { ine: '37022', ref: { pol: 501, par: 77, rec: 1 } })
  assert.strictEqual(r.refTexto, '37:22:0:0:501:77:1')
  assert.deepStrictEqual(r.superficieOficial, { valor: 60000, unidad: 'm2', procedencia: 'oficial' })
  assert.strictEqual(r.fuente.fechaReferencia, '2025-12-15')
  const c = await ex.crearCultivo(ana, e._id, { campaña: 2026, especie: 'Trigo blando', regimen: 'secano', fechaInicio: '2025-11-01', fechaFin: '2026-07-31', unidades: [{ recintoId: r._id }] })
  assert.strictEqual(c.unidades[0].superficie.valor, 60000)
  // Abonado parcial: 5,10 ha de las 6 (superficie declarada)
  const op = await ex.crearOperacion(ana, e._id, {
    id: 'parte-1', tipo: 'abonado', estado: 'confirmado', fechaEfectiva: '2026-02-10', ejecutor: { nombre: 'Ana' },
    imputaciones: [{ cultivoId: c._id, superficie: { metodo: 'declarada', valor: 51000 } }],
    lineas: [{ producto: { nombre: 'NPK 15-15-15', tipo: 'mineral', composicion: { N: 15, P2O5: 15, K2O: 15 } }, dosis: { valor: 180, unidad: 'kg/ha' } }]
  })
  assert.strictEqual(op.estado, 'confirmado')
  assert.strictEqual(redondear(op.derivados.lineas[0].cantidad.valor, 3), 918)
  assert.strictEqual(op.imputaciones[0].superficie.procedencia, 'usuario')
  // El cuaderno (lo que se ve en el ordenador) cuadra con el parte y enlaza a él
  const cu = await ex.cuaderno(ana, e._id, { campaña: 2026 })
  assert.strictEqual(cu.filas.length, 1)
  assert.strictEqual(cu.filas[0].operacionId, 'parte-1')
  assert.strictEqual(redondear(cu.filas[0].productos[0].cantidad.valor, 3), 918)
  assert.strictEqual(redondear(cu.totales.N, 3), 137.7)
  assert.strictEqual(redondear(cu.totales.superficieEjecutada, 3), 51000)
  // La superficie oficial del recinto no cambia
  assert.strictEqual((await ex.listarRecintos(ana, e._id))[0].superficieOficial.valor, 60000)
})

test('otra cuenta no puede leer ni escribir la explotación ajena', async () => {
  const { ex, ana, otro } = await setup()
  const e = await ex.crearExplotacion(ana, { nombre: 'Finca Ana' })
  await assert.rejects(ex.listarRecintos(otro, e._id), (err) => err.status === 404)
  await assert.rejects(ex.listarOperaciones(otro, e._id), (err) => err.status === 404)
  await assert.rejects(ex.cuaderno(otro, e._id, { campaña: 2026 }), (err) => err.status === 404)
  await assert.rejects(ex.guardarRecinto(otro, e._id, { ine: '37022', ref: { pol: 501, par: 77, rec: 1 } }), (err) => err.status === 404)
  assert.deepStrictEqual(await ex.listarExplotaciones(otro), [])
  await assert.rejects(ex.listarExplotaciones(null), (err) => err.status === 401)
})

test('dos cultivos a la vez en un recinto: caben si suman su superficie; un tercero no (sin doble cómputo)', async () => {
  const { ex, ana } = await setup()
  const e = await ex.crearExplotacion(ana, { nombre: 'Finca' })
  const r = await ex.guardarRecinto(ana, e._id, { ine: '37022', ref: { pol: 501, par: 77, rec: 1 } })
  await ex.crearCultivo(ana, e._id, { campaña: 2026, especie: 'Cebada', fechaInicio: '2025-11-01', fechaFin: '2026-07-15', unidades: [{ recintoId: r._id, superficie: { metodo: 'declarada', valor: 40000 } }] })
  await ex.crearCultivo(ana, e._id, { campaña: 2026, especie: 'Veza', fechaInicio: '2025-11-01', fechaFin: '2026-06-30', unidades: [{ recintoId: r._id, superficie: { metodo: 'declarada', valor: 20000 } }] })
  await assert.rejects(ex.crearCultivo(ana, e._id, { campaña: 2026, especie: 'Avena', fechaInicio: '2026-01-01', unidades: [{ recintoId: r._id, superficie: { metodo: 'declarada', valor: 5000 } }] }), (err) => err.status === 409)
  // Uno sucesivo (después de la cosecha) sí cabe
  const girasol = await ex.crearCultivo(ana, e._id, { campaña: 2026, especie: 'Girasol', fechaInicio: '2026-08-01', fechaFin: '2026-10-30', unidades: [{ recintoId: r._id }] })
  assert.strictEqual(girasol.unidades[0].superficie.valor, 60000)
  assert.strictEqual((await ex.listarCultivos(ana, e._id, { campaña: 2026 })).length, 3)
})

test('una finca de varios recintos: un parte con tres imputaciones es un solo parte', async () => {
  const { ex, ana } = await setup()
  const e = await ex.crearExplotacion(ana, { nombre: 'Finca' })
  const r1 = await ex.guardarRecinto(ana, e._id, { ine: '37022', ref: { pol: 501, par: 77, rec: 1 } })
  const r2 = await ex.guardarRecinto(ana, e._id, { ine: '37022', ref: { pol: 501, par: 78, rec: 1 } })
  const c = await ex.crearCultivo(ana, e._id, { campaña: 2026, especie: 'Trigo', unidades: [{ recintoId: r1._id }, { recintoId: r2._id }] })
  const op = await ex.crearOperacion(ana, e._id, {
    tipo: 'abonado', estado: 'confirmado', fechaEfectiva: '2026-02-10', ejecutor: { nombre: 'Ana' },
    imputaciones: [{ cultivoId: c._id, recintoId: r1._id }, { cultivoId: c._id, recintoId: r2._id }],
    lineas: [{ producto: { nombre: 'Urea 46', composicion: { N: 46, P2O5: 0, K2O: 0 } }, dosis: { valor: 100, unidad: 'kg/ha' } }]
  })
  assert.strictEqual((await ex.listarOperaciones(ana, e._id)).length, 1)
  assert.strictEqual(op.derivados.superficieEjecutada.valor, 80000)
  assert.strictEqual(redondear(op.derivados.totales.N.valor, 3), 368)
  const cu = await ex.cuaderno(ana, e._id, { campaña: 2026 })
  assert.strictEqual(cu.filas.length, 2)
  assert.strictEqual(redondear(cu.totales.N, 3), 368)
})

test('reintentos sin red: el mismo parte dos veces aparece una sola vez', async () => {
  const { ex, ana } = await setup()
  const e = await ex.crearExplotacion(ana, { nombre: 'Finca' })
  const r = await ex.guardarRecinto(ana, e._id, { ine: '37022', ref: { pol: 501, par: 77, rec: 1 } })
  const c = await ex.crearCultivo(ana, e._id, { campaña: 2026, especie: 'Trigo', unidades: [{ recintoId: r._id }] })
  const parte = { id: 'movil-123', tipo: 'abonado', estado: 'confirmado', fechaEfectiva: '2026-02-10', ejecutor: { nombre: 'Ana' }, imputaciones: [{ cultivoId: c._id }], lineas: [{ producto: { nombre: 'Urea', composicion: { N: 46 } }, dosis: { valor: 100, unidad: 'kg/ha' } }] }
  await ex.crearOperacion(ana, e._id, parte)
  const again = await ex.crearOperacion(ana, e._id, parte)
  await ex.crearOperacion(ana, e._id, parte)
  assert.strictEqual(again.repetida, true)
  assert.strictEqual((await ex.listarOperaciones(ana, e._id)).length, 1)
})

test('borrador fuera de los totales; datos que faltan quedan en la bandeja; registro fuera de plazo, incidencia', async () => {
  const { ex, ana } = await setup()
  const e = await ex.crearExplotacion(ana, { nombre: 'Finca' })
  const r = await ex.guardarRecinto(ana, e._id, { ine: '37022', ref: { pol: 501, par: 77, rec: 1 } })
  const c = await ex.crearCultivo(ana, e._id, { campaña: 2026, especie: 'Trigo', fechaInicio: '2025-11-01', fechaFin: '2026-07-31', unidades: [{ recintoId: r._id }] })
  // Sin quién lo hizo: se guarda como borrador
  const b = await ex.crearOperacion(ana, e._id, { tipo: 'abonado', estado: 'confirmado', fechaEfectiva: '2026-03-01', imputaciones: [{ cultivoId: c._id }], lineas: [{ producto: { nombre: 'Purín' }, dosis: { valor: 30, unidad: 'm3/ha' } }] })
  assert.strictEqual(b.estado, 'borrador')
  assert.ok(b.pendientes.some(p => p.campo === 'ejecutor'))
  assert.ok(b.pendientes.some(p => p.campo === 'lineas[0].producto.densidad'))
  // Registrado el 20/11 lo hecho el 10/02: fuera del plazo de referencia (se conserva con sus fechas)
  const tarde = await ex.crearOperacion(ana, e._id, { tipo: 'abonado', estado: 'confirmado', fechaEfectiva: '2026-02-10', ejecutor: { nombre: 'Ana' }, imputaciones: [{ cultivoId: c._id }], lineas: [{ producto: { nombre: 'Urea', composicion: { N: 46, P2O5: 0, K2O: 0 } }, dosis: { valor: 100, unidad: 'kg/ha' } }] })
  assert.strictEqual(tarde.fechaEfectiva, '2026-02-10')
  assert.ok(tarde.incidencias.some(i => i.codigo === 'FERT-02' && i.regla.estado === 'pendiente de revisión'))
  const cu = await ex.cuaderno(ana, e._id, { campaña: 2026 })
  assert.strictEqual(cu.filas.length, 1, 'solo el confirmado')
  assert.strictEqual(redondear(cu.totales.N, 3), 276)
  assert.ok(cu.bandeja.some(x => x.tipo === 'borrador'))
  assert.ok(cu.bandeja.some(x => x.tipo === 'incidencia' && x.codigo === 'FERT-02'))
})

test('rectificar guarda la versión anterior y recalcula; dos dispositivos a la vez conservan las dos versiones', async () => {
  const { ex, ana } = await setup()
  const e = await ex.crearExplotacion(ana, { nombre: 'Finca' })
  const r = await ex.guardarRecinto(ana, e._id, { ine: '37022', ref: { pol: 501, par: 77, rec: 1 } })
  const c = await ex.crearCultivo(ana, e._id, { campaña: 2026, especie: 'Trigo', unidades: [{ recintoId: r._id }] })
  const op = await ex.crearOperacion(ana, e._id, { tipo: 'abonado', estado: 'confirmado', fechaEfectiva: '2026-11-10', ejecutor: { nombre: 'Ana' }, imputaciones: [{ cultivoId: c._id, superficie: { metodo: 'declarada', valor: 51000 } }], lineas: [{ producto: { nombre: 'NPK 15-15-15', composicion: { N: 15, P2O5: 15, K2O: 15 } }, dosis: { valor: 180, unidad: 'kg/ha' } }] })
  await assert.rejects(ex.rectificarOperacion(ana, e._id, op._id, { cambios: { lineas: [] }, version: 1 }), /motivo/)
  // Se excluye una franja de 0,5 ha
  const r2 = await ex.rectificarOperacion(ana, e._id, op._id, { version: 1, motivo: 'Una franja no se abonó', cambios: { imputaciones: [{ cultivoId: c._id, superficie: { metodo: 'declarada', valor: 46000 } }] } })
  assert.strictEqual(r2.version, 2)
  assert.strictEqual(redondear(r2.derivados.lineas[0].cantidad.valor, 3), 828)
  assert.strictEqual(redondear(r2.versiones[0].derivados.lineas[0].cantidad.valor, 3), 918, 'el estado anterior se puede reproducir')
  assert.strictEqual(r2.rectificaciones[0].motivo, 'Una franja no se abonó')
  // Otro dispositivo, que tenía la versión 1, intenta cambiarlo: no pisa, se guarda como conflicto
  await assert.rejects(ex.rectificarOperacion(ana, e._id, op._id, { version: 1, motivo: 'Otra dosis', cambios: { lineas: [{ producto: { nombre: 'NPK 15-15-15', composicion: { N: 15, P2O5: 15, K2O: 15 } }, dosis: { valor: 200, unidad: 'kg/ha' } }] } }), (err) => err.status === 409)
  const guardado = await ex.obtenerOperacion(ana, e._id, op._id)
  assert.strictEqual(guardado.version, 2)
  assert.strictEqual(guardado.conflictos.length, 1)
  assert.strictEqual(guardado.conflictos[0].cambios.lineas[0].dosis.valor, 200)
})

test('nueva campaña SIGPAC: el recinto se actualiza y conserva la versión anterior; el historial sigue', async () => {
  const { ex, ana, setFuente } = await setup()
  const e = await ex.crearExplotacion(ana, { nombre: 'Finca' })
  const r = await ex.guardarRecinto(ana, e._id, { ine: '37022', ref: { pol: 501, par: 77, rec: 1 } })
  const c = await ex.crearCultivo(ana, e._id, { campaña: 2026, especie: 'Trigo', unidades: [{ recintoId: r._id }] })
  setFuente(sigpac(2027, 59500))
  const r2027 = await ex.guardarRecinto(ana, e._id, { ine: '37022', ref: { pol: 501, par: 77, rec: 1 } })
  assert.strictEqual(r2027._id, r._id)
  assert.strictEqual(r2027.campaña, 2027)
  assert.strictEqual(r2027.superficieOficial.valor, 59500)
  assert.strictEqual(r2027.versionesAnteriores[0].campaña, 2026)
  assert.strictEqual(r2027.versionesAnteriores[0].superficieOficial.valor, 60000)
  // El cultivo de 2026 conserva su superficie y la campaña SIGPAC con la que se dio de alta
  const [c2026] = await ex.listarCultivos(ana, e._id, { campaña: 2026 })
  assert.strictEqual(c2026._id, c._id)
  assert.strictEqual(c2026.unidades[0].superficie.valor, 60000)
  assert.strictEqual(c2026.unidades[0].campañaSigpac, 2026)
})

test('croquis de una zona tratada: superficie geodésica, con su procedencia; un croquis inválido se rechaza', async () => {
  const { ex, ana } = await setup()
  const e = await ex.crearExplotacion(ana, { nombre: 'Finca' })
  const r = await ex.guardarRecinto(ana, e._id, { ine: '37022', ref: { pol: 501, par: 77, rec: 1 } })
  const c = await ex.crearCultivo(ana, e._id, { campaña: 2026, especie: 'Trigo', unidades: [{ recintoId: r._id }] })
  const op = await ex.crearOperacion(ana, e._id, { tipo: 'abonado', estado: 'borrador', fechaEfectiva: '2026-11-15', imputaciones: [{ cultivoId: c._id, superficie: { metodo: 'croquis', geometria: square(-5.2, 40.94, 0.001) } }], lineas: [] })
  const s = op.imputaciones[0].superficie
  assert.strictEqual(s.metodo, 'croquis')
  assert.strictEqual(s.procedencia, 'dispositivo')
  assert.ok(s.valor > 9000 && s.valor < 9600, `≈ 0,93 ha (${s.valor})`)
  await assert.rejects(ex.crearOperacion(ana, e._id, { tipo: 'abonado', imputaciones: [{ cultivoId: c._id, superficie: { metodo: 'croquis', geometria: { type: 'Point', coordinates: [0, 0] } } }], lineas: [] }), /croquis/)
})

test('exportación: el CSV cuadra con el parte (918 kg, 137,7 kg de N), lleva ámbito, versión y enlace al parte', async () => {
  const { exportarCsv } = require('../../src/services/cuaderno/exportar')
  const { ex, ana } = await setup()
  const e = await ex.crearExplotacion(ana, { nombre: 'Finca; Ana' })
  const r = await ex.guardarRecinto(ana, e._id, { ine: '37022', ref: { pol: 501, par: 77, rec: 1 } })
  const c = await ex.crearCultivo(ana, e._id, { campaña: 2026, especie: 'Trigo', unidades: [{ recintoId: r._id }] })
  await ex.crearOperacion(ana, e._id, { id: 'p-1', tipo: 'abonado', estado: 'confirmado', fechaEfectiva: '2026-11-10', ejecutor: { nombre: 'Ana' }, imputaciones: [{ cultivoId: c._id, superficie: { metodo: 'declarada', valor: 51000 } }], lineas: [{ producto: { nombre: 'NPK 15-15-15', composicion: { N: 15, P2O5: 15, K2O: 15 } }, dosis: { valor: 180, unidad: 'kg/ha' } }] })
  const csv = exportarCsv(await ex.cuaderno(ana, e._id, { campaña: 2026 }), { base: 'https://ejemplo.test' })
  assert.ok(csv.startsWith('﻿'))
  assert.match(csv, /"Finca; Ana"/, 'los textos con ; van entre comillas')
  const fila = csv.split('\r\n').find(l => l.startsWith('2026-11-10;'))
  assert.match(fila, /;5,1000;Declarada;NPK 15-15-15;180,00;kg\/ha;918,00;kg;137,70;137,70;137,70;Ana;p-1;1;/)
  assert.match(fila, /explotacion=.*&parte=p-1$/)
  assert.match(csv, /Versión \(parte@versión\);p-1@1/)
  assert.match(csv, /Totales de abonado confirmados;;;;;5,1000;;;;;;;137,70;137,70;137,70/)
  // Los totales caen bajo sus columnas (superficie y N)
  const lineas = csv.split('\r\n').map(l => l.split(';'))
  const cab = lineas.find(l => l[0].endsWith('Fecha') && l.includes('N (kg)'))
  const tot = lineas.find(l => l[0] === 'Totales de abonado confirmados')
  assert.strictEqual(tot[cab.indexOf('Superficie ejecutada (ha)')], '5,1000')
  assert.strictEqual(tot[cab.indexOf('N (kg)')], '137,70')
})
