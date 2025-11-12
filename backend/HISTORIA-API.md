# API de Historia de Municipios

## Descripción General

El endpoint `/api/historia` proporciona acceso a información histórica detallada de los municipios de la provincia de Salamanca. Incluye datos sobre períodos históricos, monumentos, personajes ilustres, tradiciones, evolución urbana y bibliografía.

## Base URL
```
http://localhost:4000/api/historia
```

## Endpoints Disponibles

### 1. Obtener Historia de un Municipio

#### GET `/api/historia/:codIne`
Obtiene la información histórica completa de un municipio específico.

**Parámetros:**
- `codIne` (string, required): Código INE de 5 dígitos del municipio
- `resumen` (query, optional): Si es `true`, devuelve solo el resumen histórico

**Ejemplo de petición:**
```bash
curl "http://localhost:4000/api/historia/37274"
curl "http://localhost:4000/api/historia/37274?resumen=true"
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "cod_ine": "37274",
    "nombre_municipio": "Salamanca",
    "resumen_historico": "Salamanca, conocida como la 'Dorada'...",
    "periodos_historicos": [...],
    "monumentos_historicos": [...],
    "personajes_ilustres": [...],
    "leyendas_tradiciones": [...],
    "evolucion_urbana": [...],
    "tags_historicos": [...],
    "fuentes_bibliografia": [...],
    "publico": true,
    "validado": true
  },
  "metadata": {
    "tipo_respuesta": "completa",
    "fecha_consulta": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Búsqueda de Texto Completo

#### GET `/api/historia/buscar/texto`
Realiza búsquedas de texto completo en toda la información histórica.

**Parámetros de consulta:**
- `q` (string, required): Término de búsqueda (mínimo 3 caracteres)

**Ejemplo de petición:**
```bash
curl "http://localhost:4000/api/historia/buscar/texto?q=universidad"
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "cod_ine": "37274",
      "nombre_municipio": "Salamanca",
      "resumen_historico": "...",
      "score": 2.5
    }
  ],
  "metadata": {
    "consulta": "universidad",
    "total_resultados": 1,
    "fecha_consulta": "2024-01-15T10:30:00.000Z"
  }
}
```

### 3. Búsqueda por Período Histórico

#### GET `/api/historia/periodo/:periodo`
Obtiene municipios que tienen información sobre un período histórico específico.

**Parámetros:**
- `periodo` (string, required): Nombre del período histórico

**Ejemplo de petición:**
```bash
curl "http://localhost:4000/api/historia/periodo/medieval"
curl "http://localhost:4000/api/historia/periodo/Época Romana"
```

### 4. Búsqueda por Tags

#### GET `/api/historia/tags/:tags`
Busca municipios por tags históricos (separados por comas).

**Parámetros:**
- `tags` (string, required): Tags separados por comas

**Ejemplo de petición:**
```bash
curl "http://localhost:4000/api/historia/tags/universidad,medieval"
curl "http://localhost:4000/api/historia/tags/tradiciones"
```

### 5. Cronología de Eventos

#### GET `/api/historia/eventos/cronologia`
Obtiene eventos históricos dentro de un rango de fechas.

**Parámetros de consulta:**
- `inicio` (string, required): Año de inicio
- `fin` (string, required): Año de fin

**Ejemplo de petición:**
```bash
curl "http://localhost:4000/api/historia/eventos/cronologia?inicio=1200&fin=1500"
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "municipio": "Salamanca",
      "cod_ine": "37274",
      "evento": {
        "fecha": "1218",
        "descripcion": "Fundación de la Universidad de Salamanca",
        "tipo": "educativo"
      },
      "periodo": "Universidad Medieval"
    }
  ],
  "metadata": {
    "periodo": { "inicio": "1200", "fin": "1500" },
    "total_eventos": 5,
    "fecha_consulta": "2024-01-15T10:30:00.000Z"
  }
}
```

### 6. Estadísticas Generales

#### GET `/api/historia/estadisticas/generales`
Proporciona estadísticas generales sobre los datos históricos.

**Ejemplo de petición:**
```bash
curl "http://localhost:4000/api/historia/estadisticas/generales"
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "total_municipios": 5,
    "total_monumentos": 25,
    "total_personajes": 15,
    "municipios_validados": 3,
    "municipios_publicos": 5,
    "periodos_unicos": ["Medieval", "Época Romana", "Siglo de Oro"],
    "tags_mas_frecuentes": {
      "medieval": 3,
      "universidad": 1,
      "tradiciones": 2
    },
    "municipios_por_tags": {
      "medieval": 3,
      "universidad": 1
    }
  },
  "metadata": {
    "fecha_consulta": "2024-01-15T10:30:00.000Z"
  }
}
```

## Endpoints Administrativos

### 7. Crear/Actualizar Historia

#### POST `/api/historia/:codIne`
Crea o actualiza la información histórica de un municipio.

**Parámetros:**
- `codIne` (string, required): Código INE del municipio

**Cuerpo de la petición:**
```json
{
  "nombre_municipio": "Nombre del Municipio",
  "resumen_historico": "Resumen histórico...",
  "periodos_historicos": [...],
  "monumentos_historicos": [...],
  "publico": true,
  "validado": false
}
```

### 8. Eliminar Historia

#### DELETE `/api/historia/:codIne`
Elimina la información histórica de un municipio.

**Parámetros:**
- `codIne` (string, required): Código INE del municipio

## Estructura de Datos

### Documento de Historia Completo

```json
{
  "cod_ine": "37274",
  "nombre_municipio": "Salamanca",
  "resumen_historico": "Breve resumen histórico...",
  "periodos_historicos": [
    {
      "nombre": "Época Romana",
      "fecha_inicio": "-220",
      "fecha_fin": "409",
      "descripcion": "Descripción del período...",
      "personajes_relevantes": [...],
      "eventos_importantes": [
        {
          "fecha": "-220",
          "descripcion": "Conquista romana",
          "tipo": "militar"
        }
      ]
    }
  ],
  "monumentos_historicos": [
    {
      "nombre": "Catedral Vieja",
      "tipo": "religioso",
      "fecha_construccion": "1120-1200",
      "estilo": "románico-bizantino",
      "descripcion": "Primera catedral salmantina...",
      "importancia": "nacional"
    }
  ],
  "personajes_ilustres": [
    {
      "nombre": "Miguel de Unamuno",
      "profesion": "escritor, filósofo",
      "periodo_vida": "1864-1936",
      "conexion_salamanca": "Rector de la Universidad...",
      "relevancia": "Figura clave de la Generación del 98"
    }
  ],
  "leyendas_tradiciones": [
    {
      "nombre": "La Rana de la Universidad",
      "tipo": "tradición estudiantil",
      "descripcion": "Leyenda que dice...",
      "origen_aproximado": "siglo XVI",
      "vigencia_actual": true
    }
  ],
  "evolucion_urbana": [
    {
      "periodo": "Medieval",
      "descripcion": "Núcleo amurallado...",
      "caracteristicas": ["murallas medievales", "trazado irregular"]
    }
  ],
  "tags_historicos": ["universidad", "medieval", "romana"],
  "fuentes_bibliografia": [
    {
      "autor": "José Luis Martín Martín",
      "titulo": "Salamanca en la Edad Media",
      "año": 1985,
      "tipo": "libro"
    }
  ],
  "imagenes_historicas": [
    {
      "url": "/assets/historia/salamanca_medieval.jpg",
      "descripcion": "Grabado de Salamanca en el siglo XVI",
      "fecha_aproximada": "1550"
    }
  ],
  "publico": true,
  "validado": true,
  "fecha_ultima_actualizacion": "2024-01-15T00:00:00.000Z",
  "fuente_datos": "Archivo Histórico Provincial",
  "metadatos": {
    "completitud_datos": 85,
    "necesita_revision": false,
    "colaboradores": ["Departamento de Historia Medieval"]
  }
}
```

## Códigos de Respuesta

- **200**: Petición exitosa
- **400**: Petición inválida (parámetros incorrectos)
- **404**: Recurso no encontrado
- **500**: Error interno del servidor

## Códigos de Error Específicos

```json
{
  "error": "Código INE inválido",
  "message": "El código INE debe tener exactamente 5 dígitos"
}
```

```json
{
  "error": "Historia no encontrada",
  "message": "No se encontró información histórica para el municipio con código INE: 37999",
  "cod_ine": "37999"
}
```

```json
{
  "error": "Consulta inválida",
  "message": "La búsqueda debe tener al menos 3 caracteres"
}
```

## Instalación y Configuración

### 1. Poblar Base de Datos con Datos de Ejemplo

```bash
# Desde el directorio backend/
node poblar-historia.js
```

### 2. Ejecutar Pruebas del Endpoint

```bash
# Desde el directorio backend/
node test-historia-endpoint.js
```

### 3. Verificar Índices MongoDB

Los siguientes índices se crean automáticamente:
- `cod_ine`: Búsqueda por código INE
- `nombre_municipio`: Búsqueda por nombre
- `tags_historicos`: Búsqueda por tags
- `publico` y `validado`: Filtros de estado
- Índice de texto completo para búsquedas

## Ejemplos de Uso

### Frontend JavaScript

```javascript
// Obtener historia de Salamanca
const response = await fetch('/api/historia/37274');
const data = await response.json();
console.log(data.data.resumen_historico);

