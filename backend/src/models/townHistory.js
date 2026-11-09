// Historia de cada municipio (colección townHistory), generada por scripts/build-town-history.js
// a partir de Wikipedia, los monumentos de la Junta y las webs de los ayuntamientos.
// La lee GET /api/towns/:townId/historia para la ficha (línea del tiempo, patrimonio y texto).
const mongoose = require('mongoose');

const source = { type: String, enum: ['wikipedia', 'jcyl', 'ayuntamiento'] };

const townHistorySchema = new mongoose.Schema({
  cod_ine: { type: String, required: true, unique: true },
  name: String,
  summary: String,
  // Hitos con fecha: year para ordenar (negativo = a. C.), label para mostrar
  events: [{
    _id: false,
    year: Number,
    label: String,
    text: String,
    source,
    url: String
  }],
  // Bienes de Interés Cultural y monumentos (Junta de Castilla y León)
  monuments: [{
    _id: false,
    name: String,
    // "type" hay que declararlo así: suelto, Mongoose lo toma como el tipo de todo el objeto
    type: { type: String },
    periods: [String],
    locality: String,
    description: String,
    lat: Number,
    lon: Number,
    bic: String,
    source,
    url: String
  }],
  // Texto de Wikipedia (CC BY-SA: se puede reproducir citando)
  wikipedia: { _id: false, url: String, paragraphs: [String] },
  // Web del ayuntamiento: solo extracto y enlace (el texto completo tiene derechos de autor)
  ayuntamiento: { _id: false, url: String, title: String, excerpt: String },
  sources: [{ _id: false, name: String, url: String, license: String }],
  updated_at: { type: Date, default: Date.now }
}, { collection: 'townHistory' });

module.exports = mongoose.model('TownHistory', townHistorySchema);
