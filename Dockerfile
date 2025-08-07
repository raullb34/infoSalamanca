# Dockerfile unificado para InfoSalamanca
FROM node:18-alpine

WORKDIR /app

# Copiar package.json files
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Instalar dependencias del backend
WORKDIR /app/backend
RUN npm install

# Instalar dependencias del frontend
WORKDIR /app/frontend
RUN npm install

# Copiar código fuente
WORKDIR /app
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Build del frontend
WORKDIR /app/frontend
RUN npm run build

# Crear script de inicio
WORKDIR /app
RUN echo '#!/bin/sh' > start.sh && \
    echo 'echo "Iniciando backend en puerto $BACKEND_PORT..."' >> start.sh && \
    echo 'cd /app/backend && PORT=$BACKEND_PORT npm start &' >> start.sh && \
    echo 'echo "Iniciando frontend en puerto $PORT..."' >> start.sh && \
    echo 'cd /app/frontend && npm start &' >> start.sh && \
    echo 'wait' >> start.sh && \
    chmod +x start.sh

# Exponer puertos
EXPOSE 3000 4000

CMD ["./start.sh"]
