# Dockerfile para Backend
FROM node:18-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar package*.json
COPY package*.json ./

# Instalar dependencias
RUN npm install --only=production

# Copiar código fuente
COPY src/ ./src/

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Cambiar ownership de los archivos
RUN chown -R nextjs:nodejs /app
USER nextjs

# Exponer puerto
EXPOSE 4000

# Comando de inicio
CMD ["npm", "start"]
