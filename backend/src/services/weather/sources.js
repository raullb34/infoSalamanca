// Registro de fuentes meteorológicas: qué se puede consultar, guardar, mostrar y redistribuir de cada una,
// con su licencia y la atribución que exige. Las exportaciones de datos abiertos solo incluyen fuentes con
// `rights.redistribute === true`. Verificado en noviembre de 2026 (ver docs/meteorologia/PLAN_IMPLEMENTACION.md).

const SOURCES = {
  aemet: {
    id: 'aemet',
    name: 'AEMET OpenData',
    publisher: 'Agencia Estatal de Meteorología',
    url: 'https://opendata.aemet.es/',
    termsUrl: 'https://www.aemet.es/es/nota_legal',
    license: 'Condiciones de reutilización de AEMET (Ley 37/2007)',
    licenseUrl: 'https://www.aemet.es/es/nota_legal',
    attribution: '© AEMET',
    stationType: 'oficial',
    rights: { consult: true, store: true, display: true, redistribute: true },
    notes: 'Citar "© AEMET" o "Información elaborada por la Agencia Estatal de Meteorología" e indicar la fecha de actualización. Requiere AEMET_API_KEY.'
  },
  inforiego: {
    id: 'inforiego',
    name: 'InfoRiego (ITACyL)',
    publisher: 'Instituto Tecnológico Agrario de Castilla y León',
    url: 'https://www.inforiego.org/',
    termsUrl: 'https://ftp.itacyl.es/Meteorologia/Datos_observacion_Red_InfoRiego/LICENSE.txt',
    // Sin licencia asignada hasta que ITACyL la confirme (docs/meteorologia/CONSULTA_ITACYL_LICENCIA.md)
    license: 'Pendiente de confirmar por ITACyL',
    licenseUrl: null,
    licenseCandidates: [
      { license: 'ODbL 1.0', where: 'https://ftp.itacyl.es/Meteorologia/Datos_observacion_Red_InfoRiego/LICENSE.txt' },
      { license: 'CC BY 4.0', where: 'https://datos.gob.es/es/catalogo/a07002862-climatologia1' }
    ],
    attribution: '©Instituto Tecnológico Agrario de Castilla y León',
    stationType: 'agroclimatica',
    // Consultar, guardar y mostrar con la cita: ambas licencias candidatas lo permiten.
    // Redistribuir (CSV/JSON, catálogo de la Junta): no, hasta tener la respuesta de ITACyL
    rights: { consult: true, store: true, display: true, redistribute: false },
    pending: 'Licencia por confirmar (ODbL 1.0 en LICENSE.txt frente a CC BY 4.0 en datos.gob.es)',
    notes: 'Mostrar siempre la cita "©Instituto Tecnológico Agrario de Castilla y León".'
  },
  openmeteo: {
    id: 'openmeteo',
    name: 'Open-Meteo',
    publisher: 'Open-Meteo.com',
    url: 'https://open-meteo.com/',
    termsUrl: 'https://open-meteo.com/en/terms',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Weather data by Open-Meteo.com',
    stationType: null,
    rights: { consult: true, store: true, display: true, redistribute: true },
    notes: 'API gratuita solo para uso no comercial (< 10 000 llamadas/día). Enlace a open-meteo.com junto a los datos.'
  },
  meteoclimatic: {
    id: 'meteoclimatic',
    name: 'Meteoclimatic',
    publisher: "Meteoclimatic, Societat d'Estudis del Temps i el Clima",
    url: 'https://www.meteoclimatic.net/',
    termsUrl: 'https://www.meteoclimatic.net/index/wp/legal_es.html',
    license: 'CC BY-NC-ND 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc-nd/3.0/',
    attribution: 'Datos de Meteoclimatic (meteoclimatic.net), CC BY-NC-ND 3.0',
    stationType: 'colaborativa',
    // Consultar, guardar y mostrar: solo si se ha activado el acceso (METEOCLIMATIC_ACCESO=feed con
    // autorización, o =mapa). Redistribuir: nunca (NC-ND no es compatible con datos abiertos reutilizables)
    get rights() {
      const on = ['feed', 'mapa'].includes(process.env.METEOCLIMATIC_ACCESO);
      return { consult: on, store: on, display: on, redistribute: false };
    },
    pending: 'Autorización para leer los RSS (/feed/ está prohibido a robots en su robots.txt)',
    notes: 'Mostrar los valores tal como los publica Meteoclimatic, con su atribución y enlace. Uso no comercial.'
  }
};

const sourceOf = (id) => SOURCES[id] || null;
const can = (id, right) => Boolean(SOURCES[id]?.rights?.[right]);
const redistributable = () => Object.values(SOURCES).filter(s => s.rights.redistribute).map(s => s.id);

module.exports = { SOURCES, sourceOf, can, redistributable };
