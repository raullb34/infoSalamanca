// API del área privada «Mi explotación» y del cuaderno (services/cuaderno). El visor público no la necesita.
//
//   POST /api/cuaderno/cuenta/registro · /cuenta/entrar · /cuenta/salir    GET /api/cuaderno/cuenta
//   GET|POST /api/cuaderno/explotaciones
//   GET|POST /api/cuaderno/explotaciones/:id/recintos          PATCH …/recintos/:rid
//   GET|POST /api/cuaderno/explotaciones/:id/cultivos
//   GET|POST /api/cuaderno/explotaciones/:id/operaciones       GET …/operaciones/:opId   POST …/operaciones/:opId/rectificar
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
function createRouter({ store = null, fuente = fuenteSigpac, needsDb = true } = {}) {
  const router = express.Router()
  router.use(express.json({ limit: '2mb' })) // los croquis llevan geometría

  let services = null
  async function svc() {
    if (services) return services
    const st = store || mongoStore()
    if (st.ensureIndexes) await st.ensureIndexes().catch(err => console.warn('⚠️ Cuaderno, índices:', err.message))
    services = { cuentas: cuentas.createService(st), ex: explotacion.createService(st, { fuenteSigpac: fuente }) }
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
  router.get('/cuenta', h(async (req) => ({ usuario: req.user })))
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
  router.get(`${E}/recintos`, h(req => req.svc.ex.listarRecintos(req.user, req.params.id)))
  router.post(`${E}/recintos`, h(req => req.svc.ex.guardarRecinto(req.user, req.params.id, req.body || {})))
  router.patch(`${E}/recintos/:rid`, h(req => req.svc.ex.editarRecinto(req.user, req.params.id, req.params.rid, req.body || {})))
  router.get(`${E}/cultivos`, h(req => req.svc.ex.listarCultivos(req.user, req.params.id, { campaña: req.query.campaña || req.query.campana })))
  router.post(`${E}/cultivos`, h(req => req.svc.ex.crearCultivo(req.user, req.params.id, req.body || {})))
  router.get(`${E}/operaciones`, h(req => req.svc.ex.listarOperaciones(req.user, req.params.id)))
  router.post(`${E}/operaciones`, h(req => req.svc.ex.crearOperacion(req.user, req.params.id, req.body || {})))
  router.get(`${E}/operaciones/:opId`, h(req => req.svc.ex.obtenerOperacion(req.user, req.params.id, req.params.opId)))
  router.post(`${E}/operaciones/:opId/rectificar`, h(req => req.svc.ex.rectificarOperacion(req.user, req.params.id, req.params.opId, req.body || {})))
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
