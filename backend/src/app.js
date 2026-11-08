// backend/src/app.js
const path = require('path');
const fs = require('fs');
// Cargar variables de entorno: primero .env local si existe en el repo raíz
require('dotenv').config();
const rootEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnvPath)) {
  require('dotenv').config({ path: rootEnvPath, override: false });
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Railway configura PORT automáticamente
const HOST = process.env.HOST || process.env.BACKEND_HOST || '0.0.0.0';
const PORT = process.env.PORT || process.env.BACKEND_PORT || 4000;

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

// API Healthcheck endpoint
app.get('/api/health', (req, res) => {
  const health = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  };
  res.status(200).json(health);
});

// Routes
app.use('/api/towns', require('./routes/municipios'));
app.use('/api/gastro', require('./routes/gastronomia'));
app.use('/api/history', require('./routes/history'));

// Conexión a MongoDB y arranque del servidor
console.log('🚀 Iniciando aplicación...');
console.log('PORT:', PORT);

async function start() {
  try {
    if (!MONGODB_URI) {
      console.error('❌ MONGODB_URI no está definido en las variables de entorno');
      process.exit(1);
    }

    console.log('🔗 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      // Opciones recomendadas para producción
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB conectado exitosamente');

    mongoose.connection.on('error', (err) => {
      console.error('❌ Error de conexión MongoDB:', err.message);
    });
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB desconectado');
    });

    app.listen(PORT, HOST, () => {
      console.log(`🎯 Servidor corriendo en puerto ${PORT}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
}

start();