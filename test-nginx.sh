#!/bin/bash

echo "🔍 Diagnóstico avanzado de conectividad"
echo "========================================"
echo ""

echo "1️⃣  Verificar que nginx puede conectarse al frontend:"
docker exec infosalamanca-nginx wget -O- -q http://frontend/ | head -5
echo ""

echo "2️⃣  Verificar configuración de nginx:"
docker exec infosalamanca-nginx nginx -t
echo ""

echo "3️⃣  Ver configuración activa de nginx:"
docker exec infosalamanca-nginx cat /etc/nginx/nginx.conf | grep -A 10 "server {"
echo ""

echo "4️⃣  Test desde fuera del servidor (si tienes acceso):"
echo "curl -v http://infosalamanca.duckdns.org/"
echo ""

echo "5️⃣  Verificar logs de error de nginx:"
docker logs infosalamanca-nginx 2>&1 | grep -i error | tail -10
echo ""

echo "6️⃣  Verificar puertos expuestos:"
docker port infosalamanca-nginx
echo ""

echo "7️⃣  Verificar conectividad del host al contenedor:"
curl -I http://localhost:80/
echo ""
