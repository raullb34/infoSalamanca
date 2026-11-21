// Formas de entrar (services/cuaderno/cuentas.js y federado.js): huella (llave de acceso), Google, Facebook,
// contraseña; unir cuentas solo con correo verificado; código de persona para añadirla a una explotación.
// La huella se prueba con un autenticador de software (firma ES256 como un teléfono, atestación «none»).
const test = require('node:test')
const assert = require('node:assert')
const crypto = require('crypto')
const { memoryStore } = require('../../src/services/cuaderno/store')
const cuentas = require('../../src/services/cuaderno/cuentas')
const explotacion = require('../../src/services/cuaderno/explotacion')
const { verificarGoogle, verificarFacebook } = require('../../src/services/cuaderno/federado')

const RP = 'campo.ejemplo.es'
const ORIGIN = `https://${RP}`
const webauthn = { rpID: RP, origins: [ORIGIN] }

// ---------- CBOR mínimo (lo justo para la atestación) ----------
function cbor(v) {
  const head = (major, n) => {
    if (n < 24) return Buffer.from([(major << 5) | n])
    if (n < 256) return Buffer.from([(major << 5) | 24, n])
    if (n < 65536) { const b = Buffer.alloc(3); b[0] = (major << 5) | 25; b.writeUInt16BE(n, 1); return b }
    const b = Buffer.alloc(5); b[0] = (major << 5) | 26; b.writeUInt32BE(n, 1); return b
  }
  if (typeof v === 'number') return v >= 0 ? head(0, v) : head(1, -1 - v)
  if (typeof v === 'string') { const b = Buffer.from(v, 'utf8'); return Buffer.concat([head(3, b.length), b]) }
  if (Buffer.isBuffer(v)) return Buffer.concat([head(2, v.length), v])
  if (v instanceof Map) return Buffer.concat([head(5, v.size), ...[...v].flatMap(([k, x]) => [cbor(k), cbor(x)])])
  throw new Error('cbor: tipo no admitido')
}

// Un «teléfono» con una llave ES256
function telefono({ rpID = RP, origin = ORIGIN, uv = true } = {}) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const jwk = publicKey.export({ format: 'jwk' })
  const credId = crypto.randomBytes(16)
  let counter = 0
  let org = origin
  const rpHash = crypto.createHash('sha256').update(rpID).digest()
  const flags = (at) => (0x01 | (uv ? 0x04 : 0) | (at ? 0x40 : 0))
  const cnt = () => { const b = Buffer.alloc(4); b.writeUInt32BE(counter); return b }
  const clientData = (type, challenge) => Buffer.from(JSON.stringify({ type, challenge, origin: org, crossOrigin: false }))
  return {
    credId: credId.toString('base64url'),
    desde(o) { org = o; return this },
    crear(opciones) {
      const cose = cbor(new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]))
      const idLen = Buffer.alloc(2); idLen.writeUInt16BE(credId.length)
      const authData = Buffer.concat([rpHash, Buffer.from([flags(true)]), cnt(), Buffer.alloc(16), idLen, credId, cose])
      const att = cbor(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]))
      return {
        id: credId.toString('base64url'), rawId: credId.toString('base64url'), type: 'public-key', clientExtensionResults: {},
        response: { clientDataJSON: clientData('webauthn.create', opciones.challenge).toString('base64url'), attestationObject: att.toString('base64url'), transports: ['internal'] }
      }
    },
    firmar(opciones) {
      counter++
      const authData = Buffer.concat([rpHash, Buffer.from([flags(false)]), cnt()])
      const cd = clientData('webauthn.get', opciones.challenge)
      const sig = crypto.sign('sha256', Buffer.concat([authData, crypto.createHash('sha256').update(cd).digest()]), privateKey)
      return {
        id: credId.toString('base64url'), rawId: credId.toString('base64url'), type: 'public-key', clientExtensionResults: {},
        response: { clientDataJSON: cd.toString('base64url'), authenticatorData: authData.toString('base64url'), signature: sig.toString('base64url'), userHandle: null }
      }
    }
  }
}

function servicio(opts = {}) {
  const store = memoryStore()
  return { store, cu: cuentas.createService(store, { webauthn, ...opts }) }
}

