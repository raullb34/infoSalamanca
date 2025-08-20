# 🚀 Guía de Deployment - InfoSalamanca

Esta guía explica cómo desplegar InfoSalamanca en producción usando Docker Compose.

## 📋 Requisitos Previos

- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **Git** para clonar el repositorio
- **WSL** (recomendado para Windows)

## 🏗️ Arquitectura del Sistema

InfoSalamanca utiliza una arquitectura de microservicios con los siguientes componentes:

### Servicios Principales
- **Frontend** (Vue.js + Nginx): Aplicación web estática servida por nginx
- **Backend** (Node.js + Express): API REST para datos de municipios y eventos  
- **Langflow**: Sistema de IA conversacional (SaLLMantino)
- **MongoDB**: Base de datos principal
- **Redis**: Cache y sesiones
- **Nginx**: Reverse proxy y balanceador de carga

### Puertos y Rutas
- **Puerto 80**: Entrada principal (nginx reverse proxy)
- **Frontend**: `/` - Aplicación principal
- **Backend API**: `/api/` - Endpoints de la API
- **Langflow**: `/langflow/` - Interfaz de IA
- **MongoDB**: `27017` (interno)
- **Redis**: `6379` (interno)

## 🚀 Deployment Rápido

### 1. Clonar el Repositorio
```bash
git clone https://github.com/tu-usuario/infoSalamanca.git
cd infoSalamanca
```

### 2. Configurar Variables de Entorno

#### Frontend (.env.production)
```bash
# Crear archivo de entorno para producción
cat > frontend/.env.production << EOF
VITE_ENV=production
VITE_LANGFLOW_API_KEY=tu_clave_langflow_aqui
EOF
```

#### Backend (variables en docker-compose.yml)
Las variables del backend se configuran automáticamente en el `docker-compose.yml`:
- `MONGODB_URI`: Conexión a MongoDB
- `REDIS_URL`: Conexión a Redis  
- `NODE_ENV`: production

### 3. Deployment Automatizado

```bash
# Hacer el script ejecutable
chmod +x quick-deploy.sh

# Ejecutar deployment
./quick-deploy.sh
```

O manualmente:

```bash
# Parar servicios existentes
docker-compose down

# Construir imágenes
docker-compose build --no-cache backend frontend

# Iniciar todos los servicios
docker-compose up -d

# Verificar estado
docker-compose ps
```

## 🔧 Configuración Detallada

### Variables de Entorno

#### Desarrollo (frontend/.env.development)
```bash
VITE_ENV=development
VITE_BACKEND_HOST=localhost
VITE_BACKEND_PORT=4000
VITE_LANGFLOW_HOST=localhost
VITE_LANGFLOW_PORT=7860
VITE_LANGFLOW_API_KEY=tu_clave_langflow_aqui
```

#### Producción (frontend/.env.production)
```bash
VITE_ENV=production
VITE_LANGFLOW_API_KEY=tu_clave_langflow_aqui
```

> **Nota**: En producción, las URLs se gestionan automáticamente usando rutas relativas que nginx maneja.

### Configuración de Nginx

El archivo `nginx.conf` incluye:
- **Reverse proxy** para todos los servicios
- **Rate limiting** para protección contra ataques
- **Security headers** para seguridad
- **Soporte WebSocket** para Langflow
- **Compresión gzip** para optimización

### Configuración de Base de Datos

**MongoDB**:
- Usuario: `admin`
- Contraseña: `password123`
- Base de datos: `salamanca_db`
- Puerto interno: `27017`

**Redis**:
- Puerto interno: `6379`
- Sin autenticación en red interna

## 📊 Monitoreo y Logs

### Ver Estado de Servicios
```bash
docker-compose ps
```

### Ver Logs en Tiempo Real
```bash
# Todos los servicios
docker-compose logs -f

# Servicio específico
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f langflow
```

### Health Checks
```bash
# Frontend
curl http://localhost/

# Backend API
curl http://localhost/api/health

# Langflow
curl http://localhost/langflow/
```

## 🔧 Comandos de Mantenimiento

### Parar Servicios
```bash
docker-compose down
```

### Reiniciar un Servicio
```bash
docker-compose restart backend
```

### Reconstruir un Servicio
```bash
docker-compose build --no-cache backend
docker-compose up -d backend
```

### Limpiar Sistema
```bash
# Limpiar contenedores parados
docker container prune -f

# Limpiar imágenes no utilizadas
docker image prune -f

# Limpiar todo el sistema
docker system prune -f
```

## 🛡️ Seguridad

### Headers de Seguridad (configurados en nginx)
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: no-referrer-when-downgrade`
- Content Security Policy configurado

### Rate Limiting
- API: 10 requests/segundo con burst de 20
- General: 30 requests/segundo con burst de 50

### Red Interna
- Todos los servicios se comunican por red interna `app-network`
- Solo nginx expone puertos al exterior

## 🌐 URLs de Producción

Una vez desplegado, los servicios estarán disponibles en:

- **Aplicación Principal**: http://localhost/
- **API Backend**: http://localhost/api/
- **Langflow (SaLLMantino)**: http://localhost/langflow/

## 🆘 Solución de Problemas

### Problema: Contenedor no inicia
```bash
# Ver logs detallados
docker-compose logs servicio_problemático

# Reiniciar servicio
docker-compose restart servicio_problemático
```

### Problema: Error de conexión a base de datos
```bash
# Verificar que MongoDB esté corriendo
docker-compose ps mongodb

# Ver logs de MongoDB
docker-compose logs mongodb

# Reiniciar MongoDB
docker-compose restart mongodb
```

### Problema: Error 502 Bad Gateway
```bash
# Verificar que todos los servicios estén corriendo
docker-compose ps

# Verificar configuración de nginx
docker-compose logs nginx

# Reiniciar nginx
docker-compose restart nginx
```

### Problema: Frontend no se actualiza
```bash
# Reconstruir frontend sin cache
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

## 📱 Configuración para Producción en Servidor

### Para deployment en servidor remoto:

1. **Configurar dominio** en `nginx.conf`:
```nginx
server_name tu-dominio.com;
```

2. **Configurar HTTPS** con Let's Encrypt:
```bash
# Instalar certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d tu-dominio.com
```

3. **Variables de entorno de producción**:
```bash
# Actualizar frontend/.env.production con la clave real de Langflow
VITE_LANGFLOW_API_KEY=tu_clave_real_de_langflow
```

## 📚 Recursos Adicionales

- [Documentación de Docker Compose](https://docs.docker.com/compose/)
- [Documentación de Nginx](https://nginx.org/en/docs/)
- [Langflow Documentation](https://docs.langflow.org/)

---

**Última actualización**: Agosto 2025
**Versión**: 2.0 (con Langflow integrado)
