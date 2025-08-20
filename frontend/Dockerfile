# Dockerfile del Frontend - Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar package.json
COPY package.json ./

# Instalar dependencias con npm install (package-lock.json está vacío)
RUN npm install --no-audit --no-fund

# Copiar código fuente
COPY . .

# Build de producción
RUN npm run build

# Stage de producción con nginx
FROM nginx:alpine

# Copiar archivos compilados desde el stage builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuración de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto
EXPOSE 80

# Comando de inicio
CMD ["nginx", "-g", "daemon off;"]
