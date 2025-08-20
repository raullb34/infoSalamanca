#!/bin/bash

# Script de despliegue para InfoSalamanca
# Uso: ./deploy.sh [build|start|stop|restart|logs|status]

set -e

PROJECT_NAME="infosalamanca"
COMPOSE_FILE="docker-compose.yml"

function print_usage() {
    echo "Uso: $0 [build|start|stop|restart|logs|status|clean]"
    echo ""
    echo "Comandos:"
    echo "  build    - Construir todas las imágenes"
    echo "  start    - Iniciar todos los servicios"
    echo "  stop     - Detener todos los servicios"
    echo "  restart  - Reiniciar todos los servicios"
    echo "  logs     - Mostrar logs de todos los servicios"
    echo "  status   - Mostrar estado de los servicios"
    echo "  clean    - Limpiar contenedores e imágenes no utilizadas"
    echo "  health   - Verificar el estado de salud de los servicios"
}

function build_services() {
    echo "🔨 Construyendo imágenes..."
    
    # Limpiar builds anteriores si fallan
    echo "🧹 Limpiando contenedores existentes..."
    docker-compose -f $COMPOSE_FILE down 2>/dev/null || true
    
    # Build con --no-cache para asegurar builds limpios
    echo "📦 Construyendo backend..."
    docker-compose -f $COMPOSE_FILE build --no-cache backend
    
    echo "📦 Construyendo frontend..."
    docker-compose -f $COMPOSE_FILE build --no-cache frontend
    
    echo "✅ Construcción completada"
}

function start_services() {
    echo "🚀 Iniciando servicios..."
    docker-compose -f $COMPOSE_FILE up -d
    echo "✅ Servicios iniciados"
    echo ""
    echo "🌐 Aplicación disponible en:"
    echo "   Frontend: http://localhost"
    echo "   API: http://localhost/api/"
    echo "   Health: http://localhost/health"
}

function stop_services() {
    echo "🛑 Deteniendo servicios..."
    docker-compose -f $COMPOSE_FILE down
    echo "✅ Servicios detenidos"
}

function restart_services() {
    echo "🔄 Reiniciando servicios..."
    stop_services
    start_services
}

function show_logs() {
    echo "📋 Mostrando logs..."
    docker-compose -f $COMPOSE_FILE logs -f --tail=100
}

function show_status() {
    echo "📊 Estado de los servicios:"
    docker-compose -f $COMPOSE_FILE ps
    echo ""
    echo "💾 Uso de recursos:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
}

function clean_docker() {
    echo "🧹 Limpiando Docker..."
    docker system prune -f
    docker volume prune -f
    echo "✅ Limpieza completada"
}

function check_health() {
    echo "🏥 Verificando estado de salud..."
    
    echo "Nginx (Frontend):"
    curl -f http://localhost/health 2>/dev/null && echo " ✅ OK" || echo " ❌ ERROR"
    
    echo "Backend API:"
    curl -f http://localhost/api/health 2>/dev/null && echo " ✅ OK" || echo " ❌ ERROR"
    
    echo "MongoDB:"
    docker-compose exec mongodb mongosh --eval "db.adminCommand('ismaster')" >/dev/null 2>&1 && echo " ✅ OK" || echo " ❌ ERROR"
    
    echo "Redis:"
    docker-compose exec redis redis-cli ping >/dev/null 2>&1 && echo " ✅ OK" || echo " ❌ ERROR"
}

# Verificar si Docker está ejecutándose
if ! docker info >/dev/null 2>&1; then
    echo "❌ Error: Docker no está ejecutándose"
    exit 1
fi

# Verificar si docker-compose está disponible
if ! command -v docker-compose >/dev/null 2>&1; then
    echo "❌ Error: docker-compose no está instalado"
    exit 1
fi

# Manejar comandos
case "${1:-help}" in
    "build")
        build_services
        ;;
    "start")
        start_services
        ;;
    "stop")
        stop_services
        ;;
    "restart")
        restart_services
        ;;
    "logs")
        show_logs
        ;;
    "status")
        show_status
        ;;
    "clean")
        clean_docker
        ;;
    "health")
        check_health
        ;;
    "help"|*)
        print_usage
        ;;
esac
