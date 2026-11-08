# infoSalamanca: revisión y propuesta de mejoras (8 nov 2026)

## 1. Qué hay hoy (revisado en https://infosalamanca.duckdns.org)

**Funciona bien**
- Mapa SVG de los 362 municipios, buscador, modo claro/oscuro.
- Ficha de municipio: población, CP, coordenadas, mancomunidades y entidades locales menores.
- Eventos (agenda cultural JCyL + Diputación) y "¿Qué ver?" (monumentos JCyL) con "Añadir a ruta".
- Ya existe base para varias de tus ideas: `HistoryTimeline.vue`, una API `/api/history/*` (cronología, periodos, tags), 362 fichas de Wikipedia en `SaLLMantino/ragger/script/municipios_md/` y endpoints de fiestas y carteles.

**Fallos encontrados**

| # | Problema | Dónde se ve | Arreglo |
|---|---|---|---|
| 1 | El chatbot (la rana) apunta a Langflow, que ya no existe | Botón SaLLMantino | Ocultarlo hasta tener el asesor nuevo (§2.3) |
| 2 | Se muestran eventos pasados (Ciudad Rodrigo, 7 nov, vista el 8) y sin ordenar | Ficha → Eventos | Filtrar `fecha >= hoy` y ordenar por fecha en `/events/combined` |
| 3 | Cada llamada a la API se hace 2 veces (`/info`, `/events/combined`, `/pois`) | Pestaña Red | Revisar los `watch` / `onMounted` duplicados en `TownSidebar.vue` |
| 4 | Banderas y escudos: el front prueba hasta 8 nombres de archivo por municipio y casi todos dan 404. Solo hay 96 banderas y 110 escudos para 362 municipios | Consola | Generar un `manifest.json` (`cod_ine → {bandera, escudo}`) y rellenar los huecos con Wikimedia Commons (el wikitexto ya trae `escudo = Escudo_de_X.svg`) |
| 5 | En móvil desaparece el buscador y los municipios pequeños no se pueden tocar | Vista 375 px | Buscador siempre visible, zoom/pan (pinch) en el mapa, ficha como hoja inferior |
| 6 | El título de la ficha se corta bajo el buscador ("VEGUILLAS") | Escritorio, panel derecho | Ajustar `z-index` / margen superior |
| 7 | La ficha no muestra la historia de Wikipedia que ya está descargada | Ficha | Sección "Historia" con el resumen de `municipios_md` |
| 8 | El backend no usa Mongo (`mongoose.connect` comentado) | `/api/health` | Decidir: o se quita Mongo, o se conecta (lo necesitan §2.2 y §2.4) |

Antes de añadir nada nuevo: quitar `password123` y no volver a publicar puertos (ver `VPS-ESTADO-2026-11-08.md`).

## 2. Tus ideas, aterrizadas

Orden recomendado: **2.1 → 2.2 → 2.3 → 2.4**. La línea del tiempo es la que más aprovecha lo que ya existe. El asesor por mensajería es la que más infraestructura pide.

### 2.1 Línea del tiempo: cómo cambia cada territorio

Ya hay `HistoryTimeline.vue` y `/api/history/events/chronology`, pero con datos de ejemplo. Propuesta en tres capas:

1. **Población desde 1842**: el INE publica las *Alteraciones de los municipios en los Censos de Población desde 1842* y el Padrón continuo. Con eso se puede:
   - mostrar en cada ficha una gráfica de población;
   - colorear el mapa con un **slider de años** (1900, 1950, 1981, 2024) para ver la despoblación de la provincia de un vistazo;
   - mostrar fusiones de municipios y cambios de nombre (también vienen en ese fichero).
2. **Imagen aérea antigua frente a actual**: el IGN/CNIG ofrece servicios WMS de ortofotos históricas (vuelo americano 1956-57, Interministerial 1973-86) y del PNOA actual. Un **deslizador antes/después** sobre el pueblo enseña muy bien cómo ha cambiado el territorio (regadíos, embalses como Almendra o Santa Teresa, polígonos). Bastaría con Leaflet + WMS, sin almacenar nada.
3. **Hitos históricos**: sacarlos de la sección de historia de cada `municipios_md` (con un LLM, una sola vez, revisando a mano los de los pueblos grandes) y de Wikidata (fundación, fueros, batallas como Arapiles o la del Fuerte de la Concepción).

Primer paso pequeño: una gráfica de población 1842-2024 en la ficha, con datos del INE en un JSON estático.

### 2.2 Carrusel de memoria: fotos y audios de la provincia

Hay dos fuentes, y conviene separarlas desde el principio:

**a) Archivos abiertos** (sin moderación, pero respetando la licencia de cada pieza):
- **Europeana API**, que agrega Hispana y la Biblioteca Digital de Castilla y León: fotos antiguas, postales y grabados, filtrables por licencia (`reusability=open`).
- **Wikimedia Commons**: categorías por municipio (`Category:<Municipio>, Salamanca`).
- **Audio tradicional**: el Fondo de Música Tradicional del CSIC (musicatradicional.eu) y la Fundación Joaquín Díaz tienen grabaciones de campo de Salamanca. Hay que revisar las condiciones de uso de cada uno: en algunos casos solo se podrá enlazar, no incrustar.

**b) Aportaciones de la gente** (lo más valioso: fotos de familia, audios de abuelos contando cosas):
- Formulario por municipio: subir foto o audio con año aproximado, lugar, quién sale y licencia (CC BY por defecto).
- **Moderación obligatoria antes de publicar**, por derechos de imagen, menores y datos personales. Cola de revisión sencilla para ti.
- Almacenamiento en el Supabase que ya tienes (Storage + una tabla), no en el disco del contenedor.

Interfaz: en cada ficha, un carrusel "Memoria de <pueblo>" con la foto, el año y la fuente, y el audio con transcripción. A nivel provincia, un modo "un día como hoy" o "aleatorio".

Primer paso pequeño: un carrusel en solo lectura con Wikimedia Commons y Europeana para 5 pueblos.

### 2.3 Asesor cultural (chatbot) y recordatorios

**Decisión (8 nov 2026): RAG ligero y sin coste, sin Langflow ni base vectorial, y sin modelo local en el VPS.**

**a) Búsqueda: SQLite FTS5 en el backend (coste cero)**
- Un único fichero `data/rag.sqlite` con una tabla FTS5 (`cod_ine`, `municipio`, `tipo`, `titulo`, `texto`), con tokenizer `unicode61 remove_diacritics 2` para que "Bejar" encuentre "Béjar".
- Se llena con un script `scripts/build-index.js`: las 362 fichas `municipios_md` troceadas por secciones (Historia, Monumentos, Fiestas…), los POIs y los eventos. Los eventos se reindexan con el cron diario.
- Consulta: si la pregunta menciona un municipio (se detecta con la lista de `/api/towns/list`), se filtra primero por `cod_ine` y luego se hace `MATCH` con ranking BM25. Se devuelven de 5 a 8 fragmentos.
- Librería: `better-sqlite3`, que trae FTS5. No necesita servicio aparte, ocupa pocos MB de RAM y responde en milisegundos.
- **Más adelante, solo si hace falta**: embeddings calculados **una vez en el PC** con `multilingual-e5-small` y guardados en el mismo SQLite con `sqlite-vec`. En el VPS solo se busca.

**b) Redacción: LLM con nivel gratuito y alternativa sin LLM**
- `/api/chat` envía la pregunta y los fragmentos a un proveedor con nivel gratuito: **Groq** o **Gemini (Google AI Studio)**. OpenRouter con modelos `:free` queda como segunda opción.
- Las llaves van en `.env`. Nunca en el front ni en el repo.
- Prompt: "responde solo con estos fragmentos; si no está, dilo", citando la fuente (Wikipedia, JCyL o Diputación).
- **Alternativa**: si se acaba el cupo o la API falla, se responde con una plantilla y los fragmentos encontrados ("Próximos eventos en Béjar: …", "Sobre la historia de Mogarraz: …"). Así nunca se queda sin contestar.
- Antes de elegir, revisar las condiciones del nivel gratuito: algunos usan los datos para entrenar y los límites cambian. No enviar datos personales.
- Límites propios: rate limit por IP en `/api/chat` y caché de las preguntas repetidas.

**c) Difusión por WhatsApp: comunidad gestionada a mano, con ayuda automática**
- Crear una **Comunidad de WhatsApp "InfoSalamanca"** con un grupo de avisos general y **un grupo por comarca** (Sierra de Francia, Campo Charro, Béjar, Ciudad Rodrigo, Las Arribes, La Armuña, Peñaranda…). Como alternativa, un **Canal de WhatsApp** de solo difusión.
  - Es gratis y no hace falta verificar ningún negocio ni aprobar plantillas.
- **No usar librerías no oficiales** (whatsapp-web.js, Baileys): van contra las condiciones de WhatsApp y pueden acabar con el número bloqueado.
- **Flujo semiautomático**:
  1. Un cron en el VPS (lunes 8:00) genera el resumen semanal de cada comarca desde la API: eventos de los próximos 7 días y fiestas.
  2. Publica los textos en una página interna `/admin/difusion` (protegida) con un botón "Copiar" por comarca, y te avisa por correo o Telegram.
  3. Tú pegas cada texto en su grupo de WhatsApp. Son unos 10 segundos por grupo.
