#!/bin/bash

echo "🔍 Verificación DNS de DuckDNS"
echo "=============================="
echo ""

echo "1️⃣  IP actual registrada en DuckDNS:"
dig +short infosalamanca.duckdns.org
echo ""

echo "2️⃣  IP IPv4 del servidor:"
curl -4 -s ifconfig.me
echo ""

echo "3️⃣  Comparación:"
DUCKDNS_IP=$(dig +short infosalamanca.duckdns.org)
SERVER_IP=$(curl -4 -s ifconfig.me)

echo "   DuckDNS apunta a: $DUCKDNS_IP"
echo "   Servidor tiene IP: $SERVER_IP"
echo ""

if [ "$DUCKDNS_IP" == "$SERVER_IP" ]; then
    echo "✅ Las IPs coinciden"
else
    echo "❌ Las IPs NO coinciden - necesitas actualizar DuckDNS"
    echo ""
    echo "💡 Para actualizar DuckDNS con tu token:"
    echo "   curl 'https://www.duckdns.org/update?domains=infosalamanca&token=TU_TOKEN&ip=$SERVER_IP'"
fi
echo ""

echo "4️⃣  Test de acceso directo por IP:"
curl -I http://$SERVER_IP/ 2>&1 | head -5
echo ""

echo "5️⃣  Test de acceso por dominio:"
curl -I http://infosalamanca.duckdns.org/ 2>&1 | head -5
echo ""
