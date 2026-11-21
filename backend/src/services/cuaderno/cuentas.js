// Cuentas de usuario del área privada «Mi explotación». La web no tenía usuarios (solo la clave del panel).
//  - Contraseña con scrypt y sal propia; nunca se guarda ni se devuelve en claro.
//  - Sesión: un token aleatorio que va en una cookie httpOnly; en la base solo se guarda su hash (sha256), con
//    caducidad (30 días).
// No hace falta ninguna credencial de la Junta: cualquiera puede crear su cuenta y su explotación con datos propios.
const crypto = require('crypto')
const { promisify } = require('util')

const scrypt = promisify(crypto.scrypt)
const SESSION_DAYS = 30
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const sha = (t) => crypto.createHash('sha256').update(String(t)).digest('hex')
const publicUser = (u) => (u ? { id: u._id, email: u.email, nombre: u.nombre } : null)

function createService(store, { now = () => new Date() } = {}) {
  async function hashPassword(password) {
    const salt = crypto.randomBytes(16)
    const key = await scrypt(password, salt, 64)
    return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`
  }
  async function checkPassword(password, stored) {
    const [, salt, key] = String(stored).split('$')
    if (!salt || !key) return false
    const got = await scrypt(password, Buffer.from(salt, 'base64'), 64)
    const want = Buffer.from(key, 'base64')
    return got.length === want.length && crypto.timingSafeEqual(got, want)
  }

  async function registrar({ email, password, nombre }) {
    const e = String(email || '').trim().toLowerCase()
    if (!EMAIL_RE.test(e)) throw Object.assign(new Error('El correo no parece válido'), { status: 400 })
    if (String(password || '').length < 10) throw Object.assign(new Error('La contraseña tiene que tener al menos 10 caracteres'), { status: 400 })
    if ((await store.find('usuarios', { email: e })).length) throw Object.assign(new Error('Ya hay una cuenta con ese correo'), { status: 409 })
    const u = await store.insert('usuarios', { email: e, nombre: String(nombre || '').trim().slice(0, 80) || e.split('@')[0], hash: await hashPassword(password), creado: now().toISOString() })
    return publicUser(u)
  }

  // → { token, usuario } o error
  async function entrar({ email, password }) {
    const [u] = await store.find('usuarios', { email: String(email || '').trim().toLowerCase() })
    // Misma respuesta si no existe o si la contraseña no vale (no se revela qué correos tienen cuenta)
    if (!u || !(await checkPassword(String(password || ''), u.hash))) throw Object.assign(new Error('Correo o contraseña incorrectos'), { status: 401 })
    const token = crypto.randomBytes(32).toString('base64url')
    await store.insert('sesiones', { hash: sha(token), userId: u._id, creada: now().toISOString(), caduca: new Date(now().getTime() + SESSION_DAYS * 86400e3) })
    return { token, usuario: publicUser(u) }
  }

  async function usuarioDeSesion(token) {
    if (!token) return null
    const [s] = await store.find('sesiones', { hash: sha(token) })
    if (!s || new Date(s.caduca) < now()) return null
    return publicUser(await store.get('usuarios', s.userId))
  }

  async function salir(token) {
    const [s] = token ? await store.find('sesiones', { hash: sha(token) }) : []
    if (s) await store.remove('sesiones', s._id)
  }

  return { registrar, entrar, usuarioDeSesion, salir, SESSION_DAYS }
}

module.exports = { createService }
