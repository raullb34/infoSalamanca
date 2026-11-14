// Planificador de tareas meteorológicas, en el mismo proceso que el backend (como Lonja o cines).
// Cada tarea: bloqueo en Mongo (no se ejecuta dos veces a la vez, ni aunque haya dos procesos),
// reintentos con backoff exponencial, timeout, y estado en weatherSyncState (última ejecución correcta,
// error, fallos seguidos). Las tareas son idempotentes. Se desactiva con WEATHER_SYNC=off.
const mongoose = require('mongoose');
const { WeatherSyncState } = require('../../models/weather');

const tasks = new Map();
const LOCK_MS = 15 * 60 * 1000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const withTimeout = (promise, ms, name) => Promise.race([
  promise,
  new Promise((_, rej) => setTimeout(() => rej(new Error(`${name}: tiempo agotado (${ms / 1000} s)`)), ms).unref())
]);

// Coge el bloqueo si está libre (o caducado). Devuelve false si otra ejecución lo tiene
async function acquire(name, now = new Date()) {
  try {
    const r = await WeatherSyncState.findOneAndUpdate(
      { _id: name, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] },
      { $set: { lockedUntil: new Date(now.getTime() + LOCK_MS), lastRunAt: now } },
      { upsert: true, new: true }
    );
    return Boolean(r);
  } catch (err) {
    if (err.code === 11000) return false; // otro proceso creó el documento a la vez y lo tiene
    throw err;
  }
}

// Ejecuta una tarea ahora (también lo usa la ruta de mantenimiento)
async function runTask(name) {
  const task = tasks.get(name);
  if (!task) throw new Error(`Tarea desconocida: ${name}`);
  if (mongoose.connection.readyState !== 1) return { skipped: 'sin base de datos' };
  if (!(await acquire(name))) return { skipped: 'en curso' };
  let lastErr;
  try {
    for (let attempt = 0; attempt <= task.retries; attempt++) {
      try {
        const stats = await withTimeout(task.fn(), task.timeoutMs, name);
        await WeatherSyncState.updateOne({ _id: name }, {
          $set: { lastSuccessAt: new Date(), lastError: null, consecutiveFailures: 0, stats, nextRunAt: new Date(Date.now() + task.everyMs) }
        });
        console.log(`🌦️  ${name}: ${JSON.stringify(stats)}`);
        return stats;
      } catch (err) {
        lastErr = err;
        // Sin clave o fuente no autorizada: no tiene sentido reintentar
        if (err.code === 'NO_KEY') break;
        const wait = Math.min(60000, 2000 * 2 ** attempt) * (err.response?.status === 429 || err.status === 429 ? 5 : 1);
        if (attempt < task.retries) await sleep(wait);
      }
    }
    await WeatherSyncState.updateOne({ _id: name }, {
      $set: { lastError: String(lastErr?.message || lastErr).slice(0, 500), nextRunAt: new Date(Date.now() + task.everyMs) },
      $inc: { consecutiveFailures: 1 }
    });
    console.error(`🌦️  ${name} falló: ${lastErr?.message}`);
    return { error: lastErr?.message };
  } finally {
    await WeatherSyncState.updateOne({ _id: name }, { $set: { lockedUntil: null } }).catch(() => {});
  }
}

// Registra una tarea: cada `everyMs`, primera vez a los `firstInMs`
function register(name, fn, { everyMs, firstInMs = 30000, retries = 2, timeoutMs = 5 * 60 * 1000 } = {}) {
  tasks.set(name, { fn, everyMs, firstInMs, retries, timeoutMs });
}

let started = false;
function start() {
  if (started || process.env.WEATHER_SYNC === 'off' || process.env.NODE_ENV === 'test') return;
  started = true;
  for (const [name, t] of tasks) {
    setTimeout(() => runTask(name).catch(() => {}), t.firstInMs).unref();
    setInterval(() => runTask(name).catch(() => {}), t.everyMs).unref();
  }
}

const list = () => [...tasks.keys()];
module.exports = { register, start, runTask, list, _test: { acquire } };
