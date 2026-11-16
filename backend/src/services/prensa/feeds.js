// Periódicos locales y comarcales de la provincia que publican RSS. Solo se usan el título, el resumen, la fecha,
// la imagen y el enlace (lo que da el propio RSS para eso): la web enlaza siempre a la noticia, no la copia.
// Sin RSS (no se leen): Tribuna de Salamanca; El Norte de Castilla bloquea los robots.
// `comarcal`: medio de una comarca (sus noticias sin pueblo en el título suelen ser de esa comarca).
module.exports = [
  { id: 'noticiasatiempo', nombre: 'Noticias a Tiempo', url: 'https://noticiasatiempo.es/feed/', comarcal: 'Peñaranda de Bracamonte' },
  { id: 'salamancartvaldia', nombre: 'Salamanca al Día', url: 'https://salamancartvaldia.es/rss.xml' },
  { id: 'lagaceta', nombre: 'La Gaceta de Salamanca', url: 'https://www.lagacetadesalamanca.es/rss/2.0/?section=' },
  { id: 'salamancahoy', nombre: 'Salamanca Hoy', url: 'https://www.salamancahoy.es/rss/2.0/?section=' },
  { id: 'lacronica', nombre: 'La Crónica de Salamanca', url: 'https://lacronicadesalamanca.com/uploads/feeds/feed_la-cronica-de-salamanca_es.xml' },
  { id: 'salamancadiario', nombre: 'Salamanca Diario', url: 'https://salamancadiario.com/feed/' },
  { id: 'vuelvesalamanca', nombre: 'Vuelve Salamanca', url: 'https://vuelvesalamanca.com/feed/' },
  { id: 'radioguijuelo', nombre: 'Radio Guijuelo', url: 'https://radio.guijuelo.es/feed/', comarcal: 'Guijuelo' },
  { id: 'ibejar', nombre: 'i-bejar', url: 'https://www.i-bejar.com/rss', comarcal: 'Béjar' }
]
