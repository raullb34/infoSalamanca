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
app.use('/api/posters', require('./routes/posters'));
app.use('/api/lonja', require('./routes/lonja'));
app.use('/api/fotos', require('./routes/fotos'));
app.use('/api/cines', require('./routes/cines'));
app.use('/api/ciencia', require('./routes/ciencia')); // eventos y noticias de ciencia (services/agendas)
app.use('/api/newsletter', require('./routes/newsletter')); // suscripción a la agenda semanal
app.use('/api/aportaciones', require('./routes/aportaciones')); // «¿es tu pueblo / tu negocio?»: pendientes de revisión
app.use('/api/l', require('./routes/shortLinks')); // enlaces cortos del canal de WhatsApp
app.use('/api/cuaderno', require('./routes/cuaderno')); // «Mi explotación» y cuaderno de campo (área privada, con cuenta)
app.use('/api/admin', require('./routes/admin')); // panel de administración (/admin)
app.use('/api/v1/weather', require('./routes/weather')); // El tiempo en Salamanca (docs/meteorologia)
app.use('/api', require('./routes/asistente')); // /api/chat y /api/search

// Último recurso para errores de una ruta: responder 500 en vez de dejar la petición colgada
app.use((err, req, res, next) => {
  console.error(`❌ Error en ${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) return next(err);
  res.status(500).json({ success: false, error: 'Error interno del servidor' });
});

// Un error que se escapa de una ruta asíncrona no debe tumbar todo el backend (antes un fallo en
// /all-festivals dejaba toda la web con 502 mientras Docker lo reiniciaba). Se registra y se sigue.
process.on('unhandledRejection', (reason) => {
  console.error('❌ Promesa rechazada sin capturar:', reason);
});

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

    // Tareas del módulo meteorológico (se desactivan con WEATHER_SYNC=off)
    const weatherJobs = require('./services/weather/jobs');
    weatherJobs.registerAll();
    require('./services/weather/scheduler').start();

    mongoose.connection.on('error', (err) => {
      console.error('❌ Error de conexión MongoDB:', err.message);
    });
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB desconectado');
    });

    app.listen(PORT, HOST, () => {
      console.log(`🎯 Servidor corriendo en puerto ${PORT}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
      // Agenda cultural de la Diputación precargada (la primera consulta de un pueblo no espera a La Salina)
      if (process.env.NODE_ENV !== 'test') {
        setTimeout(() => require('./services/diputacionAgenda').getAgenda().catch(e => console.warn('⚠️ Agenda de la Diputación:', e.message)), 5000);
        // Y las de salamanca.es, Salamanca Tech y la USAL, que se refrescan solas cada hora
        const agendas = require('./services/agendas');
        const warm = () => Promise.all([agendas.culturalEvents(), agendas.scienceEvents(), agendas.scienceNews()]).catch(() => {});
        setTimeout(warm, 20000);
        setInterval(warm, 60 * 60 * 1000 + 30000).unref();
        // Prensa local: noticias de los pueblos y eventos que anuncian (services/prensa), cada 30 minutos
        const prensa = require('./services/prensa');
        const readPress = () => prensa.refresh().catch(e => console.warn('⚠️ Prensa:', e.message));
        setTimeout(readPress, 45000);
        setInterval(readPress, 30 * 60 * 1000).unref();
      }
    });
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
}

start();