// Buscar municipios con "universidad"
const busqueda = await fetch('/api/historia/buscar/texto?q=universidad');
const resultados = await busqueda.json();
resultados.data.forEach(municipio => {
  console.log(municipio.nombre_municipio);
});
```

### Vue.js Integration

```javascript
// En un componente Vue.js
export default {
  data() {
    return {
      historia: null,
      loading: false
    }
  },
  methods: {
    async cargarHistoria(codIne) {
      this.loading = true;
      try {
        const response = await fetch(`/api/historia/${codIne}`);
        const data = await response.json();
        this.historia = data.data;
      } catch (error) {
        console.error('Error cargando historia:', error);
      } finally {
        this.loading = false;
      }
    }
  }
}
```

## Notas de Implementación

1. **MongoDB**: Usa MongoDB como base de datos con índices optimizados
2. **Búsqueda**: Implementa búsqueda de texto completo en español
3. **Validación**: Los datos pueden estar marcados como públicos/privados y validados
4. **Paginación**: Para grandes conjuntos de datos, considera implementar paginación
5. **Caché**: Considera implementar caché Redis para consultas frecuentes
6. **Autenticación**: Los endpoints POST/DELETE requieren autenticación en producción

## Extensiones Futuras

- [ ] Sistema de versionado de datos históricos
- [ ] API para subir imágenes históricas
- [ ] Sistema de comentarios y colaboración
- [ ] Exportación a diferentes formatos (PDF, XML)
- [ ] Integración con APIs externas de patrimonio
- [ ] Sistema de notificaciones para actualizaciones