- Cada texto acaba con un enlace a la ficha del pueblo en la web.
- Los **avisos personales** ("avísame de las fiestas de Mogarraz") necesitan mensajes uno a uno: más adelante con un bot de Telegram, que es gratis. La WhatsApp Cloud API solo tendría sentido si hay mucho uso.

Primer paso pequeño: `build-index.js` + `/api/search?q=` (solo FTS5, sin LLM) para comprobar que los fragmentos que salen son buenos.

### 2.4 Recuperar juegos antiguos

Dos enfoques que encajan bien:
- **Catálogo de juegos tradicionales** por comarca: calva, tanga/chito, rayuela, peonza, bolos, juegos de corro y canciones. Cada uno con reglas, nombre local, municipios donde se jugaba, foto o vídeo (de §2.2) y audio de las canciones.
- **Juegos jugables en la web** para niños y escuelas: un quiz "¿De qué pueblo es esta bandera / este monumento?" (ya tienes banderas, escudos y POIs), "Adivina el pueblo por su silueta" en el mapa, y algún juego de mesa tradicional digitalizado (alquerque, tres en raya de piedras). Tu experiencia con Tabú (juegosmonos) se puede reutilizar aquí.

Primer paso pequeño: el quiz de banderas y escudos, que solo usa datos que ya tienes.

### 2.5 Estética "showroom": mapa 3D y scroll narrativo

Inspirado en webs de producto en 3D (Blender + Three.js). Hay un prototipo en `prototipos/salamanca-en-relieve/`.
- Provincia en 3D con los municipios elevados por su altitud real (de las fichas de Wikipedia). Un botón cambia a población.
- Portada con scroll que vuela por capítulos (Arribes, frontera, Sierra de Francia, dehesa, capital).
- Banderas ondeando como tela (shader), que es el equivalente a las camisetas del reel.
- Ideas siguientes: vitrina 3D de patrimonio (botón charro, traje charro, la rana), relieve real con el MDT del IGN,
  y el slider de años de la línea del tiempo sobre este mismo mapa.
- Siempre con el mapa 2D como alternativa (sin WebGL o con "reducir movimiento") y carga diferida para móviles modestos.

## 3. Fuentes abiertas: resumen

| Fuente | Para qué | Estado |
|---|---|---|
| Datos abiertos JCyL (agenda cultural, monumentos, bibliotecas, Tierra de Sabor) | Eventos, POIs | Ya integrada |
| datosabiertossalamanca.es | Datos del Ayuntamiento | Ya integrada |
| Agenda de la Diputación | Eventos | Ya integrada |
| Wikipedia (362 fichas) | Historia y ficha | Descargada, no se muestra |
| INE: censos desde 1842 y Padrón | Línea del tiempo de población | Nueva |
| IGN/CNIG: WMS de ortofotos históricas y PNOA | Antes/después del territorio | Nueva |
| Wikidata (SPARQL) | Hitos, escudos, imágenes, coordenadas | Nueva |
| Wikimedia Commons | Fotos, escudos y banderas que faltan | Nueva |
| Europeana / Hispana / BDCyL | Fotos antiguas, postales, documentos | Nueva |
| Fondo de Música Tradicional (CSIC), Fundación Joaquín Díaz | Audio tradicional | Nueva (revisar licencias) |

## 4. Orden de trabajo propuesto

1. **Arreglos rápidos (1-2 días)**: fallos 1 a 7 de la tabla.
2. **Línea del tiempo v1**: gráfica de población del INE en la ficha y slider de años en el mapa.
3. **Carrusel v1**: Commons y Europeana en solo lectura.
4. **Búsqueda v1**: índice SQLite FTS5 y `/api/search`, sin LLM.
5. **Comunidad de WhatsApp**: crear la comunidad y los grupos por comarca, más el cron del resumen semanal en `/admin/difusion`.
6. **Asesor v1**: `/api/chat` con FTS5 y un LLM gratuito (Groq o Gemini), con respuesta por plantilla si falla, y volver a activar la rana.
7. **Aportaciones ciudadanas** con moderación, guardadas en Supabase.
8. **Juegos**: quiz de banderas y catálogo de juegos tradicionales.
9. Antes/después con ortofotos del IGN, y bot de Telegram para los avisos personales cuando lo anterior tenga uso.
