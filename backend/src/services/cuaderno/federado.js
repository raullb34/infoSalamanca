// Entrar con Google o con Facebook: el servidor comprueba lo que manda el navegador (nunca se fía de él).
//  - Google: el botón «Entrar con Google» (Google Identity Services) da un ID token (JWT firmado RS256). Aquí se
//    comprueba la firma con las claves públicas de Google, el emisor, el destinatario (nuestro client ID) y la caducidad.
//  - Facebook: el SDK da un access token. Se pregunta a Facebook si es válido y de nuestra aplicación (debug_token) y
//    luego se leen id, nombre y correo, con appsecret_proof.
// Devuelven { id, email, emailVerificado, nombre } o lanzan un error 401.
const crypto = require('crypto')
const axios = require('axios')

const fail = (msg) => Object.assign(new Error(msg), { status: 401 })
const b64json = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'))

// Claves públicas de Google (JWK), en memoria lo que diga su caché (o una hora)
let googleKeys = { at: 0, ttl: 0, keys: [] }
async function fetchGoogleKeys() {
  if (Date.now() - googleKeys.at < googleKeys.ttl) return googleKeys.keys
  const r = await axios.get('https://www.googleapis.com/oauth2/v3/certs', { timeout: 10000 })
  const maxAge = Number(/max-age=(\d+)/.exec(r.headers['cache-control'] || '')?.[1] || 3600)
  googleKeys = { at: Date.now(), ttl: maxAge * 1000, keys: r.data.keys || [] }
  return googleKeys.keys
}

async function verificarGoogle(idToken, { clientId, getKeys = fetchGoogleKeys, now = () => Date.now() } = {}) {
  if (!clientId) throw Object.assign(new Error('Entrar con Google no está activado'), { status: 501 })
  const parts = String(idToken || '').split('.')
  if (parts.length !== 3) throw fail('No se ha podido comprobar la cuenta de Google')
  let header, payload
  try { header = b64json(parts[0]); payload = b64json(parts[1]) } catch { throw fail('No se ha podido comprobar la cuenta de Google') }
  if (header.alg !== 'RS256') throw fail('No se ha podido comprobar la cuenta de Google')
  const jwk = (await getKeys()).find(k => k.kid === header.kid)
  if (!jwk) throw fail('No se ha podido comprobar la cuenta de Google')
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))
  if (!ok) throw fail('No se ha podido comprobar la cuenta de Google')
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) throw fail('No se ha podido comprobar la cuenta de Google')
  if (payload.aud !== clientId) throw fail('No se ha podido comprobar la cuenta de Google')
  if (!payload.exp || payload.exp * 1000 < now() - 60e3) throw fail('Ha pasado demasiado tiempo: vuelve a pulsar «Entrar con Google»')
  if (!payload.sub) throw fail('No se ha podido comprobar la cuenta de Google')
  return {
    id: String(payload.sub),
    email: payload.email ? String(payload.email).toLowerCase() : null,
    emailVerificado: payload.email_verified === true || payload.email_verified === 'true',
    nombre: payload.given_name || payload.name || null
  }
}

async function verificarFacebook(accessToken, { appId, appSecret, http = axios } = {}) {
  if (!appId || !appSecret) throw Object.assign(new Error('Entrar con Facebook no está activado'), { status: 501 })
  const token = String(accessToken || '')
  if (!token) throw fail('No se ha podido comprobar la cuenta de Facebook')
  const G = 'https://graph.facebook.com/v21.0'
  let dbg, me
  try {
    dbg = (await http.get(`${G}/debug_token`, { params: { input_token: token, access_token: `${appId}|${appSecret}` }, timeout: 10000 })).data?.data
  } catch { throw fail('No se ha podido comprobar la cuenta de Facebook') }
  if (!dbg?.is_valid || String(dbg.app_id) !== String(appId)) throw fail('No se ha podido comprobar la cuenta de Facebook')
  const proof = crypto.createHmac('sha256', appSecret).update(token).digest('hex')
  try {
    me = (await http.get(`${G}/me`, { params: { fields: 'id,first_name,name,email', access_token: token, appsecret_proof: proof }, timeout: 10000 })).data
  } catch { throw fail('No se ha podido comprobar la cuenta de Facebook') }
  if (!me?.id || String(me.id) !== String(dbg.user_id)) throw fail('No se ha podido comprobar la cuenta de Facebook')
  // Facebook no garantiza que el correo esté verificado: sirve para rellenar, no para unir cuentas (ver cuentas.js)
  return { id: String(me.id), email: me.email ? String(me.email).toLowerCase() : null, emailVerificado: false, nombre: me.first_name || me.name || null }
}

module.exports = { verificarGoogle, verificarFacebook }
