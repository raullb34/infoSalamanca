const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Log de debugging
console.log('🔍 Puerto configurado:', port);
console.log('🔍 Directorio actual:', __dirname);
console.log('📁 Contenido de dist:', fs.existsSync(path.join(__dirname, 'dist')) ? 
  fs.readdirSync(path.join(__dirname, 'dist')) : 'NO EXISTE');

// Servir archivos estáticos desde dist
app.use(express.static(path.join(__dirname, 'dist')));

// Log de peticiones
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

// Health check para Railway
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Manejar rutas SPA - devolver index.html para todas las rutas
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  console.log('📄 Enviando:', indexPath);
  res.sendFile(indexPath);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Frontend corriendo en puerto ${port}`);
  console.log(`🌐 Disponible en: http://0.0.0.0:${port}`);
});
