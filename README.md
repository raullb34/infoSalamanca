# InfoSalamanca - Mapa Interactivo de Municipios

Aplicación web interactiva que muestra información detallada sobre los municipios de la provincia de Salamanca, con asistente IA integrado.

## 🏗️ Arquitectura del Proyecto

```
infoSalamanca/
├── frontend/                 # Aplicación cliente (HTML, CSS, JS)
│   ├── src/
│   │   ├── index.html       # Página principal
│   │   ├── script.js        # Lógica del mapa interactivo
│   │   ├── styles.css       # Estilos
│   │   ├── assets/          # Recursos estáticos
│   │   │   ├── Limites_salamanca.svg
│   │   │   ├── flags/       # Banderas de municipios
│   │   │   ├── icons/       # Iconografía
│   │   │   └── helpers/     # Archivos auxiliares
│   │   ├── components/      # Componentes Vue.js
│   │   ├── services/        # Servicios API
│   │   ├── store/          # Gestión de estado (Pinia)
│   │   └── views/          # Vistas de la aplicación
│   ├── package.json
│   └── Dockerfile
├── backend/                  # API servidor
│   ├── src/
│   │   ├── app.js          # Entrada principal
│   │   ├── config/         # Configuración
│   │   ├── controllers/    # Controladores API
│   │   ├── models/         # Modelos de datos
│   │   ├── routes/         # Rutas API
│   │   ├── services/       # Servicios de negocio
│   │   └── SaLLMantino/    # Scripts Python y datos
│   │       └── ragger/
│   │           └── script/
│   │               ├── municipios_md/    # Datos de municipios (362 archivos)
│   │               ├── villages_wiki.py  # Scraper de Wikipedia
│   │               └── file_eraser.py    # Utilidades
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml        # Orquestación de contenedores
├── nginx.conf               # Configuración del proxy
├── package.json            # Configuración workspace
└── README.md               # Este archivo
```

## 🚀 Inicio Rápido

### Opción 1: Docker (Recomendado)

```bash
# Clonar repositorio
git clone <tu-repo-url>
cd infoSalamanca

# Construir y ejecutar con Docker
npm run docker:build
npm run docker:up
```

La aplicación estará disponible en:
- **Frontend**: http://localhost:80
- **Backend API**: http://localhost:3001
- **Proxy completo**: http://localhost:8080

### Opción 2: Desarrollo Local

```bash
# Instalar dependencias en todos los proyectos
npm run install:all

# Ejecutar en modo desarrollo (frontend + backend)
npm run dev
```

## 📦 Scripts Disponibles

### Proyecto Principal
- `npm run dev` - Ejecuta frontend y backend en desarrollo
- `npm run start` - Ejecuta en modo producción
- `npm run install:all` - Instala dependencias en todos los subproyectos
- `npm run docker:build` - Construye imágenes Docker
- `npm run docker:up` - Levanta todos los servicios
- `npm run docker:down` - Detiene todos los servicios

### Frontend
- `npm run dev` - Servidor de desarrollo (live-server)
- `npm run start` - Servidor de producción
- `npm run build` - Construir para producción

### Backend
- `npm run start` - Ejecutar servidor
- `npm run dev` - Servidor con auto-reload (nodemon)

## 🗄️ Base de Datos

### Datos de Municipios
El proyecto incluye **362 archivos markdown** con información detallada de cada municipio:
- Superficie, población, altitud
- Historia y toponimia
- Símbolos heráldicos
- Información geográfica y demográfica
- **Estimación**: ~1.37 millones de tokens de contenido

### Servicios de Datos
- **MongoDB**: Almacenamiento principal
- **Redis**: Cache y sesiones
- **Scripts Python**: Procesamiento y scraping de datos

## 🔧 Configuración

### Variables de Entorno (Backend)
```env
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb://admin:password123@mongodb:27017/salamanca_db?authSource=admin
REDIS_URL=redis://redis:6379
```

### Puertos por Defecto
- Frontend: 3000 (dev) / 80 (prod)
- Backend: 3001
- MongoDB: 27017
- Redis: 6379
- Nginx Proxy: 8080

## 🐳 Docker Services

- **frontend**: Nginx sirviendo archivos estáticos
- **backend**: API Node.js/Express
- **mongodb**: Base de datos MongoDB 7
- **redis**: Cache Redis 7
- **nginx-proxy**: Proxy reverso para enrutamiento

## 🛠️ Tecnologías

### Frontend
- HTML5, CSS3, JavaScript ES6+
- Vue.js 3 (componentes)
- Pinia (gestión de estado)
- Axios (HTTP client)
- SVG interactivo para el mapa

### Backend
- Node.js + Express.js
- MongoDB + Mongoose
- Redis para cache
- Python scripts para procesamiento de datos

### DevOps
- Docker & Docker Compose
- Nginx (proxy reverso)
- Workspaces npm

## 📈 Próximas Mejoras

- [ ] Integración completa con Vue.js
- [ ] API REST completa para municipios
- [ ] Búsqueda y filtros avanzados
- [ ] Sistema de rutas turísticas
- [ ] Integración con SaLLMantino (asistente IA)
- [ ] Tests automatizados
- [ ] CI/CD pipeline

## 🤝 Contribuir

1. Fork del proyecto
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Añadir nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📄 Licencia

ISC License - ver archivo LICENSE para detalles.

---

**Autor**: raullb34  
**Proyecto**: Mapa Interactivo de Salamanca con IA
