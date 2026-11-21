// Cuentas de usuario del área privada «Mi explotación». La web no tenía usuarios (solo la clave del panel).
//
// Formas de entrar (pensadas para quien usa poco el ordenador: sin contraseñas que recordar):
//  - Huella, cara o PIN del teléfono (llave de acceso, WebAuthn): basta con el nombre; la llave se guarda en el
//    teléfono (y se copia sola a otro teléfono con la misma cuenta de Google o de Apple). En la base solo hay la clave
//    pública. Se exige la comprobación del usuario (huella/cara/PIN), no solo tocar.
//  - Google y Facebook (federado.js comprueba el token en el servidor).
//  - Correo y contraseña (scrypt con sal propia), como antes.
// Una cuenta puede tener varias formas; se añaden desde dentro («Entrar con la huella la próxima vez»).
//
// Unir cuentas por correo: solo con un correo VERIFICADO (Google con email_verified). Si la cuenta que ya existía con
// ese correo no lo tenía verificado (contraseña, Facebook), se le quitan las demás formas de entrar y sus sesiones:
// así nadie puede crear antes una cuenta con el correo de otro y quedarse dentro cuando el dueño entre con Google.
// Facebook no garantiza correo verificado: nunca une por correo.
//
// Sesión: un token aleatorio que va en una cookie httpOnly; en la base solo se guarda su hash (sha256), 30 días.
// Cada persona tiene un código corto (p. ej. «K7P 3QM») para que la añadan a una explotación sin dar su correo.
// No hace falta ninguna credencial de la Junta.
const crypto = require('crypto')
const { promisify } = require('util')

const scrypt = promisify(crypto.scrypt)
const SESSION_DAYS = 30
const RETO_MS = 5 * 60e3
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sin 0/O, 1/I/L: se dicta por teléfono sin confusiones
const sha = (t) => crypto.createHash('sha256').update(String(t)).digest('hex')
const fail = (status, msg) => Object.assign(new Error(msg), { status })
const normCodigo = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const publicUser = (u) => (u ? { id: u._id, email: u.email || null, nombre: u.nombre, codigo: u.codigo || null } : null)
const limpiaNombre = (n) => String(n || '').trim().replace(/\s+/g, ' ').slice(0, 80)

