#!/bin/bash

echo "🔍 Diagnóstico del Servidor InfoSalamanca"
echo "=========================================="

# Verificar contenedores
echo "📦 Estado de los contenedores:"
docker-compose ps

echo ""
echo "🔗 Verificar red de contenedores:"
docker network ls | grep infosalamanca

echo ""
echo "📋 Logs recientes del backend:"
docker-compose logs --tail=10 backend

echo ""
echo "📋 Logs recientes de nginx:"
docker-compose logs --tail=10 nginx

echo ""
echo "🌐 Pruebas de conectividad interna:"

# Probar conectividad interna del backend
echo "Probando backend desde nginx container:"
docker-compose exec nginx wget -q --spider http://backend:4000/health && echo "✅ Backend accesible internamente" || echo "❌ Backend NO accesible internamente"

# Probar endpoints específicos
echo ""
echo "🎯 Pruebas de endpoints externos:"

# Health check
curl -f http://localhost/api/health > /dev/null 2>&1 && echo "✅ /api/health - OK" || echo "❌ /api/health - FAIL"

# Towns endpoint
curl -f http://localhost/api/towns/37135/info > /dev/null 2>&1 && echo "✅ /api/towns/37135/info - OK" || echo "❌ /api/towns/37135/info - FAIL"

echo ""
echo "📊 Estadísticas de nginx:"
docker-compose exec nginx nginx -s reload 2>/dev/null && echo "✅ Nginx config OK" || echo "❌ Nginx config ERROR"

echo ""
echo "=========================================="
