// Aportaciones de la gente (parte pública):
//   POST /api/aportaciones  { tipo, cod_ine, municipio, ref, ref_nombre, relacion, mensaje, enlace, email }
// Se guardan pendientes de revisión; las revisa el panel (/admin/aportaciones.html, rutas en routes/admin.js).
// Los carteles de fiestas con enlace van además a la cola de carteles (/admin/carteles.html).
const express = require('express')
const mongoose = require('mongoose')
const { rateLimit } = require('../middleware/rateLimit')
const contributions = require('../services/contributions')

const router = express.Router()

// Cartel propuesto por alguien: pendiente en Carteles, como los que encuentra la búsqueda o la prensa
async function proposePoster(c) {
  const posters = require('../services/posterService')
  await posters.addCandidate({
    cod_ine: c.cod_ine,
    municipality_name: c.municipio,
    year: new Date().getFullYear(),
    source_url: c.enlace,
    title: 'Enviado por un usuario',
    snippet: c.mensaje,
    found_by: 'usuario',
    score: 90
  })
  return true
}

let service = null
const svc = () => (service = service || contributions.createService(contributions.mongoRepo(), { proposePoster }))

router.post('/', express.json({ limit: '8kb' }), rateLimit({ perMinute: 3, perDay: 20 }), async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ ok: false, mensaje: 'Ahora mismo no se puede enviar. Prueba en un rato.' })
  try {
    const r = await svc().submit(req.body || {})
    res.status(r.ok ? 200 : r.status || 400).json(r)
  } catch (err) {
    console.error('❌ Aportación:', err.message)
    res.status(500).json({ ok: false, mensaje: 'No se ha podido guardar. Prueba en un rato.' })
  }
})

module.exports = router
module.exports.service = svc