test('huella: crear la cuenta solo con el nombre, entrar otra vez, y sin trampas', async () => {
  const { store, cu } = servicio()
  const tel = telefono()
  await assert.rejects(cu.opcionesLlave({ nombre: ' ' }), /Escribe tu nombre/)
  const { retoId, opciones } = await cu.opcionesLlave({ nombre: 'Pepe  García' })
  assert.strictEqual(opciones.authenticatorSelection.userVerification, 'required')
  assert.strictEqual(opciones.rp.id, RP)
  const r = await cu.crearLlave({ retoId, respuesta: tel.crear(opciones), dispositivo: 'Android' })
  assert.ok(r.token)
  assert.strictEqual(r.usuario.nombre, 'Pepe García')
  assert.strictEqual(r.usuario.email, null)
  assert.match(r.usuario.codigo, /^[A-HJ-KM-NP-Z2-9]{6}$/)
  assert.strictEqual((await cu.usuarioDeSesion(r.token)).id, r.usuario.id)
  // El reto vale una vez
  await assert.rejects(cu.crearLlave({ retoId, respuesta: tel.crear(opciones) }), /demasiado tiempo/)

  // Entrar con la huella (sin escribir nada): la llave dice quién es
  const e = await cu.opcionesEntrarLlave()
  assert.deepStrictEqual(e.opciones.allowCredentials, [])
  const s = await cu.entrarConLlave({ retoId: e.retoId, respuesta: tel.firmar(e.opciones) })
  assert.strictEqual(s.usuario.id, r.usuario.id)
  assert.strictEqual((await store.find('llaves', { userId: r.usuario.id }))[0].counter, 1)

  // Otra web (otro origen) no puede usar la llave
  const e2 = await cu.opcionesEntrarLlave()
  await assert.rejects(cu.entrarConLlave({ retoId: e2.retoId, respuesta: tel.desde('https://phishing.ejemplo.com').firmar(e2.opciones) }), /comprobar la huella/)
  tel.desde(ORIGIN)
  // Sin comprobar la huella (solo tocar) no vale
  const sinUv = telefono({ uv: false })
  const o3 = await cu.opcionesLlave({ nombre: 'Luis' })
  await assert.rejects(cu.crearLlave({ retoId: o3.retoId, respuesta: sinUv.crear(o3.opciones) }), /no ha podido guardar/)
  // Una huella que no es de aquí
  const e4 = await cu.opcionesEntrarLlave()
  await assert.rejects(cu.entrarConLlave({ retoId: e4.retoId, respuesta: telefono().firmar(e4.opciones) }), /no está guardada/)
  // Una firma vieja repetida (mismo contador) tampoco
  const e5 = await cu.opcionesEntrarLlave()
  const firma = tel.firmar(e5.opciones)
  await cu.entrarConLlave({ retoId: e5.retoId, respuesta: firma })
  const e6 = await cu.opcionesEntrarLlave()
  await assert.rejects(cu.entrarConLlave({ retoId: e6.retoId, respuesta: { ...firma } }), (err) => err.status === 401)
})

test('huella: añadirla a una cuenta que ya existe y no quitar la única forma de entrar', async () => {
  const { cu } = servicio()
  const ana = await cu.registrar({ email: 'ana@ejemplo.es', password: 'una-clave-larga', nombre: 'Ana' })
  const tel = telefono()
  const { retoId, opciones } = await cu.opcionesLlave({}, ana)
  const r = await cu.crearLlave({ retoId, respuesta: tel.crear(opciones) }, ana)
  assert.strictEqual(r.token, undefined, 'desde dentro no abre otra sesión')
  const p = await cu.perfil(ana)
  assert.deepStrictEqual(p.formas, ['contraseña', 'huella'])
  // La misma llave no se guarda dos veces
  const o2 = await cu.opcionesLlave({}, ana)
  assert.strictEqual(o2.opciones.excludeCredentials.length, 1)
  // Solo huella → no se puede quitar
  const { cu: cu2 } = servicio()
  const o = await cu2.opcionesLlave({ nombre: 'Pepe' })
  const pepe = (await cu2.crearLlave({ retoId: o.retoId, respuesta: telefono().crear(o.opciones) })).usuario
  const [llave] = (await cu2.perfil(pepe)).llaves
  await assert.rejects(cu2.quitarLlave(pepe, llave.id), /única forma/)
  assert.ok((await cu.quitarLlave(ana, p.llaves[0].id)).formas.length === 1)
})

test('Google: cuenta nueva, misma cuenta después, y unir con correo verificado', async () => {
  const perfiles = { a: { id: 'g-1', email: 'ana@ejemplo.es', emailVerificado: true, nombre: 'Ana' } }
  const { cu } = servicio({ verificar: { google: async (t) => perfiles[t] } })
  const r1 = await cu.entrarConGoogle('a')
  const r2 = await cu.entrarConGoogle('a')
  assert.strictEqual(r1.usuario.id, r2.usuario.id)
  assert.strictEqual(r1.usuario.email, 'ana@ejemplo.es')
  // Facebook no está configurado: lo dice claro
  await assert.rejects(cu.entrarConFacebook('x'), (err) => err.status === 501)
})

test('Google: quien demuestra el correo se queda con la cuenta (no hay secuestro previo)', async () => {
  const { store, cu } = servicio({ verificar: { google: async () => ({ id: 'g-9', email: 'luis@ejemplo.es', emailVerificado: true, nombre: 'Luis' }) } })
  // Alguien crea antes una cuenta con el correo de Luis y su contraseña
  await cu.registrar({ email: 'luis@ejemplo.es', password: 'clave-del-intruso', nombre: 'Intruso' })
  const intruso = await cu.entrar({ email: 'luis@ejemplo.es', password: 'clave-del-intruso' })
  const luis = await cu.entrarConGoogle('t')
  assert.strictEqual(luis.usuario.id, intruso.usuario.id, 'es la cuenta de ese correo')
  assert.strictEqual(await cu.usuarioDeSesion(intruso.token), null, 'la sesión del intruso se cierra')
  await assert.rejects(cu.entrar({ email: 'luis@ejemplo.es', password: 'clave-del-intruso' }), (err) => err.status === 401)
  assert.ok((await store.get('usuarios', luis.usuario.id)).emailVerificado)
})

