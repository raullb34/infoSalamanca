// API del área privada «Mi explotación» y del cuaderno (services/cuaderno). El visor público no la necesita.
//
//   GET  /api/cuaderno/cuenta (quién soy y cómo puedo entrar)   GET /cuenta/formas (qué formas de entrar están activadas)
//   POST /cuenta/registro · /cuenta/entrar · /cuenta/salir       (correo y contraseña)
//   POST /cuenta/google {credencial} · /cuenta/facebook {token}   (con sesión: añade esa forma a la cuenta)
//   POST /cuenta/huella/opciones {nombre} · /cuenta/huella/crear   (crear la llave: cuenta nueva o la actual)
//   POST /cuenta/huella/entrar/opciones · /cuenta/huella/entrar     DELETE /cuenta/huella/:id
//   GET|POST /api/cuaderno/explotaciones
//   GET|POST /api/cuaderno/explotaciones/:id/recintos          PATCH …/recintos/:rid
//   GET|POST /api/cuaderno/explotaciones/:id/cultivos
//   GET|POST /api/cuaderno/explotaciones/:id/operaciones       GET …/operaciones/:opId   POST …/operaciones/:opId/rectificar
//   POST     /api/cuaderno/explotaciones/:id/operaciones/:opId/evaluacion   (eficacia de un tratamiento)
//   GET      /api/cuaderno/explotaciones/:id/cuaderno?campaña=2026   (y .csv)
//
// Sesión en cookie httpOnly (SameSite=Lax). Lo que cambia datos exige además la cabecera `X-Cuaderno: 1`, que otra web
// no puede poner sin permiso del servidor (CORS): así no se puede escribir en tu cuaderno desde otra página.
// Los permisos (de quién es cada explotación y qué papel tiene) se comprueban en el servicio, en cada petición.
const express = require('express')
const mongoose = require('mongoose')
const axios = require('axios')
const { rateLimit } = require('../middleware/rateLimit')
const { mongoStore } = require('../services/cuaderno/store')
const cuentas = require('../services/cuaderno/cuentas')
const explotacion = require('../services/cuaderno/explotacion')
const { exportarCsv } = require('../services/cuaderno/exportar')
const federado = require('../services/cuaderno/federado')


const COOKIE = 'is_cuaderno'
const PUBLIC = () => (process.env.PUBLIC_URL || 'https://infosalamanca.duckdns.org').replace(/\/$/, '')
const SIGPAC_BASE = () => (process.env.SIGPAC_DATA_URL || `${PUBLIC()}/data/sigpac`).replace(/\/$/, '')

// La cartografía SIGPAC publicada por el visor (oficial), en memoria una hora
const sigpacCache = new Map()
async function fuenteSigpac(ine) {
  const hit = sigpacCache.get(ine)
  if (hit && Date.now() - hit.at < 3600e3) return hit.data
  try {
    const { data } = await axios.get(`${SIGPAC_BASE()}/${ine}.json`, { timeout: 30000 })
    sigpacCache.set(ine, { at: Date.now(), data })
    return data
  } catch (err) {
    if (err.response?.status === 404) return null
    throw Object.assign(new Error('No se ha podido leer la cartografía SIGPAC'), { status: 502 })
  }
}

const tokenOf = (req) => (String(req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(`${COOKIE}=`)) || '').slice(COOKIE.length + 1) || null
function setCookie(req, res, token, maxAgeS) {
  const secure = req.secure || req.get('x-forwarded-proto') === 'https'
  res.append('Set-Cookie', `${COOKIE}=${token}; Path=/api/cuaderno; HttpOnly; SameSite=Lax; Max-Age=${maxAgeS}${secure ? '; Secure' : ''}`)
}

// La ruta se crea con su almacén: Mongo en el servidor; otro (memoria) para probar sin base de datos
// Huella: el dominio (rpID) y los orígenes admitidos salen de PUBLIC_URL (o WEBAUTHN_RP_ID / WEBAUTHN_ORIGINS)
function webauthnDeEntorno() {
  const pub = new URL(PUBLIC())
  return {
    rpID: process.env.WEBAUTHN_RP_ID || pub.hostname,
    origins: (process.env.WEBAUTHN_ORIGINS || pub.origin).split(',').map(x => x.trim()).filter(Boolean)
  }
}
// Google y Facebook se activan solo si están sus claves en el .env
function verificarDeEntorno() {
  const v = {}
  if (process.env.GOOGLE_CLIENT_ID) v.google = (t) => federado.verificarGoogle(t, { clientId: process.env.GOOGLE_CLIENT_ID })
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) v.facebook = (t) => federado.verificarFacebook(t, { appId: process.env.FACEBOOK_APP_ID, appSecret: process.env.FACEBOOK_APP_SECRET })
  return v
}

