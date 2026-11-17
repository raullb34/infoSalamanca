// Aportaciones de la gente ("¿es tu pueblo?, ¿es tu negocio?…"): se guardan pendientes y solo las ve el panel de
// administración (/admin/aportaciones.html). Nada se publica solo: lo revisa una persona y, si vale, lo aplica.
// Solo lo imprescindible (RGPD): el correo es opcional, sirve para contestar y se borra al revisarla; ni nombre ni IP.
const mongoose = require('mongoose')

const TIPOS = ['pueblo', 'negocio', 'fiesta', 'evento', 'otro']
const RELACIONES = ['ayuntamiento', 'negocio', 'vecino', 'visitante', 'otro']

const contributionSchema = new mongoose.Schema({
  tipo: { type: String, enum: TIPOS, required: true },
  // De qué va: el pueblo (INE y nombre) y, si es de algo concreto, su id y nombre (un productor, un evento…)
  cod_ine: String,
  municipio: String,
  ref: String,
  ref_nombre: String,
  relacion: { type: String, enum: RELACIONES, default: 'otro' },
  mensaje: { type: String, required: true },
  enlace: String,
  email: String,
  // Si traía un cartel, se propuso también en /admin/carteles.html
  cartel: { type: Boolean, default: false },
  estado: { type: String, enum: ['pendiente', 'aplicada', 'descartada'], default: 'pendiente', index: true },
  nota: String, // nota de quien la revisa
  revisada: Date
}, { timestamps: { createdAt: 'creada', updatedAt: 'actualizada' } })

const Contribution = mongoose.models.Contribution || mongoose.model('Contribution', contributionSchema, 'contributions')

module.exports = { Contribution, TIPOS, RELACIONES }