function createService(store, { now = () => new Date(), webauthn = null, verificar = {} } = {}) {
  async function hashPassword(password) {
    const salt = crypto.randomBytes(16)
    const key = await scrypt(password, salt, 64)
    return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`
  }
  async function checkPassword(password, stored) {
    const [, salt, key] = String(stored || '').split('$')
    if (!salt || !key) {
      await scrypt(String(password), 'x', 64) // mismo tiempo de respuesta aunque no haya contraseña
      return false
    }
    const got = await scrypt(password, Buffer.from(salt, 'base64'), 64)
    const want = Buffer.from(key, 'base64')
    return got.length === want.length && crypto.timingSafeEqual(got, want)
  }

  async function nuevoCodigo() {
    for (let i = 0; i < 20; i++) {
      const c = Array.from(crypto.randomBytes(6), b => CODE_ABC[b % CODE_ABC.length]).join('')
      if (!(await store.find('usuarios', { codigo: c })).length) return c
    }
    throw fail(500, 'No se ha podido crear el código')
  }
  async function crearUsuario(datos) {
    return store.insert('usuarios', { email: null, emailVerificado: false, ...datos, codigo: await nuevoCodigo(), creado: now().toISOString() })
  }
  async function crearSesion(u) {
    const token = crypto.randomBytes(32).toString('base64url')
    await store.insert('sesiones', { hash: sha(token), userId: u._id, creada: now().toISOString(), caduca: new Date(now().getTime() + SESSION_DAYS * 86400e3) })
    return { token, usuario: publicUser(u) }
  }
  async function cerrarSesiones(userId) {
    for (const s of await store.find('sesiones', { userId })) await store.remove('sesiones', s._id)
  }

  // ---------- Correo y contraseña ----------
  async function registrar({ email, password, nombre }) {
    const e = String(email || '').trim().toLowerCase()
    if (!EMAIL_RE.test(e)) throw fail(400, 'El correo no parece válido')
    if (String(password || '').length < 10) throw fail(400, 'La contraseña tiene que tener al menos 10 caracteres')
    if ((await store.find('usuarios', { email: e })).length) throw fail(409, 'Ya hay una cuenta con ese correo')
    const u = await crearUsuario({ email: e, nombre: limpiaNombre(nombre) || e.split('@')[0], hash: await hashPassword(password) })
    return publicUser(u)
  }

  // → { token, usuario } o error
  async function entrar({ email, password }) {
    const [u] = await store.find('usuarios', { email: String(email || '').trim().toLowerCase() })
    // Misma respuesta si no existe o si la contraseña no vale (no se revela qué correos tienen cuenta)
    if (!(await checkPassword(String(password || ''), u?.hash)) || !u) throw fail(401, 'Correo o contraseña incorrectos')
    return crearSesion(u)
  }

  // ---------- Google / Facebook ----------
  // perfil: { id, email, emailVerificado, nombre } ya comprobado por federado.js
  async function entrarFederado(proveedor, perfil, { actual = null } = {}) {
    if (!['google', 'facebook'].includes(proveedor)) throw fail(400, 'Proveedor no admitido')
    const campo = `${proveedor}.id`
    const [ya] = await store.find('usuarios', { [campo]: perfil.id })
    // Desde dentro de la cuenta: añadir esta forma de entrar a la cuenta actual
    if (actual) {
      if (ya && ya._id !== actual.id) throw fail(409, `Esa cuenta de ${proveedor === 'google' ? 'Google' : 'Facebook'} ya entra en otra cuenta de infoSalamanca`)
      const u = await store.update('usuarios', actual.id, { [proveedor]: { id: perfil.id, email: perfil.email } })
      return { usuario: publicUser(u) }
    }
    if (ya) return crearSesion(ya)
    if (perfil.email && perfil.emailVerificado) {
      const [porCorreo] = await store.find('usuarios', { email: perfil.email })
      if (porCorreo) {
        const patch = { [proveedor]: { id: perfil.id, email: perfil.email }, emailVerificado: true }
        if (!porCorreo.emailVerificado) {
          // Quien demuestra el correo se queda con la cuenta: fuera las otras formas de entrar sin verificar
          Object.assign(patch, { hash: null, facebook: null })
          await cerrarSesiones(porCorreo._id)
          for (const l of await store.find('llaves', { userId: porCorreo._id })) await store.remove('llaves', l._id)
        }
        return crearSesion(await store.update('usuarios', porCorreo._id, patch))
      }
    }
    // Cuenta nueva. El correo se guarda si está libre (si no, la cuenta queda sin correo: no se une sin verificar)
    const libre = perfil.email && !(await store.find('usuarios', { email: perfil.email })).length
    const u = await crearUsuario({
      email: libre ? perfil.email : null, emailVerificado: Boolean(libre && perfil.emailVerificado),
      nombre: limpiaNombre(perfil.nombre) || (perfil.email ? perfil.email.split('@')[0] : 'Sin nombre'),
      [proveedor]: { id: perfil.id, email: perfil.email }
    })
    return crearSesion(u)
  }
  async function entrarConGoogle(credencial, opts) {
    if (!verificar.google) throw fail(501, 'Entrar con Google no está activado')
    return entrarFederado('google', await verificar.google(credencial), opts)
  }
  async function entrarConFacebook(accessToken, opts) {
    if (!verificar.facebook) throw fail(501, 'Entrar con Facebook no está activado')
    return entrarFederado('facebook', await verificar.facebook(accessToken), opts)
  }

  // ---------- Huella, cara o PIN (llaves de acceso, WebAuthn) ----------
  const wa = () => {
    if (!webauthn?.rpID) throw fail(501, 'Entrar con la huella no está activado')
    return { lib: require('@simplewebauthn/server'), ...webauthn }
  }
  async function guardarReto(datos) {
    const id = crypto.randomBytes(18).toString('base64url')
    const fin = new Date(now().getTime() + RETO_MS)
    await store.insert('retos', { _id: id, ...datos, caduca: fin.toISOString(), fin }) // `fin`: Mongo los borra solo
    return id
  }
  async function usarReto(id, tipo) {
    const r = id ? await store.get('retos', String(id)) : null
    if (r) await store.remove('retos', r._id) // un solo uso
    if (!r || r.tipo !== tipo || new Date(r.caduca) < now()) throw fail(400, 'Ha pasado demasiado tiempo: vuelve a empezar')
    return r
  }

  // Crear una llave: para una cuenta nueva (basta el nombre) o para la cuenta con la que ya se ha entrado
  async function opcionesLlave({ nombre } = {}, actual = null) {
    const { lib, rpID, rpName = 'infoSalamanca' } = wa()
    let userId, etiqueta, existentes = []
    if (actual) {
      userId = actual.id
      etiqueta = actual.email || actual.nombre
      existentes = await store.find('llaves', { userId })
    } else {
      etiqueta = limpiaNombre(nombre)
      if (etiqueta.length < 2) throw fail(400, 'Escribe tu nombre')
      userId = crypto.randomUUID()
    }
    const opciones = await lib.generateRegistrationOptions({
      rpName, rpID,
      userID: new TextEncoder().encode(userId),
      userName: etiqueta, userDisplayName: actual ? actual.nombre : etiqueta,
      attestationType: 'none',
      excludeCredentials: existentes.map(l => ({ id: l.credId, transports: l.transports })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      preferredAuthenticatorType: 'localDevice'
    })
    const retoId = await guardarReto({ tipo: 'registro', challenge: opciones.challenge, userId, nombre: actual ? null : etiqueta, nueva: !actual })
    return { retoId, opciones }
  }

  async function crearLlave({ retoId, respuesta, dispositivo } = {}, actual = null) {
    const { lib, rpID, origins } = wa()
    const reto = await usarReto(retoId, 'registro')
    if (actual ? reto.userId !== actual.id : !reto.nueva) throw fail(400, 'Ha pasado demasiado tiempo: vuelve a empezar')
    let v
    try {
      v = await lib.verifyRegistrationResponse({ response: respuesta, expectedChallenge: reto.challenge, expectedOrigin: origins, expectedRPID: rpID, requireUserVerification: true })
    } catch { throw fail(400, 'El teléfono no ha podido guardar la huella. Vuelve a intentarlo.') }
    if (!v.verified || !v.registrationInfo) throw fail(400, 'El teléfono no ha podido guardar la huella. Vuelve a intentarlo.')
    const { credential } = v.registrationInfo
    if ((await store.find('llaves', { credId: credential.id })).length) throw fail(409, 'Esta huella ya está guardada')
    let u = actual ? await store.get('usuarios', actual.id) : null
    if (!u) u = await crearUsuario({ _id: reto.userId, nombre: reto.nombre })
    await store.insert('llaves', {
      userId: u._id, credId: credential.id, publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter, transports: respuesta?.response?.transports || credential.transports || [],
      dispositivo: String(dispositivo || '').slice(0, 60) || null, creada: now().toISOString(), usada: null
    })
    return actual ? { usuario: publicUser(u) } : crearSesion(u)
  }

  async function opcionesEntrarLlave() {
    const { lib, rpID } = wa()
    const opciones = await lib.generateAuthenticationOptions({ rpID, userVerification: 'required', allowCredentials: [] })
    return { retoId: await guardarReto({ tipo: 'entrada', challenge: opciones.challenge }), opciones }
  }

  async function entrarConLlave({ retoId, respuesta } = {}) {
    const { lib, rpID, origins } = wa()
    const reto = await usarReto(retoId, 'entrada')
    const [llave] = respuesta?.id ? await store.find('llaves', { credId: String(respuesta.id) }) : []
    if (!llave) throw fail(401, 'Esta huella no está guardada en infoSalamanca. Si es la primera vez, crea tu cuenta.')
    let v
    try {
      v = await lib.verifyAuthenticationResponse({
        response: respuesta, expectedChallenge: reto.challenge, expectedOrigin: origins, expectedRPID: rpID, requireUserVerification: true,
        credential: { id: llave.credId, publicKey: new Uint8Array(Buffer.from(llave.publicKey, 'base64url')), counter: llave.counter, transports: llave.transports }
      })
    } catch { throw fail(401, 'No se ha podido comprobar la huella. Vuelve a intentarlo.') }
    if (!v.verified) throw fail(401, 'No se ha podido comprobar la huella. Vuelve a intentarlo.')
    await store.update('llaves', llave._id, { counter: v.authenticationInfo.newCounter, usada: now().toISOString() })
    const u = await store.get('usuarios', llave.userId)
    if (!u) throw fail(401, 'Esta huella no está guardada en infoSalamanca. Si es la primera vez, crea tu cuenta.')
    return crearSesion(u)
  }

  async function quitarLlave(actual, llaveId) {
    const [l] = await store.find('llaves', { _id: String(llaveId), userId: actual.id })
    if (!l) throw fail(404, 'No existe')
    const p = await perfil(actual)
    if (p.formas.length <= 1) throw fail(400, 'Es tu única forma de entrar: añade otra antes de quitarla')
    await store.remove('llaves', l._id)
    return perfil(actual)
  }

  // ---------- Sesión y perfil ----------
  async function usuarioDeSesion(token) {
    if (!token) return null
    const [s] = await store.find('sesiones', { hash: sha(token) })
    if (!s || new Date(s.caduca) < now()) return null
    return publicUser(await store.get('usuarios', s.userId))
  }

  // Cómo puede entrar esta persona (para la pantalla de la cuenta). Asigna el código a las cuentas antiguas.
  async function perfil(actual) {
    let u = await store.get('usuarios', actual.id)
    if (!u) throw fail(401, 'Entra con tu cuenta')
    if (!u.codigo) u = await store.update('usuarios', u._id, { codigo: await nuevoCodigo() })
    const llaves = (await store.find('llaves', { userId: u._id })).map(l => ({ id: l._id, dispositivo: l.dispositivo, creada: l.creada, usada: l.usada }))
    const formas = [
      ...(u.hash ? ['contraseña'] : []), ...(u.google?.id ? ['google'] : []), ...(u.facebook?.id ? ['facebook'] : []),
      ...llaves.map(() => 'huella')
    ]
    return { usuario: publicUser(u), formas, llaves, google: Boolean(u.google?.id), facebook: Boolean(u.facebook?.id), contraseña: Boolean(u.hash) }
  }

  async function salir(token) {
    const [s] = token ? await store.find('sesiones', { hash: sha(token) }) : []
    if (s) await store.remove('sesiones', s._id)
  }

  return {
    registrar, entrar, entrarFederado, entrarConGoogle, entrarConFacebook,
    opcionesLlave, crearLlave, opcionesEntrarLlave, entrarConLlave, quitarLlave,
    usuarioDeSesion, perfil, salir, SESSION_DAYS
  }
}

module.exports = { createService, normCodigo }