test('Facebook: no une por correo (no está garantizado que esté verificado)', async () => {
  const { cu } = servicio({ verificar: { facebook: async () => ({ id: 'f-1', email: 'ana@ejemplo.es', emailVerificado: false, nombre: 'Ana F' }) } })
  const ana = await cu.registrar({ email: 'ana@ejemplo.es', password: 'una-clave-larga', nombre: 'Ana' })
  const fb = await cu.entrarConFacebook('t')
  assert.notStrictEqual(fb.usuario.id, ana.id)
  assert.strictEqual(fb.usuario.email, null)
  // Desde dentro sí se puede añadir Facebook a la cuenta de Ana… pero esa cuenta de Facebook ya es de otra
  await assert.rejects(cu.entrarConFacebook('t', { actual: ana }), (err) => err.status === 409)
})

test('código de persona: añadirla a una explotación sin su correo', async () => {
  const { store, cu } = servicio()
  const ex = explotacion.createService(store, { fuenteSigpac: async () => null })
  const ana = await cu.registrar({ email: 'ana@ejemplo.es', password: 'una-clave-larga', nombre: 'Ana' })
  const o = await cu.opcionesLlave({ nombre: 'Pepe' })
  const pepe = (await cu.crearLlave({ retoId: o.retoId, respuesta: telefono().crear(o.opciones) })).usuario
  const e = await ex.crearExplotacion(ana, { nombre: 'Finca' })
  const dictado = `${pepe.codigo.slice(0, 3).toLowerCase()} ${pepe.codigo.slice(3)}`
  const r = await ex.ponerMiembro(ana, e._id, { persona: dictado, roles: ['ejecutor'] })
  assert.ok(r.miembros.some(m => m.userId === pepe.id && m.roles.includes('ejecutor')))
  await assert.rejects(ex.ponerMiembro(ana, e._id, { persona: 'ZZZ ZZZ', roles: ['asesor'] }), (err) => err.status === 404)
})

test('verificarGoogle: firma, destinatario y caducidad', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256' }
  const t0 = Date.parse('2026-11-21T10:00:00Z')
  const firmar = (payload, key = privateKey) => {
    const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' })).toString('base64url')
    const p = Buffer.from(JSON.stringify(payload)).toString('base64url')
    return `${h}.${p}.${crypto.sign('RSA-SHA256', Buffer.from(`${h}.${p}`), key).toString('base64url')}`
  }
  const base = { iss: 'https://accounts.google.com', aud: 'mi-cliente', sub: '123', email: 'Ana@Ejemplo.es', email_verified: true, given_name: 'Ana', exp: t0 / 1000 + 600 }
  const opts = { clientId: 'mi-cliente', getKeys: async () => [jwk], now: () => t0 }
  assert.deepStrictEqual(await verificarGoogle(firmar(base), opts), { id: '123', email: 'ana@ejemplo.es', emailVerificado: true, nombre: 'Ana' })
  await assert.rejects(verificarGoogle(firmar({ ...base, aud: 'otra-web' }), opts), (e) => e.status === 401)
  await assert.rejects(verificarGoogle(firmar({ ...base, exp: t0 / 1000 - 3600 }), opts), /demasiado tiempo/)
  const otra = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
  await assert.rejects(verificarGoogle(firmar(base, otra), opts), (e) => e.status === 401)
  await assert.rejects(verificarGoogle(firmar(base), { ...opts, clientId: null }), (e) => e.status === 501)
})

test('verificarFacebook: el token tiene que ser de nuestra aplicación', async () => {
  const http = (dbg) => ({
    async get(url, { params }) {
      if (url.endsWith('/debug_token')) return { data: { data: dbg } }
      assert.ok(params.appsecret_proof, 'se manda la prueba del secreto')
      return { data: { id: '77', first_name: 'Pepe', email: 'pepe@ejemplo.es' } }
    }
  })
  const opts = { appId: '555', appSecret: 's3cr3t' }
  const ok = await verificarFacebook('tok', { ...opts, http: http({ is_valid: true, app_id: '555', user_id: '77' }) })
  assert.deepStrictEqual(ok, { id: '77', email: 'pepe@ejemplo.es', emailVerificado: false, nombre: 'Pepe' })
  await assert.rejects(verificarFacebook('tok', { ...opts, http: http({ is_valid: true, app_id: '999', user_id: '77' }) }), (e) => e.status === 401)
  await assert.rejects(verificarFacebook('tok', { ...opts, http: http({ is_valid: false }) }), (e) => e.status === 401)
})
