// GET /api/l/:code → redirige a la página del evento (enlaces cortos del canal de WhatsApp, services/shortLinks.js)
const express = require('express')
const mongoose = require('mongoose')
const shortLinks = require('../services/shortLinks')
const { publicUrl } = require('../services/difusion/digest')

const router = express.Router()
let service = null
const svc = () => (service = service || shortLinks.createService(shortLinks.mongoRepo(), { base: publicUrl }))

router.get('/:code', async (req, res) => {
  try {
    const url = mongoose.connection.readyState === 1 ? await svc().resolve(req.params.code) : null
    // Si no existe (o no hay base de datos), a la portada en vez de un error
    res.set('Cache-Control', 'no-store').redirect(302, url || publicUrl())
  } catch {
    res.redirect(302, publicUrl())
  }
})

module.exports = router
module.exports.service = svc
