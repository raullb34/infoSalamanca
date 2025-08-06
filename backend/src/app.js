// backend/src/app.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const HOST = process.env.BACKEND_HOST || '0.0.0.0';
const PORT = process.env.BACKEND_PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/infosalamanca';

const app = express();

app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/towns', require('./routes/municipios'));
app.use('/api/gastro', require('./routes/gastronomia'));

// Conexión a MongoDB con validación
console.log('Intentando conectar a MongoDB...');
console.log('URI:', MONGODB_URI ? 'Configurada' : 'NO CONFIGURADA');

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Conectado a MongoDB exitosamente');
  })
  .catch((error) => {
    console.error('❌ Error conectando a MongoDB:', error.message);
    process.exit(1);
  });

app.listen(PORT, HOST, () => {
  console.log(`Backend corriendo en http://${HOST}:${PORT}`);
});