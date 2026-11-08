// Carteles de fiestas. Cada documento es una publicación o imagen encontrada para un pueblo.
// El buscador (scripts/find-posters.js) los crea como "pending"; en /admin/carteles.html se aprueban o rechazan.
//  - Facebook / Instagram: se guarda solo el enlace y la ficha incrusta la publicación al pulsar.
//  - Otras webs: al aprobar se descarga la imagen y se guardan copia y miniatura en /app/uploads/posters.
const mongoose = require('mongoose');

const festivalPosterSchema = new mongoose.Schema({
  cod_ine: { type: String, required: true, index: true },
  municipality_name: String,
  year: { type: Number, min: 2000, max: 2100 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  source: { type: String, enum: ['facebook', 'instagram', 'web'], required: true },
  source_url: { type: String, required: true }, // la publicación o página donde está el cartel
  image_url: { type: String, default: null }, // imagen original (solo webs que no son redes sociales)
  image: String,      // copia propia: /api/posters/img/<fichero>.webp
  thumb: String,      // miniatura propia
  title: String,
  snippet: String,
  found_by: { type: String, enum: ['search', 'web', 'manual'], default: 'manual' },
  query: String,
  score: Number,      // cuánto se parece a un cartel de fiestas (para ordenar candidatos)
  found_at: { type: Date, default: Date.now },
  reviewed_at: Date
}, { collection: 'festivalPosters' });

// El mismo enlace (y la misma imagen) solo una vez por pueblo: el buscador lo vuelve a encontrar cada vez.
// En webs normales una página puede tener varias imágenes candidatas; en redes sociales image_url es null.
festivalPosterSchema.index({ cod_ine: 1, source_url: 1, image_url: 1 }, { unique: true });

module.exports = mongoose.model('FestivalPoster', festivalPosterSchema);
