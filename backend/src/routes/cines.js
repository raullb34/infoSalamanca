// GET /api/cines: cines de la provincia con su cartelera de los próximos 7 días (de la web de cada cine)
// GET /api/cines?ine=37046: solo los de ese municipio
const express = require('express');
const { cartelera } = require('../services/cinesService');

const router = express.Router();

// La primera lectura de las webs tarda ~20 s: se hace al arrancar y luego cada 3 horas, para que nadie espere
if (process.env.NODE_ENV !== 'test') {
  setTimeout(() => cartelera().catch(() => {}), 15000).unref();
  setInterval(() => cartelera().catch(() => {}), 3 * 60 * 60 * 1000 + 60000).unref();
}

router.get('/', async (req, res) => {
  try {
    const data = await cartelera();
    const ine = String(req.query.ine || '').split('_')[0];
    res.json(ine ? { ...data, cines: data.cines.filter(c => c.cod_ine === ine) } : data);
  } catch (err) {
    console.error('Cartelera de cines:', err.message);
    res.status(500).json({ error: 'No se ha podido cargar la cartelera' });
  }
});

module.exports = router;
