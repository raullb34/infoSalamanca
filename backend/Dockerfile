# Dockerfile para Backend
FROM node:18-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar package.json
COPY package.json ./

# Instalar dependencias para producción
# Nota: Usar install ya que no tenemos package-lock.json
RUN npm install --omit=dev --no-audit --no-fund && \
    npm cache clean --force

# Copiar código fuente
COPY . .

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs

# Cambiar ownership de los archivos
RUN chown -R nodeuser:nodejs /app

# Cambiar a usuario no-root
USER nodeuser

# Exponer puerto
EXPOSE 4000

# Comando de inicio
CMD ["npm", "start"]
