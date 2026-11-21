// Tratamientos fitosanitarios en el cuaderno: campo, semilla tratada, poscosecha e instalación con sus propios campos;
// cantidades por hectárea, por peso del lote o totales; uso autorizado siempre pendiente (no comprobado); evaluación
// posterior programada y registrada.
const test = require('node:test')
const assert = require('node:assert')
const { memoryStore } = require('../../src/services/cuaderno/store')
const cuentas = require('../../src/services/cuaderno/cuentas')
const explotacion = require('../../src/services/cuaderno/explotacion')
const { calcularTratamiento } = require('../../src/services/cuaderno/fitosanitarios')
const { redondear } = require('../../src/services/cuaderno/fertilizacion')

const square = (x, y, d) => ({ type: 'Polygon', coordinates: [[[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]]] })
const fuente = async () => ({
  municipio: { ine: '37022', catastro: '37022', nombre: 'Aldeaseca' }, campaña: 2026, fuente: { datos: 'SIGPAC 2026' },
  features: [{ type: 'Feature', geometry: square(-5.2, 40.94, 0.003), properties: { agr: 0, zona: 0, pol: 501, par: 77, rec: 1, uso: 'TA', sup: 60000, reg: 0, cat: null } }]
})

async function setup(now = () => new Date('2026-05-20T10:00:00Z')) {
  const store = memoryStore()
  const cu = cuentas.createService(store, { now })
  const ex = explotacion.createService(store, { now, fuenteSigpac: fuente })
  await cu.registrar({ email: 'ana@ejemplo.es', password: 'una-clave-larga', nombre: 'Ana' })
  const ana = (await cu.entrar({ email: 'ana@ejemplo.es', password: 'una-clave-larga' })).usuario
  const e = await ex.crearExplotacion(ana, { nombre: 'Finca' })
  const r = await ex.guardarRecinto(ana, e._id, { ine: '37022', ref: { pol: 501, par: 77, rec: 1 } })
  const c = await ex.crearCultivo(ana, e._id, { campaña: 2026, especie: 'Trigo', unidades: [{ recintoId: r._id }] })
  return { ex, ana, e, c }
}
const producto = { nombre: 'Herbicida X', registro: 'ES-00000' }
const aplicador = { nombre: 'Ana', carne: 'CU-1234' }

test('cantidades: L/ha × superficie, mL/100kg × lote, total; dosis por hectárea sin superficie → pendiente', () => {
  const campo = calcularTratamiento({ subtipo: 'campo', imputaciones: [{ superficie: { valor: 51000 } }], lineas: [{ producto, dosis: { valor: 1.5, unidad: 'L/ha' } }] })
  assert.strictEqual(redondear(campo.lineas[0].cantidad.valor, 3), 7.65)
  const semilla = calcularTratamiento({ subtipo: 'semilla', lote: { cantidad: { valor: 2000, unidad: 'kg' } }, lineas: [{ producto, dosis: { valor: 150, unidad: 'mL/100kg' } }] })
  assert.strictEqual(redondear(semilla.lineas[0].cantidad.valor, 3), 3, '150 mL/100 kg × 2000 kg = 3 L')
  const nave = calcularTratamiento({ subtipo: 'instalacion', lineas: [{ producto, dosis: { valor: 500, unidad: 'mL' } }] })
  assert.strictEqual(nave.lineas[0].cantidad.valor, 0.5)
  const mal = calcularTratamiento({ subtipo: 'poscosecha', lote: { cantidad: { valor: 10, unidad: 't' } }, lineas: [{ producto, dosis: { valor: 1, unidad: 'L/ha' } }] })
  assert.strictEqual(mal.lineas[0].cantidad.valor, null)
  assert.ok(mal.pendientes.some(p => /sin superficie/.test(p.motivo)))
  // El uso autorizado nunca se da por comprobado
  assert.ok(campo.pendientes.some(p => p.campo === 'lineas[0].usoAutorizado' && p.regla.estado === 'pendiente de revisión'))
})

