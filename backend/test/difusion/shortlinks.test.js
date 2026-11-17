// Enlaces cortos del canal de WhatsApp (services/shortLinks): siempre el mismo código para la misma dirección,
// solo se redirige a lo acortado aquí, los de la propia web no se tocan y se cuentan los clics. Sin base de datos.
const test = require('node:test')
const assert = require('node:assert')
const { createService, memoryRepo } = require('../../src/services/shortLinks')

const base = () => 'https://ejemplo.test'
const LONG = 'https://comunicacion.usal.es/convocatoria/facultad-psicologia-acoge-conferencia-interuniversitaria-sobre-impacto-emocional-del'

test('acorta: corto, estable y solo para direcciones web de fuera', async () => {
  const svc = createService(memoryRepo(), { base })
  const a = await svc.shorten(LONG)
  assert.match(a, /^https:\/\/ejemplo\.test\/api\/l\/[0-9a-zA-Z]{7}$/)
  assert.strictEqual(await svc.shorten(LONG), a, 'la misma dirección, el mismo código')
  assert.strictEqual(await svc.shorten('https://ejemplo.test/?pueblo=37022'), 'https://ejemplo.test/?pueblo=37022', 'los de la propia web ya son cortos')
  assert.strictEqual(await svc.shorten('javascript:alert(1)'), 'javascript:alert(1)')
})

test('redirige solo a lo acortado y cuenta los clics', async () => {
  const repo = memoryRepo()
  const svc = createService(repo, { base })
  const code = (await svc.shorten(LONG)).split('/').pop()
  assert.strictEqual(await svc.resolve(code), LONG)
  await new Promise(r => setImmediate(r))
  assert.strictEqual(repo.rows.get(code).clics, 1)
  assert.strictEqual(await svc.resolve('noexiste1'), null)
  assert.strictEqual(await svc.resolve('../../etc'), null)
})

test('el resumen sale con los enlaces acortados y el mismo contenido', async () => {
  const svc = createService(memoryRepo(), { base })
  const d = { secciones: [{ id: 's', items: [{ titulo: 'A', enlace: LONG }, { titulo: 'B', enlace: 'https://ejemplo.test/?pueblo=1' }] }], noticias: [{ titulo: 'N', enlace: LONG }] }
  const out = await svc.shortenDigest(d)
  assert.match(out.secciones[0].items[0].enlace, /\/api\/l\//)
  assert.strictEqual(out.secciones[0].items[1].enlace, 'https://ejemplo.test/?pueblo=1')
  assert.strictEqual(out.noticias[0].enlace, out.secciones[0].items[0].enlace)
  assert.strictEqual(d.secciones[0].items[0].enlace, LONG, 'el original no se toca')
})
