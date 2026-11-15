// Difusión: suscripción con doble confirmación, baja, envío a los suscriptores y textos de WhatsApp y correo.
// Sin red ni base de datos: almacenes en memoria y nodemailer en modo "json" (construye los mensajes sin enviarlos).
process.env.MAIL_TRANSPORT = 'json'
process.env.NEWSLETTER_RESPONSABLE = 'infoSalamanca · responsable de pruebas'
process.env.PUBLIC_URL = 'https://ejemplo.test'
process.env.MAIL_DELAY_MS = '0'

const test = require('node:test')
const assert = require('node:assert')
const mailer = require('../../src/services/difusion/mailer')
const { createService, memoryRepo } = require('../../src/services/difusion/subscriptions')
const { sendIssue, memoryIssues } = require('../../src/services/difusion/sender')
const render = require('../../src/services/difusion/render')
const { select, _test: dg } = require('../../src/services/difusion/digest')

const tokenFromMail = (m) => (m.text.match(/[?&]t=([a-f0-9]+)/) || [])[1]

const DIGEST = {
  desde: '2026-11-16', hasta: '2026-11-22', url: 'https://ejemplo.test',
  secciones: [
    { id: 'espectaculos', titulo: 'Espectáculos', emoji: '🎭', items: [
      { id: 'espectaculos:1', titulo: "'Ibiza80' (FÉLIX ALBO)", fecha: '2026-11-18', hora: '19:00', pueblo: 'Sancti-Spíritus', lugar: 'Centro Cultural (Sancti-Spíritus)', enlace: 'https://ejemplo.test/?pueblo=37279' },
      { id: 'espectaculos:2', titulo: 'FESTEACO 2026', fecha: '2026-11-16', hasta: '2026-11-29', empezado: true, pueblo: 'Sancti-Spíritus', lugar: 'Centro Cultural', enlace: 'https://x' }
    ] },
    { id: 'fiestas', titulo: 'Fiestas en los pueblos', emoji: '🎉', items: [] },
    { id: 'ciencia', titulo: 'Ciencia', emoji: '🔬', items: [{ id: 'ciencia:1', titulo: 'MUY *Science* Fest', fecha: '2026-11-18', pueblo: 'Salamanca', enlace: 'https://x' }] }
  ],
  noticias: [{ id: 'noticias:a', titulo: 'La misión Euclid', resumen: 'Un mapa 3D del universo.', fecha: '2026-11-11', enlace: 'https://x' }],
  tiempo: { lugar: 'Salamanca', modelo: 'ECMWF IFS', dias: [{ fecha: '2026-11-21', max: 12.4, min: 4.2, codigo: 3 }] }
}

test('suscripción: alta pendiente, correo de confirmación y confirmar', async () => {
  mailer._test.reset()
  const repo = memoryRepo()
  const svc = createService(repo)
  const r = await svc.suscribir('  Ana@Ejemplo.ES ', { acepto: true })
  assert.ok(r.ok)
  assert.strictEqual(repo.rows[0].email, 'ana@ejemplo.es')
  assert.strictEqual(repo.rows[0].estado, 'pendiente')
  assert.ok(repo.rows[0].consentimiento.texto)
  const [mail] = mailer._test.sent()
  assert.match(mail.subject, /Confirma/)
  const token = tokenFromMail(mail)
  assert.strictEqual(token, repo.rows[0].token)
  assert.deepStrictEqual(await svc.confirmar(token), { ok: true, email: 'ana@ejemplo.es' })
  assert.strictEqual(repo.rows[0].estado, 'activo')
  assert.strictEqual(repo.rows[0].caduca, null, 'confirmada ya no caduca')
})

test('suscripción: sin aceptar o con correo mal escrito no entra; repetirla no dice si ya existía', async () => {
  mailer._test.reset()
  const repo = memoryRepo()
  const svc = createService(repo)
  assert.strictEqual((await svc.suscribir('ana@ejemplo.es', { acepto: false })).status, 400)
  assert.strictEqual((await svc.suscribir('no-es-un-correo', { acepto: true })).status, 400)
  const a = await svc.suscribir('ana@ejemplo.es', { acepto: true })
  const b = await svc.suscribir('ana@ejemplo.es', { acepto: true })
  assert.deepStrictEqual(a, b, 'misma respuesta')
  assert.strictEqual(mailer._test.sent().length, 1, 'no reenvía la confirmación enseguida')
  assert.strictEqual(repo.rows.length, 1)
})

test('baja: un clic y el enlace viejo deja de servir', async () => {
  mailer._test.reset()
  const repo = memoryRepo()
  const svc = createService(repo)
  await svc.suscribir('luis@ejemplo.es', { acepto: true })
  const token = tokenFromMail(mailer._test.sent()[0])
  await svc.confirmar(token)
  assert.ok((await svc.baja(token)).ok)
  assert.strictEqual(repo.rows[0].estado, 'baja')
  assert.ok(!(await svc.confirmar(token)).ok, 'tras la baja el token no reactiva')
})

