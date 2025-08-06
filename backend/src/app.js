// backend/src/app.js
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Railway configura PORT automáticamente
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 4000;

// Railway: Usar variables de entorno sin fallbacks locales
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || process.env.MONGO_URI;

const app = express();

app.use(cors());
app.use(express.json());

// Healthcheck endpoint
app.get('/health', (req, res) => {
  const health = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  };
  res.status(200).json(health);
});

// Rutas
app.use('/api/towns', require('./routes/municipios'));
app.use('/api/gastro', require('./routes/gastronomia'));

// Conexión a MongoDB con validación
console.log('� Iniciando aplicación...');
console.log('PORT:', PORT);

if (!MONGODB_URI) {
  console.error('❌ ERROR: No se encontró MONGODB_URI en las variables de entorno');
  console.error('💡 Configura MONGODB_URI en Railway');
  process.exit(1);
}

console.log('🔗 Conectando a MongoDB...');

mongoose.connect(MONGODB_URI, {
  // Opciones recomendadas para Railway/Producción
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000, // 10 segundos timeout
  socketTimeoutMS: 45000,
})
  .then(() => {
    console.log('✅ MongoDB conectado exitosamente');
  })
  .catch((error) => {
    console.error('❌ Error conectando a MongoDB:', error.message);
    process.exit(1);
  });

app.listen(PORT, HOST, () => {
  console.log(`🎯 Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});