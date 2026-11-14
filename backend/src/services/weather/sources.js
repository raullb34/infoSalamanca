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
    license: 'ODbL 1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
    attribution: '©Instituto Tecnológico Agrario de Castilla y León',
    stationType: 'agroclimatica',
    rights: { consult: true, store: true, display: true, redistribute: true },
    notes: 'ODbL: lo derivado se publica con la misma licencia. datos.gob.es indica CC BY 4.0: discrepancia a aclarar con ITACyL.'
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
    publisher: 'Meteoclimatic',
    url: 'https://www.meteoclimatic.net/',
    termsUrl: null,
    license: 'Sin condiciones de reutilización publicadas',
    licenseUrl: null,
    attribution: 'Meteoclimatic',
    stationType: 'colaborativa',
    // Pendiente de autorización: no se consulta ni se publica hasta tenerla por escrito
    rights: { consult: false, store: false, display: false, redistribute: false },
    notes: 'Pendiente de autorización. Conector desactivado.'
  }
};

const sourceOf = (id) => SOURCES[id] || null;
const can = (id, right) => Boolean(SOURCES[id]?.rights?.[right]);
const redistributable = () => Object.values(SOURCES).filter(s => s.rights.redistribute).map(s => s.id);

module.exports = { SOURCES, sourceOf, can, redistributable };
