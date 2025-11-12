# Configuración de Langflow (SaLLMantino)

## Problema
El servicio de Langflow requiere una imagen Docker personalizada (`infosalamanca-sallmantino:latest`) que debe estar construida localmente en el servidor de producción.

## Solución

### Opción 1: Si tienes el Dockerfile de Langflow

Si tienes el código fuente y Dockerfile de Langflow en una carpeta (por ejemplo `./langflow/`), construye la imagen:

```bash
docker build -t infosalamanca-sallmantino:latest ./path/to/langflow
```

### Opción 2: Usar Langflow oficial

Si no tienes una imagen personalizada, puedes usar la imagen oficial de Langflow:

1. Edita `docker-compose.yml` y cambia:
```yaml
langflow:
  image: infosalamanca-sallmantino:latest
  pull_policy: never
```

Por:
```yaml
langflow:
  image: langflowai/langflow:latest
  pull_policy: always
```

2. Redeploy con `./quick-deploy.sh`

### Opción 3: Exportar/Importar imagen desde local

Si la imagen existe en tu máquina local, expórtala y súbela al servidor:

**En tu máquina local:**
```bash
docker save infosalamanca-sallmantino:latest | gzip > sallmantino.tar.gz
```

**En el servidor:**
```bash
# Transferir el archivo (vía scp, rsync, etc)
scp sallmantino.tar.gz user@server:/path/to/infosalamanca/

# Cargar la imagen
docker load < sallmantino.tar.gz
```

### Opción 4: Deshabilitar Langflow temporalmente

Si no necesitas Langflow ahora mismo, coméntalo en `docker-compose.yml`:

```yaml
# langflow:
#   image: infosalamanca-sallmantino:latest
#   ...
```

Y también elimina la dependencia en nginx:
```yaml
nginx:
  depends_on:
    - frontend
    - backend
    # - langflow
```

## Verificación

Después de construir/cargar la imagen, verifica que existe:

```bash
docker images | grep sallmantino
```

Deberías ver:
```
infosalamanca-sallmantino   latest   [IMAGE_ID]   [SIZE]
```

Luego ejecuta el deploy:
```bash
./quick-deploy.sh
```
