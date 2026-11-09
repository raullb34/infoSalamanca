// /api/lonja: cotizaciones de la Lonja de Salamanca (services/lonjaService.js)
//   GET /productos            todos los productos con su último precio y variaciones
//   GET /series?ids=a,b,c     histórico de hasta 4 productos, con tendencia, estacionalidad y previsión
const express = require('express')
const lonja = require('../services/lonjaService')

const router = express.Router()

router.get('/productos', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=1800')
    res.json({ success: true, ...(await lonja.products()) })
  } catch (err) {
    console.error('❌ Lonja, productos:', err.message)
    res.status(503).json({ success: false, error: 'No se han podido cargar las cotizaciones de la Lonja. Inténtalo más tarde.' })
  }
})

router.get('/series', async (req, res) => {
  const ids = String(req.query.ids || '').split(',').map(s => s.trim()).filter(s => /^[a-z0-9-]{1,160}$/.test(s)).slice(0, 4)
  if (!ids.length) return res.status(400).json({ success: false, error: 'Indica los productos (ids)' })
  try {
    res.set('Cache-Control', 'public, max-age=1800')
    res.json({ success: true, source: lonja.SOURCE, series: await lonja.seriesFor(ids) })
  } catch (err) {
    console.error('❌ Lonja, series:', err.message)
    res.status(503).json({ success: false, error: 'No se han podido cargar las cotizaciones de la Lonja. Inténtalo más tarde.' })
  }
})

module.exports = router