test('envío: a cada activo, con su enlace de baja y List-Unsubscribe One-Click', async () => {
  mailer._test.reset()
  const subs = memoryRepo()
  await subs.create({ email: 'a@ejemplo.es', estado: 'activo', token: 'aaa111' })
  await subs.create({ email: 'b@ejemplo.es', estado: 'activo', token: 'bbb222' })
  await subs.create({ email: 'c@ejemplo.es', estado: 'baja', token: 'ccc333' })
  const issues = memoryIssues()
  const issue = await issues.create({ asunto: 'Agenda de prueba', intro: 'Hola' })
  const r = await sendIssue({ digest: DIGEST, issue, issues, subs, delayMs: 0 })
  assert.deepStrictEqual(r, { enviados: 2, fallidos: 0 })
  const sent = mailer._test.sent()
  assert.deepStrictEqual(sent.map(m => m.to[0].address).sort(), ['a@ejemplo.es', 'b@ejemplo.es'])
  const toA = sent.find(m => m.to[0].address === 'a@ejemplo.es')
  assert.match(toA.html, /baja\?t=aaa111/)
  assert.strictEqual(toA.headers['List-Unsubscribe'], '<https://ejemplo.test/api/newsletter/baja?t=aaa111>')
  assert.strictEqual(toA.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
  assert.strictEqual(issues.rows[0].estado, 'enviado')
  assert.strictEqual(issues.rows[0].total, 2)
})

test('WhatsApp: formato propio, sin duplicar el pueblo y sin romper la negrita', () => {
  const t = render.whatsapp(DIGEST, { intro: 'Buenos días' })
  assert.match(t, /^\*🗓️ infoSalamanca · Del 16 al 22 de noviembre\*/)
  assert.match(t, /• \*Mié 18\* · 'Ibiza80' \(FÉLIX ALBO\) _\(Sancti-Spíritus, Centro Cultural · 19:00\)_/)
  assert.match(t, /\*Hasta el 29 de noviembre\* · FESTEACO 2026/)
  assert.match(t, /MUY Science Fest/, 'los asteriscos de fuera se quitan')
  assert.ok(!/Fiestas en los pueblos/.test(t), 'las secciones vacías no salen')
  assert.match(t, /Sáb 21 ☁️ 12°\/4°/)
})

test('correo: asunto, baja, versión de texto y quitar elementos', () => {
  const e = render.email(select(DIGEST, ['ciencia:1', 'tiempo']), { intro: 'Hola', unsubscribeUrl: 'https://ejemplo.test/baja?t=x' })
  assert.strictEqual(e.subject, 'Agenda de la provincia del 16 al 22 de noviembre')
  assert.match(e.html, /https:\/\/ejemplo.test\/baja\?t=x/)
  assert.ok(!/MUY/.test(e.html) && !/El tiempo en/.test(e.html), 'lo excluido no sale')
  assert.match(e.text, /ESPECTÁCULOS/)
  assert.match(e.text, /Darte de baja: https:\/\/ejemplo.test\/baja\?t=x/)
})

test('semana: un evento que empezó antes y sigue abierto entra', () => {
  assert.ok(dg.overlaps({ fecha_inicio: '2026-10-25', fecha_fin: '2026-11-29' }, '2026-11-16', '2026-11-22'))
  assert.ok(!dg.overlaps({ fecha_inicio: '2026-11-25' }, '2026-11-16', '2026-11-22'))
  assert.strictEqual(dg.addDays('2026-11-30', 1), '2026-12-01')
})

test('cartel: PNG de 1080×1350 con el resumen de la semana', async () => {
  const { renderPoster, W, H } = require('../../src/services/difusion/poster')
  const png = await renderPoster(DIGEST)
  assert.deepStrictEqual([...png.subarray(1, 4)].map(c => String.fromCharCode(c)).join(''), 'PNG')
  assert.strictEqual(png.readUInt32BE(16), W)
  assert.strictEqual(png.readUInt32BE(20), H)
  assert.strictEqual([W, H].join('x'), '1080x1350')
})

test('cartel: se guarda con un nombre seguro y no se sirve nada fuera de su carpeta', async () => {
  const os = require('os')
  const path = require('path')
  process.env.DIFUSION_POSTER_DIR = path.join(os.tmpdir(), `carteles-${Date.now()}`)
  delete require.cache[require.resolve('../../src/services/difusion/posterStore')]
  const { savePoster, posterPath } = require('../../src/services/difusion/posterStore')
  const { file, url } = await savePoster(Buffer.from('x'), 'Agenda 2026-11-16 ../../etc')
  assert.match(file, /^[a-z0-9-]+\.png$/)
  assert.strictEqual(url, `https://ejemplo.test/api/newsletter/cartel/${file}`)
  assert.ok(posterPath(file))
  assert.strictEqual(posterPath('../secreto.png'), null)
  assert.strictEqual(posterPath('a.png/../../b'), null)
})

test('correo con cartel: arriba, enlazado y con texto alternativo', () => {
  const e = render.email(DIGEST, { posterUrl: 'https://ejemplo.test/api/newsletter/cartel/a.png' })
  assert.match(e.html, /<img src="https:\/\/ejemplo.test\/api\/newsletter\/cartel\/a.png"/)
  assert.match(e.html, /alt="Cartel de la agenda del 16 al 22 de noviembre: 2 espectáculos, 0 fiestas y 1 eventos de ciencia/)
  assert.ok(e.html.indexOf('cartel/a.png') < e.html.indexOf('🎭 Espectáculos'), 'el cartel va antes de la lista')
})
