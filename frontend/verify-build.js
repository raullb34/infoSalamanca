#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando build de la aplicación...');

const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');

if (!fs.existsSync(distPath)) {
  console.error('❌ Carpeta dist no encontrada');
  process.exit(1);
}

if (!fs.existsSync(indexPath)) {
  console.error('❌ index.html no encontrado en dist/');
  process.exit(1);
}

console.log('✅ Build verificado correctamente');
console.log('📁 Archivos en dist:');
fs.readdirSync(distPath).forEach(file => {
  console.log(`   - ${file}`);
});
