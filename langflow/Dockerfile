# Dockerfile para Langflow (SaLLMantino)
FROM langflowai/langflow:latest

# Establecer directorio de trabajo
WORKDIR /app

# Exponer el puerto de Langflow
EXPOSE 7860

# Variables de entorno
ENV LANGFLOW_HOST=0.0.0.0
ENV LANGFLOW_PORT=7860

# Comando de inicio
CMD ["langflow", "run", "--host", "0.0.0.0", "--port", "7860"]
