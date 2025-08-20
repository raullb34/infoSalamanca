# 🚀 Guía de Despliegue - InfoSalamanca

## Arquitectura de Producción

```
Internet
    ↓
┌─────────────┐
│   Nginx     │ (Puerto 80/443)
│  (Proxy)    │
└─────────────┘
    ↓       ↓
┌─────────┐ ┌─────────┐
│Frontend │ │Backend  │
│(Static) │ │  (API)  │
└─────────┘ └─────────┘
    ↓       ↓
┌─────────┐ ┌─────────┐
│MongoDB  │ │ Redis   │
│(Database│ │(Cache)  │
└─────────┘ └─────────┘
```

## Servicios Configurados

### 🌐 **Frontend** (Nginx + Vue.js)
- **Puerto**: 80 (interno)
- **Tecnología**: Vue 3 + Vite compilado estáticamente
- **Características**: 
  - Build optimizado para producción
  - Gzip compression
  - Cache de archivos estáticos (1 año)
  - SPA routing configurado

### ⚙️ **Backend** (Node.js + Express)
- **Puerto**: 4000 (interno)
- **Endpoints**:
  - `/api/health` - Health check
  - `/api/towns` - Municipios
  - `/api/gastro` - Gastronomía
- **Características**:
  - Usuario no-root para seguridad
  - Health checks configurados
  - Rate limiting implementado

### 🔄 **Nginx** (Reverse Proxy)
- **Puerto**: 80 (externo)
- **Funciones**:
  - Proxy reverso para frontend y backend
  - Rate limiting (API: 10req/s, General: 30req/s)
  - Security headers
  - Gzip compression
  - Cache inteligente

### 🗄️ **MongoDB** (Base de Datos)
- **Puerto**: 27017 (interno)
- **Usuario**: admin / password123
- **Base de datos**: salamanca_db
- **Persistencia**: Volume `mongodb_data`

### ⚡ **Redis** (Cache)
- **Puerto**: 6379 (interno)
- **Persistencia**: Volume `redis_data`

## 🛠 Comandos de Despliegue

### Construcción e Inicio
```bash
# Construir todas las imágenes
./deploy.sh build

# Iniciar todos los servicios
./deploy.sh start

# Build + Start en un comando
docker-compose up -d --build
```

### Gestión de Servicios
```bash
# Ver estado de los servicios
./deploy.sh status

# Ver logs en tiempo real
./deploy.sh logs

# Reiniciar servicios
./deploy.sh restart

# Detener servicios
./deploy.sh stop
```

### Verificación y Mantenimiento
```bash
# Verificar salud de todos los servicios
./deploy.sh health

# Limpiar contenedores e imágenes no utilizadas
./deploy.sh clean
```

## 🔍 Verificación del Despliegue

### 1. **Verificar que todos los servicios estén corriendo**
```bash
docker-compose ps
```
Todos los servicios deben aparecer como "Up".

### 2. **Probar los endpoints**
```bash
# Frontend
curl http://localhost/

# API Health
curl http://localhost/api/health

# Endpoint de municipios
curl http://localhost/api/towns
```

### 3. **Verificar logs**
```bash
# Logs de todos los servicios
docker-compose logs

# Logs específicos
docker-compose logs nginx
docker-compose logs backend
docker-compose logs frontend
```

## 🌍 Configuración para Servidor en Producción

### Requisitos del Servidor
- **Sistema**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **RAM**: Mínimo 2GB, recomendado 4GB+
- **CPU**: 2 cores mínimo
- **Disco**: 20GB disponibles
- **Software**: Docker 20.10+ y Docker Compose 2.0+

### Configuración SSL (Opcional)
Para HTTPS, modifica `nginx.conf` añadiendo:
```nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/ssl/certs/your-cert.pem;
    ssl_certificate_key /etc/ssl/private/your-key.pem;
    
    # Resto de la configuración...
}
```

### Variables de Entorno
Copia `.env.example` a `.env` y ajusta las variables según tu entorno:
```bash
cp .env.example .env
```

### Firewall
Asegúrate de abrir los puertos necesarios:
```bash
# Ubuntu/Debian
sudo ufw allow 80
sudo ufw allow 443

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

## 🔧 Solución de Problemas

### Frontend no carga
1. Verificar que nginx esté corriendo: `docker-compose logs nginx`
2. Comprobar el build del frontend: `docker-compose logs frontend`
3. Verificar la configuración nginx: `docker exec -it infosalamanca-nginx nginx -t`

### API no responde
1. Verificar logs del backend: `docker-compose logs backend`
2. Comprobar conectividad: `curl http://localhost/api/health`
3. Verificar conexión a MongoDB: logs del backend mostrarán errores de conexión

### Base de datos no conecta
1. Verificar que MongoDB esté corriendo: `docker-compose logs mongodb`
2. Comprobar las credenciales en el backend
3. Verificar la red Docker: `docker network ls`

### Performance Issues
1. Verificar recursos: `docker stats`
2. Comprobar logs de nginx para errores 502/503
3. Verificar rate limiting si hay muchas peticiones

## 📊 Monitoreo

### Health Checks Disponibles
- **Nginx**: `http://localhost/health`
- **Backend**: `http://localhost/api/health`
- **MongoDB**: Através de Docker health checks
- **Redis**: A través de Docker health checks

### Métricas Útiles
```bash
# Uso de recursos
docker stats

# Estado de los contenedores
docker-compose ps

# Logs de errores
docker-compose logs | grep -i error
```

## 🎯 Endpoints Principales

- **Frontend**: http://localhost/
- **API Base**: http://localhost/api/
- **Health Check**: http://localhost/health
- **API Health**: http://localhost/api/health
- **Municipios**: http://localhost/api/towns
- **Gastronomía**: http://localhost/api/gastro

¡El sistema está listo para producción! 🚀
