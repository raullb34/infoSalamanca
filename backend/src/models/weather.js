// Modelos del módulo meteorológico (docs/meteorologia/PLAN_IMPLEMENTACION.md §5).
// Fechas en UTC. Los nombres de colección empiezan por "weather" para no mezclarse con el resto.
const mongoose = require('mongoose');

// Estación: id interno estable "<red>:<idExterno>" (los id externos pueden repetirse entre redes)
const stationSchema = new mongoose.Schema({
  _id: { type: String }, // p. ej. "inforiego:SA01", "aemet:2867"
  network: { type: String, required: true, index: true },
  externalId: { type: String, required: true },
  name: { type: String, required: true },
  municipality: { ine: String, name: String },
  province: { type: String, default: 'Salamanca' },
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
  altitude: Number,
  stationType: { type: String, enum: ['oficial', 'agroclimatica', 'colaborativa'] },
  status: { type: String, enum: ['activa', 'sin-datos-recientes', 'baja'], default: 'activa', index: true },
  variables: [String],
  sourceUrl: String,
  license: String,
  sameAs: [String], // misma estación física en otra red (a mano)
  approximateLocation: Boolean, // coordenadas del municipio, no de la estación (Meteoclimatic)
  lastObservationAt: Date
}, { collection: 'weatherStations', timestamps: true, versionKey: false });
stationSchema.index({ network: 1, externalId: 1 }, { unique: true });

// Observación en formato largo: una por estación × variable × instante × agregación
const observationSchema = new mongoose.Schema({
  station: { type: String, required: true },
  variable: { type: String, required: true },
  value: { type: Number, required: true },
  unit: { type: String, required: true },
  aggregation: { type: String, enum: ['instant', 'mean', 'sum', 'max', 'min'], required: true },
  observedAt: { type: Date, required: true }, // fin del intervalo
  intervalStart: Date,
  intervalEnd: Date,
  source: { type: String, required: true },
  approximateTime: Boolean, // la fuente no da la hora exacta (Meteoclimatic por tabla: hora de consulta)
  quality: {
    status: { type: String, enum: ['ok', 'sospechosa', 'erronea'], default: 'ok' },
    checks: [{ _id: false, level: Number, code: String, severity: String }]
  }
}, { collection: 'weatherObservations', timestamps: { createdAt: true, updatedAt: false }, versionKey: false });
observationSchema.index({ station: 1, variable: 1, observedAt: 1, aggregation: 1 }, { unique: true });
observationSchema.index({ station: 1, observedAt: -1 });
observationSchema.index({ variable: 1, observedAt: -1 });
observationSchema.index({ observedAt: -1 });

// Predicción: una por punto × modelo × emisión, con las series en arrays. issuedAt ≠ times[]
const forecastSchema = new mongoose.Schema({
  point: { type: String, required: true }, // INE del municipio
  lat: Number,
  lon: Number,
  model: { type: String, required: true },
  provider: { type: String, required: true },
  issuedAt: { type: Date, required: true }, // inicio de la pasada del modelo (o hora de consulta si no se conoce)
  issuedAtKnown: { type: Boolean, default: false },
  retrievedAt: { type: Date, required: true },
  keep: { type: Boolean, default: false }, // archivo permanente (puntos con estación)
  expiresAt: { type: Date }, // TTL para las que no se archivan
  times: [Date],
  series: { type: mongoose.Schema.Types.Mixed }, // { temperature: [...], precipitation: [...], ... }
  daily: { type: mongoose.Schema.Types.Mixed },
  units: { type: mongoose.Schema.Types.Mixed }
}, { collection: 'weatherForecasts', versionKey: false });
forecastSchema.index({ point: 1, model: 1, issuedAt: -1 }, { unique: true });
forecastSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Estado de cada tarea de sincronización (y bloqueo para no ejecutarla dos veces a la vez)
const syncStateSchema = new mongoose.Schema({
  _id: { type: String }, // nombre de la tarea
  lastRunAt: Date,
  lastSuccessAt: Date,
  lastError: String,
  consecutiveFailures: { type: Number, default: 0 },
  nextRunAt: Date,
  lockedUntil: Date,
  stats: { type: mongoose.Schema.Types.Mixed }
}, { collection: 'weatherSyncState', versionKey: false });

const model = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);

module.exports = {
  WeatherStation: model('WeatherStation', stationSchema),
  WeatherObservation: model('WeatherObservation', observationSchema),
  WeatherForecast: model('WeatherForecast', forecastSchema),
  WeatherSyncState: model('WeatherSyncState', syncStateSchema)
};