function createRouter({ store = null, fuente = fuenteSigpac, needsDb = true, webauthn = null, verificar = null, publicos = null } = {}) {
  const router = express.Router()
  router.use(express.json({ limit: '2mb' })) // los croquis llevan geometría

  let services = null
  async function svc() {
    if (services) return services
    const st = store || mongoStore()
    if (st.ensureIndexes) await st.ensureIndexes().catch(err => console.warn('⚠️ Cuaderno, índices:', err.message))
    services = { cuentas: cuentas.createService(st, { webauthn: webauthn || webauthnDeEntorno(), verificar: verificar || verificarDeEntorno() }), ex: explotacion.createService(st, { fuenteSigpac: fuente }) }
    return services
  }


  // Base de datos, usuario de la sesión y protección de las escrituras
  router.use(async (req, res, next) => {
    if (needsDb && mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'El cuaderno no está disponible ahora mismo' })
    res.set('Cache-Control', 'no-store') // datos privados: nada en cachés intermedias
    if (!['GET', 'HEAD'].includes(req.method) && req.get('x-cuaderno') !== '1') return res.status(403).json({ error: 'Petición no permitida' })
    try {
      req.svc = await svc()
      req.user = await req.svc.cuentas.usuarioDeSesion(tokenOf(req))
      next()
    } catch (err) { next(err) }
  })

  const h = (fn) => async (req, res) => {
    try {
      const out = await fn(req, res)
      if (out !== undefined) res.json(out)
    } catch (err) {
      if (!err.status || err.status >= 500) console.error('❌ Cuaderno:', err.message)
      res.status(err.status || 500).json({ error: err.status ? err.message : 'Error del servidor', ...(err.conflicto ? { conflicto: err.conflicto } : {}) })
    }
  }

  // ---------- Cuenta ----------
  const authLimit = rateLimit({ perMinute: 10, perDay: 100 })
  const conSesion = (req, res, { token, usuario }) => {
    setCookie(req, res, token, req.svc.cuentas.SESSION_DAYS * 86400)
    return { usuario }
  }
  // Con sesión: devuelve también cómo puede entrar (para «Entrar la próxima vez con la huella»)
  router.get('/cuenta', h(async (req) => (req.user ? req.svc.cuentas.perfil(req.user) : { usuario: null })))
  // Datos públicos para dibujar los botones (el client ID de Google y el app ID de Facebook no son secretos)
  router.get('/cuenta/formas', h(async () => {
    const p = publicos || { google: process.env.GOOGLE_CLIENT_ID || null, facebook: (process.env.FACEBOOK_APP_SECRET && process.env.FACEBOOK_APP_ID) || null }
    return { google: p.google || null, facebook: p.facebook || null, huella: true }
  }))
  router.post('/cuenta/google', authLimit, h(async (req, res) => {
    const r = await req.svc.cuentas.entrarConGoogle(req.body?.credencial, { actual: req.user })
    return r.token ? conSesion(req, res, r) : r
  }))
  router.post('/cuenta/facebook', authLimit, h(async (req, res) => {
    const r = await req.svc.cuentas.entrarConFacebook(req.body?.token, { actual: req.user })
    return r.token ? conSesion(req, res, r) : r
  }))
  router.post('/cuenta/huella/opciones', authLimit, h(req => req.svc.cuentas.opcionesLlave(req.body || {}, req.user)))
  router.post('/cuenta/huella/crear', authLimit, h(async (req, res) => {
    const r = await req.svc.cuentas.crearLlave(req.body || {}, req.user)
    return r.token ? conSesion(req, res, r) : r
  }))
  router.post('/cuenta/huella/entrar/opciones', authLimit, h(req => req.svc.cuentas.opcionesEntrarLlave()))
  router.post('/cuenta/huella/entrar', authLimit, h(async (req, res) => conSesion(req, res, await req.svc.cuentas.entrarConLlave(req.body || {}))))
  router.delete('/cuenta/huella/:llave', h(async (req) => {
    if (!req.user) throw Object.assign(new Error('Entra con tu cuenta'), { status: 401 })
    return req.svc.cuentas.quitarLlave(req.user, req.params.llave)
  }))
  router.post('/cuenta/registro', authLimit, h(async (req, res) => {
    await req.svc.cuentas.registrar(req.body || {})
    const { token, usuario } = await req.svc.cuentas.entrar(req.body || {})
    setCookie(req, res, token, req.svc.cuentas.SESSION_DAYS * 86400)
    return { usuario }
  }))
  router.post('/cuenta/entrar', authLimit, h(async (req, res) => {
    const { token, usuario } = await req.svc.cuentas.entrar(req.body || {})
    setCookie(req, res, token, req.svc.cuentas.SESSION_DAYS * 86400)
    return { usuario }
  }))
  router.post('/cuenta/salir', h(async (req, res) => {
    await req.svc.cuentas.salir(tokenOf(req))
    setCookie(req, res, '', 0)
    return { ok: true }
  }))

  // ---------- Explotación ----------
  const E = '/explotaciones/:id'
  router.get('/explotaciones', h(req => req.svc.ex.listarExplotaciones(req.user)))
  router.post('/explotaciones', h(req => req.svc.ex.crearExplotacion(req.user, req.body || {})))
  router.post(`${E}/miembros`, h(req => req.svc.ex.ponerMiembro(req.user, req.params.id, req.body || {})))
  router.delete(`${E}/miembros/:userId`, h(req => req.svc.ex.quitarMiembro(req.user, req.params.id, req.params.userId)))
  router.get(`${E}/fincas`, h(req => req.svc.ex.listarFincas(req.user, req.params.id)))
  router.post(`${E}/fincas`, h(req => req.svc.ex.crearFinca(req.user, req.params.id, req.body || {})))
  router.get(`${E}/recintos`, h(req => req.svc.ex.listarRecintos(req.user, req.params.id)))
  router.post(`${E}/recintos`, h(req => req.svc.ex.guardarRecinto(req.user, req.params.id, req.body || {})))
  router.patch(`${E}/recintos/:rid`, h(req => req.svc.ex.editarRecinto(req.user, req.params.id, req.params.rid, req.body || {})))
  router.get(`${E}/cultivos`, h(req => req.svc.ex.listarCultivos(req.user, req.params.id, { campaña: req.query.campaña || req.query.campana })))
  router.post(`${E}/cultivos`, h(req => req.svc.ex.crearCultivo(req.user, req.params.id, req.body || {})))
  router.get(`${E}/operaciones`, h(req => req.svc.ex.listarOperaciones(req.user, req.params.id)))
  router.post(`${E}/operaciones`, h(req => req.svc.ex.crearOperacion(req.user, req.params.id, req.body || {})))
  router.get(`${E}/operaciones/:opId`, h(req => req.svc.ex.obtenerOperacion(req.user, req.params.id, req.params.opId)))
  router.post(`${E}/operaciones/:opId/rectificar`, h(req => req.svc.ex.rectificarOperacion(req.user, req.params.id, req.params.opId, req.body || {})))
  router.post(`${E}/operaciones/:opId/evaluacion`, h(req => req.svc.ex.registrarEvaluacion(req.user, req.params.id, req.params.opId, req.body || {})))
  router.get(`${E}/cuaderno`, h(req => req.svc.ex.cuaderno(req.user, req.params.id, { campaña: req.query.campaña || req.query.campana })))
  router.get(`${E}/cuaderno.csv`, h(async (req, res) => {
    const c = await req.svc.ex.cuaderno(req.user, req.params.id, { campaña: req.query.campaña || req.query.campana })
    res.set('Content-Disposition', `attachment; filename="cuaderno-${c.campaña}.csv"`).type('text/csv; charset=utf-8').send(exportarCsv(c, { base: PUBLIC() }))
  }))

  return router
}

module.exports = createRouter()
module.exports.createRouter = createRouter
module.exports._test = { tokenOf }
