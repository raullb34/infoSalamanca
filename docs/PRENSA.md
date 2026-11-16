# Prensa local

Los periódicos de la provincia son donde más se anuncian las fiestas, los conciertos y las actividades de los
pueblos. La web los lee para completar la agenda y la ficha de cada pueblo (`backend/src/services/prensa/`).

## Qué periódicos

Los que publican RSS (`feeds.js`): Noticias a Tiempo (Peñaranda), Salamanca al Día, La Gaceta de Salamanca,
Salamanca Hoy, La Crónica de Salamanca, Salamanca Diario, Vuelve Salamanca, Radio Guijuelo e i-bejar. Tribuna de
Salamanca no tiene RSS y El Norte de Castilla bloquea los robots. Para añadir uno, una línea en `feeds.js`.

Solo se usan el título, el resumen, la fecha, la imagen y el enlace que da el RSS. La web enseña el titular, el
periódico y la fecha, y enlaza a la noticia: no copia el texto.

## Qué se hace con cada noticia (cada 30 minutos)

1. **De qué pueblo es** (`towns.js`): los 362 nombres oficiales, con su mayúscula, con o sin artículo y las formas
   cortas de la prensa ("Peñaranda", "Villares", "Santa Marta"). Los nombres que también son palabras corrientes
   o apellidos ("Vecinos", "Pastores", "Valero"…) solo cuentan tras una preposición ("en Vecinos").
2. **Fuera** (`topics.js`): sucesos y tráfico, política y esquelas.
3. **¿Anuncia algo?** Las de los últimos 7 días que anuncian algo en el título (fiestas, conciertos, ferias,
   charlas, "acogerá", "este sábado"…) y no son crónicas se le pasan a la IA (`extract.js`, Groq con un modelo
   pequeño que no gasta el cupo del asistente; como mucho 150 al día). La IA devuelve los eventos con fecha, hora,
   lugar y tipo; se comprueba que la fecha sea válida y no anterior a la noticia y que el pueblo sea de la provincia
   y lo nombre la noticia.
4. **Dónde sale**:
   - Los eventos, en la agenda (Espectáculos, Exposiciones, Charlas, talleres y lecturas) y en el pueblo, con el
     nombre del periódico y el enlace a la noticia. Si una agenda oficial ya tiene el mismo evento, manda la oficial.
   - Las **fiestas con imagen** (suele ser el cartel) se proponen como cartel del pueblo en
     `/admin/carteles.html`, como pendientes: no se publican hasta aprobarlas.
   - Las noticias de cada pueblo (las que lo nombran en el título), en su ficha: "📰 En la prensa".

Lo analizado se guarda en `uploads/posters/prensa/noticias.json` (el volumen de los carteles), para no repetir
llamadas a la IA al reiniciar; las noticias se olvidan a los 60 días. En el panel, **Inicio** dice cuántas noticias
hay, cuántos eventos y cuántas llamadas a la IA lleva el día.

Pruebas: `backend/test/prensa/prensa.test.js` (sin red ni IA).
