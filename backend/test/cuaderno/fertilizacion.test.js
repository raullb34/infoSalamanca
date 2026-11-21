// Cuaderno: cálculo de un abonado a partir de datos confirmados (services/cuaderno/fertilizacion).
// El ejemplo del plan: 5,10 ha a 180 kg/ha = 918 kg; con riqueza del 15 % → 137,7 kg de N, P2O5 y K2O.
const test = require('node:test')
const assert = require('node:assert')
const { calcularLinea, calcularAbonado, redondear } = require('../../src/services/cuaderno/fertilizacion')

const NPK15 = { nombre: 'NPK 15-15-15', tipo: 'mineral', composicion: { N: 15, P2O5: 15, K2O: 15 } }

test('5,10 ha a 180 kg/ha: 918 kg de producto y 137,7 kg de cada nutriente', () => {
  const r = calcularLinea({ producto: NPK15, dosis: { valor: 180, unidad: 'kg/ha' } }, 51000)
  assert.strictEqual(redondear(r.cantidad.valor, 3), 918)
  assert.strictEqual(r.cantidad.unidad, 'kg')
  assert.strictEqual(redondear(r.nutrientes.N.valor, 3), 137.7)
  assert.strictEqual(redondear(r.nutrientes.P2O5.valor, 3), 137.7)
  assert.strictEqual(redondear(r.nutrientes.K2O.valor, 3), 137.7)
  assert.deepStrictEqual(r.pendientes, [])
  assert.strictEqual(r.nutrientes.N.procedencia, 'calculado')
})

test('una dosis en litros sin densidad deja la masa y los nutrientes como desconocidos (pendiente visible)', () => {
  const r = calcularLinea({ producto: { nombre: 'Purín', tipo: 'organico', composicion: { N: 0.4 } }, dosis: { valor: 30000, unidad: 'L/ha' } }, 10000)
  assert.strictEqual(r.cantidad.valor, 30000)
  assert.strictEqual(r.cantidad.unidad, 'L')
  assert.strictEqual(r.masa, null)
  assert.strictEqual(r.nutrientes.N.valor, null)
  assert.ok(r.pendientes.some(p => p.campo === 'producto.densidad'))
  // Con la densidad, se calcula
  const r2 = calcularLinea({ producto: { nombre: 'Purín', composicion: { N: 0.4 }, densidad: { valor: 1.05, unidad: 'kg/L' } }, dosis: { valor: 30000, unidad: 'L/ha' } }, 10000)
  assert.strictEqual(redondear(r2.masa.valor, 3), 31500)
  assert.strictEqual(redondear(r2.nutrientes.N.valor, 3), 126)
})

test('riqueza desconocida → nutriente desconocido, no cero; unidad incompatible → pendiente', () => {
  const r = calcularLinea({ producto: { nombre: 'Abono sin etiqueta', composicion: { N: 20 } }, dosis: { valor: 200, unidad: 'kg/ha' } }, 20000)
  assert.strictEqual(redondear(r.nutrientes.N.valor, 3), 80)
  assert.strictEqual(r.nutrientes.P2O5.valor, null)
  assert.ok(r.pendientes.some(p => p.campo === 'producto.composicion.P2O5'))
  const raro = calcularLinea({ producto: NPK15, dosis: { valor: 3, unidad: 'sacos/ha' } }, 10000)
  assert.strictEqual(raro.cantidad.valor, null)
  assert.ok(raro.pendientes.some(p => p.campo === 'dosis.unidad'))
})

test('un parte con varias imputaciones suma superficies ejecutadas y cantidades; excluir una franja cambia todo', () => {
  const base = { lineas: [{ producto: NPK15, dosis: { valor: 180, unidad: 'kg/ha' } }] }
  const a = calcularAbonado({ ...base, imputaciones: [{ superficie: { valor: 30000 } }, { superficie: { valor: 21000 } }] })
  assert.strictEqual(redondear(a.superficieEjecutada.valor, 3), 51000)
  assert.strictEqual(redondear(a.lineas[0].cantidad.valor, 3), 918)
  assert.strictEqual(redondear(a.totales.N.valor, 3), 137.7)
  // Excluir una franja de 0,5 ha en la segunda imputación
  const b = calcularAbonado({ ...base, imputaciones: [{ superficie: { valor: 30000 } }, { superficie: { valor: 16000 } }] })
  assert.strictEqual(redondear(b.lineas[0].cantidad.valor, 3), 828)
  assert.strictEqual(redondear(b.totales.N.valor, 3), 124.2)
})

test('una dosis total (kg) no depende de la superficie', () => {
  const r = calcularLinea({ producto: NPK15, dosis: { valor: 500, unidad: 'kg' } }, 51000)
  assert.strictEqual(r.cantidad.valor, 500)
  assert.strictEqual(redondear(r.nutrientes.K2O.valor, 3), 75)
})