test('tratamiento en campo: confirmado con sus campos y en el cuaderno con el ámbito superficie', async () => {
  const { ex, ana, e, c } = await setup()
  const op = await ex.crearOperacion(ana, e._id, {
    tipo: 'fitosanitario', estado: 'confirmado', fechaEfectiva: '2026-04-10',
    fito: { subtipo: 'campo', problema: 'Malas hierbas de hoja ancha', justificacion: 'Infestación observada', hora: '9:30', aplicador, equipo: { nombre: 'Pulverizador 1', inscripcion: 'ROMA-1' }, asesor: { nombre: 'Luis', numero: 'AS-9' }, evaluacion: { programada: '2026-05-10' } },
    imputaciones: [{ cultivoId: c._id, superficie: { metodo: 'declarada', valor: 51000 } }],
    lineas: [{ producto, dosis: { valor: 1.5, unidad: 'L/ha' } }]
  })
  assert.strictEqual(op.estado, 'confirmado')
  assert.strictEqual(op.fito.hora, '09:30')
  assert.strictEqual(redondear(op.derivados.lineas[0].cantidad.valor, 3), 7.65)
  assert.ok(op.pendientes.some(p => p.campo === 'lineas[0].usoAutorizado'), 'uso autorizado: pendiente aunque esté confirmado')
  const cu = await ex.cuaderno(ana, e._id, { campaña: 2026 })
  assert.strictEqual(cu.tratamientos.length, 1)
  assert.strictEqual(cu.tratamientos[0].ambito, 'superficie')
  assert.strictEqual(cu.tratamientos[0].registro, 'ES-00000')
  assert.strictEqual(cu.filas.length, 0, 'no se mezcla con el abonado')
  // Evaluación prevista el 10/05 y hoy es el 20/05: vencida en la bandeja
  assert.ok(cu.bandeja.some(b => b.tipo === 'vencimiento'))
  const ev = await ex.registrarEvaluacion(ana, e._id, op._id, { fecha: '2026-05-15', eficacia: 'buena', observaciones: 'Control > 90 %' })
  assert.strictEqual(ev.version, 2)
  assert.strictEqual(ev.fito.evaluacion.realizada.eficacia, 'buena')
  assert.strictEqual(ev.versiones[0].fito.evaluacion.realizada, null)
  assert.ok(!(await ex.cuaderno(ana, e._id, { campaña: 2026 })).bandeja.some(b => b.tipo === 'vencimiento'))
})

test('semilla tratada, poscosecha e instalación: sin superficie, con su lote o instalación', async () => {
  const { ex, ana, e, c } = await setup()
  const semilla = await ex.crearOperacion(ana, e._id, {
    tipo: 'fitosanitario', estado: 'confirmado', fechaEfectiva: '2026-03-01', campaña: 2026,
    fito: { subtipo: 'semilla', problema: 'Caries del trigo', aplicador, lote: { descripcion: 'Semilla de trigo', identificador: 'L-23', cantidad: { valor: 2000, unidad: 'kg' } } },
    lineas: [{ producto, dosis: { valor: 150, unidad: 'mL/100kg' } }]
  })
  assert.strictEqual(semilla.estado, 'confirmado')
  assert.strictEqual(semilla.campaña, 2026)
  assert.strictEqual(redondear(semilla.derivados.lineas[0].cantidad.valor, 3), 3)
  const pos = await ex.crearOperacion(ana, e._id, {
    tipo: 'fitosanitario', estado: 'confirmado', fechaEfectiva: '2026-08-01', campaña: 2026,
    fito: { subtipo: 'poscosecha', problema: 'Gorgojo', aplicador, lote: { descripcion: 'Trigo cosechado', identificador: 'C-2026-1', cantidad: { valor: 30, unidad: 't' } } },
    lineas: [{ producto, dosis: { valor: 2, unidad: 'mL/t' } }]
  })
  assert.strictEqual(pos.derivados.superficieTratada, null, 'sin superficie, explícito')
  assert.strictEqual(redondear(pos.derivados.lineas[0].cantidad.valor, 4), 0.06)
  const nave = await ex.crearOperacion(ana, e._id, {
    tipo: 'fitosanitario', estado: 'confirmado', fechaEfectiva: '2026-07-01', campaña: 2026,
    fito: { subtipo: 'instalacion', problema: 'Insectos de almacén', aplicador, instalacion: { nombre: 'Nave 1', tipo: 'almacén de grano' } },
    lineas: [{ producto, dosis: { valor: 0.5, unidad: 'L' } }]
  })
  assert.strictEqual(nave.estado, 'confirmado')
  // Una poscosecha con recintos se rechaza
  await assert.rejects(ex.crearOperacion(ana, e._id, { tipo: 'fitosanitario', fito: { subtipo: 'poscosecha' }, imputaciones: [{ cultivoId: c._id }], lineas: [] }), /no lleva superficie/)
  // Sin lote: borrador con el pendiente propio del supuesto
  const sinLote = await ex.crearOperacion(ana, e._id, { tipo: 'fitosanitario', estado: 'confirmado', fechaEfectiva: '2026-08-02', fito: { subtipo: 'poscosecha', problema: 'Gorgojo', aplicador }, lineas: [{ producto, dosis: { valor: 2, unidad: 'mL/t' } }] })
  assert.strictEqual(sinLote.estado, 'borrador')
  assert.ok(sinLote.pendientes.some(p => p.campo === 'fito.lote'))
  const cu = await ex.cuaderno(ana, e._id, { campaña: 2026 })
  assert.deepStrictEqual(cu.tratamientos.map(t => t.ambito).sort(), ['instalacion', 'lote', 'lote'])
  assert.ok(cu.tratamientos.some(t => t.donde === 'Nave 1'))
})
