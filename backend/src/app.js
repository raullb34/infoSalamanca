// backend/src/app.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const HOST = process.env.BACKEND_HOST || 'localhost';
const PORT = process.env.BACKEND_PORT || 4000;

const app = express();

app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/towns', require('./routes/municipios'));
app.use('/api/gastro', require('./routes/gastronomia'));

//mongoose.connect(process.env.MONGODB_URI);
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

mongoose.connect(process.env.MONGODB_URI);

app.listen(PORT, HOST, () => {
  console.log(`Backend corriendo en http://${HOST}:${PORT}`);
});