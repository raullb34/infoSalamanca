# Dockerfile para Backend
FROM node:18-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar package*.json
COPY package*.json ./

# Instalar dependencias (usar ci para producción)
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeuser -u 1001

# Cambiar ownership de los archivos
RUN chown -R nodeuser:nodejs /app
USER nodeuser

# Exponer puerto
EXPOSE 4000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4000/api/health || exit 1

# Comando de inicio
CMD ["npm", "start"]
