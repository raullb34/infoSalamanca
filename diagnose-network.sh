#!/bin/bash

echo "🔍 Diagnóstico de red para InfoSalamanca"
echo "========================================"
echo ""

# Estado de contenedores
echo "📦 Estado de contenedores:"
docker compose ps
echo ""

# Puerto 80 escuchando
echo "🔌 Verificando si el puerto 80 está escuchando:"
netstat -tlnp | grep :80 || ss -tlnp | grep :80
echo ""

# Logs de nginx
echo "📋 Últimos logs de nginx:"
docker compose logs --tail=20 nginx
echo ""

# Test local
echo "🌐 Test de conectividad local (localhost):"
curl -I http://localhost/ 2>&1 | head -10
echo ""

# Test de DNS
echo "🌐 Resolución DNS de infosalamanca.duckdns.org:"
nslookup infosalamanca.duckdns.org
echo ""

# IP pública del servidor
echo "🌍 IP pública del servidor:"
curl -s ifconfig.me
echo ""
echo ""

# Verificar firewall
echo "🔥 Verificar si el firewall está bloqueando:"
sudo iptables -L -n | grep 80 || echo "No se encontraron reglas específicas para puerto 80"
echo ""

# Test desde el contenedor nginx
echo "🐳 Test desde dentro del contenedor nginx al frontend:"
docker exec infosalamanca-nginx wget -O- http://frontend/ 2>&1 | head -20
echo ""

echo "========================================"
echo "✅ Diagnóstico completado"
