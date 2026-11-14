// Ciencia:
//   GET /api/ciencia/eventos    congresos y jornadas, divulgación, tecnología (Salamanca Tech, Convention Bureau,
//                               Turismo de Salamanca), de hoy en adelante; ?ine=37274 para un municipio
//   GET /api/ciencia/noticias   noticias de ciencia de la Universidad de Salamanca
// Los datos salen de la memoria de services/agendas (se precargan al arrancar): responder no espera a las webs.
const express = require('express')
const agendas = require('../services/agendas')

const router = express.Router()

router.get('/eventos', async (req, res) => {
  try {
    const ine = String(req.query.ine || '').split('_')[0]
    const eventos = await agendas.scienceEvents()
    res.json({ eventos: ine ? eventos.filter(e => e.cod_ine === ine) : eventos })
  } catch (err) {
    console.error('Ciencia, eventos:', err.message)
    res.status(500).json({ error: 'No se han podido cargar los eventos de ciencia' })
  }
})

router.get('/noticias', async (req, res) => {
  try {
    res.json({ noticias: await agendas.scienceNews() })
  } catch (err) {
    console.error('Ciencia, noticias:', err.message)
    res.status(500).json({ error: 'No se han podido cargar las noticias de ciencia' })
  }
})

module.exports = router
