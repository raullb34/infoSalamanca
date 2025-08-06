# 🚂 Railway Deployment Guide

## Configuración en Railway

### 1. Backend Service
```bash
# Variables de entorno requeridas en Railway:
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/salamanca_db
NODE_ENV=production

# Puerto se configura automáticamente por Railway
```

### 2. Frontend Service  
```bash
# Variables de entorno opcionales:
VITE_API_BASE_URL=https://your-backend-url.railway.app/api
```

### 3. Database
- Usar MongoDB Atlas (recomendado)
- O MongoDB service en Railway

## Despliegue

1. **Conectar repositorio a Railway**
2. **Crear 2 servicios separados:**
   - `backend/` → Backend Service
   - `frontend/` → Frontend Service
3. **Configurar variables de entorno**
4. **Deploy automático** ✅

## Health Checks
- Backend: `https://your-backend.railway.app/health`
- Frontend: `https://your-frontend.railway.app/`
