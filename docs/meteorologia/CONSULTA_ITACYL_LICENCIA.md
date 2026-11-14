# Consulta a ITACyL sobre la licencia de los datos de InfoRiego

**Para:** Subdirección de Infraestructuras Agrarias, Instituto Tecnológico Agrario de Castilla y León (ITACyL)
**Correo:** inforiego@itacyl.es
**Teléfono (referencia):** 983 412 802
**Dirección:** Carretera Burgos-Portugal, km 119, Valladolid

**De:** InfoSalamanca, https://infosalamanca.duckdns.org/
**Persona de contacto:** _[pendiente de completar]_
**Correo de contacto:** _[pendiente de completar]_

**Asunto:** Licencia aplicable a los datos meteorológicos de la red InfoRiego y su redistribución normalizada

---

Estimados señores:

InfoSalamanca es un proyecto sin ánimo de lucro que ofrece a los ciudadanos información gratuita sobre los
municipios de la provincia de Salamanca a partir de datos abiertos. Estamos incorporando un servicio
meteorológico con observaciones de estaciones de la provincia, entre ellas las de la red InfoRiego, que
obtenemos de los ficheros publicados en:

https://ftp.itacyl.es/Meteorologia/Datos_observacion_Red_InfoRiego/
(ficheros diarios de `DatosHorarios/` y ubicación de las estaciones en `Situacion/`)

Al revisar las condiciones de uso hemos encontrado dos indicaciones distintas:

1. El fichero `LICENSE.txt` de ese mismo directorio indica que los datos se publican bajo la licencia
   **Open Database License (ODbL v1.0)**, con la obligación de citar "©Instituto Tecnológico Agrario de
   Castilla y León" junto a la información o a cualquier derivado.
2. La ficha del conjunto "Climatología" en el Catálogo Nacional de Datos Abiertos
   (https://datos.gob.es/es/catalogo/a07002862-climatologia1), que apunta al mismo directorio, indica la
   licencia **Creative Commons Atribución 4.0 (CC BY 4.0)**.

Les agradeceríamos que nos confirmaran:

1. **Qué licencia se aplica** a los datos meteorológicos (semihorarios y diarios) y a la ubicación de las
   estaciones de la red InfoRiego.
2. Si podemos **mostrar** estos datos en InfoSalamanca, con la cita indicada.
3. Si podemos **redistribuirlos normalizados** (mismas observaciones, con unidades, fechas en UTC y
   estado de calidad homogéneos con otras fuentes) en ficheros **CSV y JSON** de descarga libre desde
   InfoSalamanca, y en qué condiciones (por ejemplo, si con ODbL esos ficheros deben publicarse también
   con ODbL).
4. Si esos mismos ficheros podrían **catalogarse en el Portal de Datos Abiertos de la Junta de Castilla y
   León** (modelo federado: InfoSalamanca mantiene los ficheros y el portal los referencia).
5. Si la hora de los ficheros semihorarios está expresada en **UTC** y corresponde al **final** de cada
   intervalo de 30 minutos (así lo deducimos del máximo de radiación solar, pero preferimos confirmarlo).
6. Si existe una forma preferente de acceso automatizado (el FTP o la API mencionada en `LICENSE.txt`) y
   una frecuencia de consulta que debamos respetar. Actualmente descargamos un fichero diario cada tres
   horas como máximo, solo si aún no lo tenemos.

Mientras no recibamos su respuesta, mostramos los datos con la cita obligatoria y **no los incluimos** en
ningún fichero de datos abiertos ni les asignamos una licencia.

Quedamos a su disposición para cualquier aclaración.

Atentamente,

_[nombre y cargo pendientes de completar]_
InfoSalamanca
