// Aportaciones de la gente (services/contributions): qué se acepta, el campo trampa, los repetidos, los carteles
// que pasan a la cola de Carteles y la revisión (que borra el correo). Sin base de datos.
const test = require('node:test')
const assert = require('node:assert')
const { createService, memoryRepo, _test: { validate } } = require('../../src/services/contributions')

const base = { tipo: 'pueblo', cod_ine: '37327', municipio: 'Torresmenudas', relacion: 'vecino', mensaje: 'Las fiestas son el 18 de noviembre, no en abril.' }

test('se guarda pendiente lo que tiene sentido; lo demás vuelve con el motivo', async () => {
  const repo = memoryRepo()
  const svc = createService(repo)
  assert.deepStrictEqual((await svc.submit(base)).ok, true)
  assert.strictEqual(repo.rows.length, 1)
  assert.strictEqual(repo.rows[0].estado, 'pendiente')
  assert.strictEqual((await svc.submit({ ...base, mensaje: 'hola' })).status, 400, 'demasiado corto y sin enlace')
  assert.match(validate({ ...base, enlace: 'javascript:alert(1)' }).error, /dirección web/)
  assert.match(validate({ ...base, email: 'no-es-correo' }).error, /correo/)
  assert.strictEqual(validate({ ...base, tipo: 'raro', relacion: 'jefe', cod_ine: '1' }).value.tipo, 'otro')
  assert.strictEqual(validate({ ...base, cod_ine: '1' }).value.cod_ine, null)
})

test('el campo trampa y los repetidos contestan bien pero no guardan', async () => {
  const repo = memoryRepo()
  const svc = createService(repo)
  assert.ok((await svc.submit({ ...base, web: 'http://spam.example' })).ok)
  assert.strictEqual(repo.rows.length, 0)
  await svc.submit(base)
  await svc.submit(base)
  assert.strictEqual(repo.rows.length, 1)
})

test('un cartel de fiestas con enlace se propone también en Carteles', async () => {
  const proposed = []
  const repo = memoryRepo()
  const svc = createService(repo, { proposePoster: async (c) => { proposed.push(c.enlace); return true } })
  await svc.submit({ ...base, tipo: 'fiesta', mensaje: 'El cartel de este año', enlace: 'https://www.facebook.com/ayto/posts/1' })
  assert.deepStrictEqual(proposed, ['https://www.facebook.com/ayto/posts/1'])
  assert.strictEqual(repo.rows[0].cartel, true)
})

test('al revisarla se borra el correo', async () => {
  const repo = memoryRepo()
  const svc = createService(repo)
  await svc.submit({ ...base, email: 'Vecina@Ejemplo.es' })
  assert.strictEqual(repo.rows[0].email, 'vecina@ejemplo.es')
  const done = await svc.review(repo.rows[0]._id, { estado: 'aplicada', nota: 'Cambiado' })
  assert.strictEqual(done.email, null)
  assert.strictEqual(done.estado, 'aplicada')
  assert.strictEqual(await svc.count(), 0)
  await assert.rejects(svc.review(repo.rows[0]._id, { estado: 'borrada' }))
})
