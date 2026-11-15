// Newsletter: suscriptores y envíos. Solo se guarda lo imprescindible (RGPD): el correo, su estado, las fechas
// y el texto de consentimiento que aceptó; ni nombre ni IP.
const mongoose = require('mongoose')

const subscriberSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  estado: { type: String, enum: ['pendiente', 'activo', 'baja'], default: 'pendiente', index: true },
  // Un token por persona: confirma el alta y da de baja (va en cada correo)
  token: { type: String, required: true, unique: true },
  consentimiento: { texto: String, fecha: Date },
  confirmado: Date,
  baja: Date,
  ultimoCorreoConfirmacion: Date,
  // Las altas sin confirmar se borran solas a los 7 días (índice TTL; se quita al confirmar)
  caduca: { type: Date, index: { expireAfterSeconds: 0 } }
}, { timestamps: { createdAt: 'creado', updatedAt: 'actualizado' } })

const issueSchema = new mongoose.Schema({
  asunto: { type: String, required: true },
  intro: String,
  desde: String,
  hasta: String,
  excluidos: [String],
  html: String,
  text: String,
  whatsapp: String,
  estado: { type: String, enum: ['enviando', 'enviado', 'error'], default: 'enviando', index: true },
  total: { type: Number, default: 0 },
  enviados: { type: Number, default: 0 },
  fallidos: { type: Number, default: 0 },
  error: String,
  terminado: Date
}, { timestamps: { createdAt: 'creado', updatedAt: 'actualizado' } })

module.exports = {
  Subscriber: mongoose.models.NewsletterSubscriber || mongoose.model('NewsletterSubscriber', subscriberSchema),
  NewsletterIssue: mongoose.models.NewsletterIssue || mongoose.model('NewsletterIssue', issueSchema)
}
