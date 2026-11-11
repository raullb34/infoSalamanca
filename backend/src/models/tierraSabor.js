// Productores Tierra de Sabor de Salamanca y dónde venden (colección tierraSabor).
// La genera scripts/build-tierra-sabor.js con los datos de la Junta y la visita a cada web.
// "revisado" marca las fichas corregidas a mano: el script no las pisa al recargar.
const mongoose = require('mongoose');

const tierraSaborSchema = new mongoose.Schema({
  idempresa: { type: Number, required: true, unique: true },
  nombre: String,
  direccion: String,
  cp: String,
  localidad: String,
  cod_ine: { type: String, index: true },
  heart_of_spain: Boolean,
  web: { _id: false, original: String, url: String, final: String, estado: String },
  venta: {
    _id: false,
    online: { _id: false, url: String, plataforma: String },
    dondeComprar: { _id: false, url: String, titulo: String, extracto: String },
    telefono: String,
    email: String,
    horario: String,
    redes: { type: Map, of: String }
  },
  secciones: [String],
  productos: [{ _id: false, id: Number, nombre: String, marca: String, seccion: String, categoria: String, variedad: String, calidad: String }],
  revisado: { _id: false, por: String, fecha: Date, nota: String },
  checked_at: Date,
  updated_at: Date
}, { collection: 'tierraSabor' });

module.exports = mongoose.model('TierraSabor', tierraSaborSchema);
