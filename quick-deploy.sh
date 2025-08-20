#!/bin/bash

# Script de deploy rápido para InfoSalamanca
# Este script automatiza el proceso de deployment en producción

set -e  # Salir si hay algún error

echo "🚀 Iniciando deployment rápido de InfoSalamanca..."
echo "=================================================="

# Función para logging con timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: No se encontró docker-compose.yml. Ejecuta este script desde el directorio raíz del proyecto."
    exit 1
fi

# Parar contenedores existentes
log "🛑 Parando contenedores existentes..."
docker-compose down

# Construir imágenes sin cache
log "🔨 Construyendo nuevas imágenes..."
docker-compose build --no-cache backend frontend

# Verificar que no hay imágenes dangling
log "🧹 Limpiando imágenes no utilizadas..."
docker image prune -f

# Iniciar todos los servicios
log "🚀 Iniciando todos los servicios..."
docker-compose up -d

# Esperar a que los servicios estén listos
log "⏳ Esperando a que los servicios estén listos..."
sleep 10

# Verificar que todos los contenedores están funcionando
log "🔍 Verificando estado de los contenedores..."
docker-compose ps

# Verificar endpoints principales
log "🌐 Verificando endpoints..."

# Test del frontend
if curl -f http://localhost/ > /dev/null 2>&1; then
    log "✅ Frontend accesible en http://localhost/"
else
    log "❌ Frontend no accesible"
fi

# Test del backend
if curl -f http://localhost/api/health > /dev/null 2>&1; then
    log "✅ Backend API accesible en http://localhost/api/"
else
    log "❌ Backend API no accesible"
fi

# Test de Langflow
if curl -f http://localhost/langflow/ > /dev/null 2>&1; then
    log "✅ Langflow accesible en http://localhost/langflow/"
else
    log "❌ Langflow no accesible"
fi

# Mostrar logs recientes
log "📋 Logs recientes del backend:"
docker-compose logs --tail=5 backend

log "📋 Logs recientes de Langflow:"
docker-compose logs --tail=5 langflow

echo ""
echo "=================================================="
echo "🎉 ¡Deployment completado!"
echo ""
echo "🌐 Servicios disponibles:"
echo "   • Frontend: http://localhost/"
echo "   • Backend API: http://localhost/api/"
echo "   • Langflow: http://localhost/langflow/"
echo "   • MongoDB: localhost:27017"
echo "   • Redis: localhost:6379"
echo ""
echo "📊 Para monitorear los servicios:"
echo "   docker-compose logs -f [servicio]"
echo "   docker-compose ps"
echo ""
echo "🛑 Para parar los servicios:"
echo "   docker-compose down"
echo "=================================================="
