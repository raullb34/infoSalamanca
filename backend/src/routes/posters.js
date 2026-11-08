// /api/posters: carteles de fiestas
//   GET  /img/<fichero>.webp        imágenes guardadas (públicas, caché larga)
//   GET  /town/:ine                 carteles aprobados de un pueblo (para la ficha)
//   Administración (Authorization: Bearer <ADMIN_TOKEN>):
//   GET    /admin?status=pending    candidatos por revisar (pending | approved | rejected | all)
//   POST   /admin                   alta manual { cod_ine, source_url, image_url?, year?, approve? }
//   POST   /admin/:id/approve       { year?, image_url? }
//   POST   /admin/:id/reject
//   DELETE /admin/:id
const express = require('express');
const mongoose = require('mongoose');
const requireAdmin = require('../middleware/requireAdmin');
const posters = require('../services/posterService');
const FestivalPoster = require('../models/festivalPoster');

const router = express.Router();

router.use('/img', express.static(posters.POSTERS_DIR, {
  maxAge: '30d', immutable: true, index: false, fallthrough: false
}));

router.get('/town/:ine', async (req, res) => {
  if (!/^\d{5}$/.test(req.params.ine)) return res.status(400).json({ success: false, error: 'Código INE no válido' });
  try {
    const data = await posters.forTown(req.params.ine);
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ success: true, data });
  } catch (err) {
    console.error('❌ Carteles del pueblo:', err.message);
    res.status(500).json({ success: false, error: 'Error obteniendo carteles' });
  }
});

const admin = express.Router();
admin.use(requireAdmin);

const validId = (req, res, next) =>
  mongoose.isValidObjectId(req.params.id) ? next() : res.status(400).json({ success: false, error: 'Id no válido' });

// Los errores de validación (enlace raro, imagen que no es imagen...) vuelven como 400 con su mensaje
const handle = (fn) => async (req, res) => {
  try {
    res.json({ success: true, data: await fn(req) });
  } catch (err) {
    console.error('❌ Admin carteles:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
};

admin.get('/', handle(req => posters.list(String(req.query.status || 'pending'))));

admin.post('/', handle(async req => {
  const { cod_ine, source_url, image_url, year, approve, municipality_name } = req.body || {};
  if (!/^\d{5}$/.test(String(cod_ine || ''))) throw new Error('Falta el código INE (5 cifras)');
  if (!source_url) throw new Error('Falta el enlace');
  const saved = await posters.addCandidate({
    cod_ine, source_url, image_url, year, municipality_name, found_by: 'manual', score: 100
  });
  const doc = await FestivalPoster.findOne({ cod_ine: String(cod_ine), source_url: saved.source_url, image_url: saved.image_url });
  return approve ? posters.approve(doc._id, { year, image_url }) : doc.toObject();
}));

admin.post('/:id/approve', validId, handle(req => posters.approve(req.params.id, req.body || {})));
admin.post('/:id/reject', validId, handle(req => posters.reject(req.params.id)));
admin.delete('/:id', validId, handle(req => posters.remove(req.params.id)));

router.use('/admin', admin);

module.exports = router;
