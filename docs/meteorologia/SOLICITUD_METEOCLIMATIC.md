# Solicitud de autorización a Meteoclimatic

**Para:** Meteoclimatic, Societat d'Estudis del Temps i el Clima
**Contacto:** formulario de contacto de https://www.meteoclimatic.net/ (enlace "Contacto" del menú)

**De:** InfoSalamanca, https://infosalamanca.duckdns.org/
**Persona de contacto:** _[pendiente de completar]_
**Correo de contacto:** _[pendiente de completar]_

**Asunto:** Autorización para consultar automáticamente los hilos RSS de las estaciones de Salamanca

---

Hola:

InfoSalamanca es un proyecto **sin ánimo de lucro** que ofrece gratuitamente a los ciudadanos información
sobre los municipios de la provincia de Salamanca. Estamos preparando una sección "El tiempo en
Salamanca" y nos gustaría que las estaciones de la red Meteoclimatic de la provincia estuvieran presentes,
porque dan una cobertura local que no tienen las redes oficiales.

Hemos leído el aviso legal y entendemos que los contenidos y los datos que aportan las estaciones están
bajo la licencia **Creative Commons Reconocimiento-NoComercial-SinObraDerivada 3.0**. También hemos visto
que vuestro `robots.txt` no permite a los robots acceder a `/feed/`, que es donde están los hilos RSS/XML
que la documentación recomienda para el uso por programas. Por eso os pedimos permiso antes de usarlos.

**Lo que queremos hacer**

- Consultar el hilo RSS de la provincia (`/feed/rss/ESCYL37`): **una petición cada 15 minutos**, con un
  agente identificado (`infoSalamanca-bot/1.0 (+https://infosalamanca.duckdns.org)`).
- Mostrar en InfoSalamanca los valores de cada estación (temperatura, humedad, presión, viento y
  precipitación) **tal como los publicáis**, con el nombre de la estación, la hora de actualización, la
  atribución "Datos de Meteoclimatic" con enlace a la ficha de cada estación y a la licencia.
- Guardar esas lecturas para dibujar gráficos de evolución de cada estación en InfoSalamanca.

**Lo que no haremos**

- No haremos ningún uso comercial.
- No **redistribuiremos** los datos de Meteoclimatic en ficheros descargables ni los incluiremos en los
  conjuntos de datos abiertos que preparamos para la Junta de Castilla y León (la licencia NoComercial-
  SinObraDerivada no lo permite).
- No los presentaremos como mediciones oficiales: aparecerán identificados como estaciones de la red
  colaborativa Meteoclimatic.

**Mientras tanto**

Mientras tanto leemos la tabla pública de Castilla y León (`/mapinfo/ESCYL`, permitida por vuestro
`robots.txt`) una vez cada 30 minutos, y mostramos las estaciones de Salamanca con la atribución indicada.
Si preferís que no lo hagamos, lo dejamos de inmediato.

Si os parece bien, también nos gustaría saber si preferís otra frecuencia, otro formato (XML) o alguna
forma concreta de atribución.

Muchas gracias por el trabajo que hacéis con la red.

Un saludo,

_[nombre pendiente de completar]_
InfoSalamanca
