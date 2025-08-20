# Dockerfile obsoleto - Usar docker-compose.yml
# Este archivo ha sido reemplazado por:
# - backend/Dockerfile (para API)
# - frontend/Dockerfile (para frontend estático)
# - docker-compose.yml (para orquestación)
# 
# Para desplegar, usa:
# docker-compose up -d --build

FROM alpine:latest
RUN echo "⚠️  Este Dockerfile está obsoleto"
RUN echo "✅ Usa: docker-compose up -d --build"
CMD ["echo", "Usar docker-compose.yml para el despliegue"]
