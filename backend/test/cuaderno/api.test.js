// API del cuaderno por HTTP (routes/cuaderno) con el almacén en memoria: cookie de sesión httpOnly, escrituras solo
// con la cabecera X-Cuaderno, otra cuenta no ve nada ajeno (ni el CSV) y el recorrido completo cuadra.
const test = require('node:test')
const assert = require('node:assert')
const express = require('express')
const { memoryStore } = require('../../src/services/cuaderno/store')
const { createRouter } = require('../../src/routes/cuaderno')

const square = (x, y, d) => ({ type: 'Polygon', coordinates: [[[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]]] })
const fuente = async (ine) => (ine !== '37022' ? null : {
  municipio: { ine: '37022', catastro: '37022', nombre: 'Aldeaseca de la Frontera' }, campaña: 2026,
  fuente: { datos: 'SIGPAC 2026', fechaReferencia: '2025-12-15' },
  features: [{ type: 'Feature', geometry: square(-5.2, 40.94, 0.003), properties: { agr: 0, zona: 0, pol: 501, par: 77, rec: 1, uso: 'TA', sup: 60000, reg: 0, cat: null } }]
})

async function server() {
  const app = express()
  app.use('/api/cuaderno', createRouter({ store: memoryStore(), fuente, needsDb: false }))
  const s = await new Promise(r => { const x = app.listen(0, () => r(x)) })
  const base = `http://127.0.0.1:${s.address().port}/api/cuaderno`
  // Cliente con su cookie
  const client = () => {
    let cookie = ''
    return async (path, { method = 'GET', body, header = true } = {}) => {
      const res = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(header && method !== 'GET' ? { 'X-Cuaderno': '1' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
      const set = res.headers.get('set-cookie')
      if (set) cookie = set.split(';')[0]
      const type = res.headers.get('content-type') || ''
      return { status: res.status, setCookie: set, data: type.includes('json') ? await res.json() : await res.text() }
    }
  }
  return { s, client }
}

test('API: cuenta por cookie httpOnly; sin la cabecera no se escribe; otra cuenta no ve nada', async () => {
  const { s, client } = await server()
  try {
    const ana = client()
    const otro = client()
    const sinCabecera = await ana('/cuenta/registro', { method: 'POST', body: { email: 'ana@ejemplo.es', password: 'una-clave-larga', nombre: 'Ana' }, header: false })
    assert.strictEqual(sinCabecera.status, 403)
    const reg = await ana('/cuenta/registro', { method: 'POST', body: { email: 'ana@ejemplo.es', password: 'una-clave-larga', nombre: 'Ana' } })
    assert.strictEqual(reg.status, 200)
    assert.match(reg.setCookie, /HttpOnly/)
    assert.match(reg.setCookie, /SameSite=Lax/)
    assert.strictEqual((await ana('/cuenta')).data.usuario.email, 'ana@ejemplo.es')
    await otro('/cuenta/registro', { method: 'POST', body: { email: 'otro@ejemplo.es', password: 'otra-clave-larga' } })

    const e = (await ana('/explotaciones', { method: 'POST', body: { nombre: 'Finca Ana' } })).data
    const r = (await ana(`/explotaciones/${e._id}/recintos`, { method: 'POST', body: { ine: '37022', ref: { pol: 501, par: 77, rec: 1 } } })).data
    const c = (await ana(`/explotaciones/${e._id}/cultivos`, { method: 'POST', body: { campaña: 2026, especie: 'Trigo', unidades: [{ recintoId: r._id }] } })).data
    const parte = { id: 'api-1', tipo: 'abonado', estado: 'confirmado', fechaEfectiva: '2026-11-10', ejecutor: { nombre: 'Ana' }, imputaciones: [{ cultivoId: c._id, superficie: { metodo: 'declarada', valor: 51000 } }], lineas: [{ producto: { nombre: 'NPK 15-15-15', composicion: { N: 15, P2O5: 15, K2O: 15 } }, dosis: { valor: 180, unidad: 'kg/ha' } }] }
    assert.strictEqual((await ana(`/explotaciones/${e._id}/operaciones`, { method: 'POST', body: parte })).status, 200)
    // Dos reintentos del mismo parte: uno solo
    await ana(`/explotaciones/${e._id}/operaciones`, { method: 'POST', body: parte })
    await ana(`/explotaciones/${e._id}/operaciones`, { method: 'POST', body: parte })
    assert.strictEqual((await ana(`/explotaciones/${e._id}/operaciones`)).data.length, 1)
    const cu = (await ana(`/explotaciones/${e._id}/cuaderno?campaña=2026`)).data
    assert.strictEqual(Math.round(cu.totales.N * 10) / 10, 137.7)
    const csv = await ana(`/explotaciones/${e._id}/cuaderno.csv?campaña=2026`)
    assert.match(csv.data, /918,00;kg;137,70/)

    // La otra cuenta: nada de nada
    for (const path of [`/explotaciones/${e._id}/recintos`, `/explotaciones/${e._id}/operaciones`, `/explotaciones/${e._id}/operaciones/api-1`, `/explotaciones/${e._id}/cuaderno?campaña=2026`, `/explotaciones/${e._id}/cuaderno.csv?campaña=2026`]) {
      assert.strictEqual((await otro(path)).status, 404, path)
    }
    assert.deepStrictEqual((await otro('/explotaciones')).data, [])
    // Sin sesión
    const anon = client()
    assert.strictEqual((await anon(`/explotaciones/${e._id}/recintos`)).status, 401)
    // Salir invalida la sesión
    await ana('/cuenta/salir', { method: 'POST', body: {} })
    assert.strictEqual((await ana('/cuenta')).data.usuario, null)
  } finally {
    s.close()
  }
})
