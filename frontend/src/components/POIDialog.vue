<template>
  <Teleport to="body">
    <div v-if="isOpen" class="pod-overlay" role="dialog" aria-modal="true" aria-labelledby="poi-dialog-title" @click.self="closeDialog">
      <article class="pod" :style="{ '--accent': theme.accent }">
        <!-- Portada: foto del monumento (Wikimedia Commons) o, si no hay, su icono -->
        <header class="pod-hero" :class="{ 'has-photo': photo }">
          <img v-if="photo" :src="photo.src" class="pod-photo" alt="" @error="photo = null" />
          <div v-else class="pod-art" aria-hidden="true"><span>{{ theme.emoji }}</span></div>
          <div v-if="loadingPhoto" class="pod-shimmer" aria-hidden="true"></div>
          <button type="button" class="pod-close" aria-label="Cerrar" @click="closeDialog">✕</button>
          <div class="pod-hero-text">
            <p class="pod-kicker">{{ town || 'Qué ver' }}</p>
            <h2 id="poi-dialog-title" class="pod-title">{{ poi.nombre || poi.name }}</h2>
            <div class="pod-chips">
              <span v-if="poi.tipomonumento" class="pod-chip">{{ poi.tipomonumento }}</span>
              <span v-for="p in periods" :key="p" class="pod-chip ghost">{{ p }}</span>
            </div>
          </div>
        </header>
        <p v-if="photo" class="pod-credit">
          Foto: <a :href="photo.page" target="_blank" rel="noopener">{{ photo.author }}</a>,
          <a v-if="photo.licenseUrl" :href="photo.licenseUrl" target="_blank" rel="noopener license">{{ photo.license }}</a>
          <template v-else>{{ photo.license }}</template>
          · Wikimedia Commons
        </p>

        <!-- Datos -->
        <div class="pod-tiles">
          <div v-if="address" class="pod-tile" style="--i: 0">
            <span class="pod-tile-icon" aria-hidden="true">📍</span>
            <span class="pod-tile-label">Dirección</span>
            <strong>{{ address }}</strong>
            <a v-if="mapsUrl" :href="mapsUrl" target="_blank" rel="noopener" class="pod-tile-link">Cómo llegar →</a>
          </div>
          <div v-if="poi.clasificacion || types.length" class="pod-tile" style="--i: 1">
            <span class="pod-tile-icon" aria-hidden="true">{{ theme.emoji }}</span>
            <span class="pod-tile-label">Tipo</span>
            <strong>{{ types.join(', ') || poi.clasificacion }}</strong>
            <small v-if="types.length && poi.clasificacion">{{ poi.clasificacion }}</small>
          </div>
          <div v-if="poi.identificadorbieninterescultural" class="pod-tile" style="--i: 2">
            <span class="pod-tile-icon" aria-hidden="true">🛡️</span>
            <span class="pod-tile-label">Protección</span>
            <strong>Bien de Interés Cultural</strong>
          </div>
        </div>

        <!-- Descripción (HTML de la Junta) -->
        <section v-if="poi.descripcion" class="pod-desc">
          <div class="pod-desc-text" :class="{ open: descOpen || !longDesc }" v-html="poi.descripcion"></div>
          <button v-if="longDesc" type="button" class="pod-more" @click="descOpen = !descOpen">{{ descOpen ? 'Ver menos' : 'Leer más' }}</button>
        </section>
        <p v-if="poi.datac" class="pod-extra">{{ poi.datac }}</p>

        <footer class="pod-actions">
          <button id="add-to-route-btn" type="button" class="pod-btn primary" @click="addToRoute">📍 Añadir a la ruta</button>
          <a v-if="mapsUrl" :href="mapsUrl" target="_blank" rel="noopener" class="pod-btn">🧭 Cómo llegar</a>
        </footer>
      </article>
    </div>
  </Teleport>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { themeFor, coordsOf, photoFor } from '@/utils/monumentos'

export default {
  name: 'POIDialog',
  props: {
    isOpen: { type: Boolean, default: false },
    poi: { type: Object, default: () => ({}) }
  },
  emits: ['close', 'addToRoute'],
  setup(props, { emit }) {
    const photo = ref(null)
    const loadingPhoto = ref(false)
    const descOpen = ref(false)

    const closeDialog = () => emit('close')
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && props.isOpen) closeDialog()
    }
    onMounted(() => document.addEventListener('keydown', handleKeyDown))
    onUnmounted(() => document.removeEventListener('keydown', handleKeyDown))

    const lat = computed(() => coordsOf(props.poi).lat)
    const lon = computed(() => coordsOf(props.poi).lon)
    const town = computed(() => props.poi?.poblacion_municipio || props.poi?.poblacion || '')
    const periods = computed(() => [].concat(props.poi?.periodohistorico || []).filter(Boolean))
    const types = computed(() => [].concat(props.poi?.tipoconstruccion || []).filter(Boolean))
    const address = computed(() => [props.poi?.calle, [props.poi?.codigopostal, town.value].filter(Boolean).join(' ')].filter(Boolean).join(', '))
    const mapsUrl = computed(() => lat.value && lon.value
      ? `https://www.google.com/maps/search/?api=1&query=${lat.value},${lon.value}`
      : (address.value ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${props.poi?.nombre || ''}, ${address.value}`)}` : null))
    const theme = computed(() => themeFor(props.poi))
    const longDesc = computed(() => String(props.poi?.descripcion || '').replace(/<[^>]+>/g, '').length > 420)

    // Foto: se pide al abrir; si llega tarde y ya es otro monumento, se descarta
    watch(() => [props.isOpen, props.poi?.identificador || props.poi?.nombre], async ([open]) => {
      photo.value = null
      descOpen.value = false
      if (!open || !lat.value || !lon.value) return
      const asked = props.poi
      loadingPhoto.value = true
      const foto = await photoFor(asked)
      if (props.poi === asked) photo.value = foto
      loadingPhoto.value = false
    }, { immediate: true })

    const addToRoute = () => {
      if (props.poi && (props.poi.id || props.poi.nombre || props.poi.name)) {
        emit('addToRoute', props.poi)
        closeDialog()
      }
    }

    return { photo, loadingPhoto, descOpen, town, periods, types, address, mapsUrl, theme, longDesc, closeDialog, addToRoute }
  }
}
</script>

<style scoped>
.pod-overlay {
  position: fixed;
  inset: 0;
  z-index: 10001;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(15, 12, 10, 0.55);
  backdrop-filter: blur(6px);
  animation: pod-fade 0.25s ease both;
}
.pod {
  --ink: #1f1a17;
  --ink-soft: #6b6159;
  --paper: #fffaf4;
  --card: #ffffff;
  --line: rgba(31, 26, 23, 0.1);
  width: min(760px, 100%);
  max-height: min(92vh, 900px);
  overflow-y: auto;
  overflow-x: hidden;
  border-radius: 24px;
  color: var(--ink);
  background: var(--paper);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
  animation: pod-rise 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.15) both;
}

/* ---------- Portada ---------- */
.pod-hero {
  position: relative;
  height: 300px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  color: #fff;
  background: radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.22), transparent 50%), var(--accent);
}
.pod-hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(transparent 35%, rgba(0, 0, 0, 0.7));
  pointer-events: none;
}
.pod-photo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: pod-kenburns 18s ease-in-out infinite alternate, pod-fade 0.6s ease;
  border-radius: 0 !important;
}
.pod-art {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding-bottom: 60px;
}
.pod-art span {
  font-size: 110px;
  filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.3));
  animation: pod-float 4s ease-in-out infinite;
}
.pod-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.18) 50%, transparent 70%) 0 0 / 300% 100%;
  animation: pod-shimmer 1.2s linear infinite;
}
.pod-hero-text {
  position: relative;
  z-index: 1;
  padding: 24px 28px;
}
.pod-kicker {
  margin: 0 0 4px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.9;
}
.pod-title {
  margin: 0;
  font-size: clamp(1.4rem, 3.6vw, 2.1rem);
  font-weight: 800;
  line-height: 1.12;
  color: #fff;
  text-wrap: balance;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.45);
}
.pod-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}
.pod-chip {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--accent);
  background: #fff;
}
.pod-chip.ghost {
  color: #fff;
  background: rgba(255, 255, 255, 0.16);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(4px);
}
.pod-close {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 2;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 50%;
  font-size: 1rem;
  color: #fff;
  background: rgba(0, 0, 0, 0.35);
  cursor: pointer;
}
.pod-close:hover,
.pod-close:focus-visible {
  background: rgba(0, 0, 0, 0.55);
}
.pod-credit {
  margin: 6px 24px 0;
  font-size: 0.7rem;
  color: var(--ink-soft);
}
.pod-credit a {
  color: inherit;
}

/* ---------- Datos ---------- */
.pod-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  padding: 18px 24px 0;
}
.pod-tile {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px;
  border-radius: 16px;
  background: var(--card);
  box-shadow: 0 1px 0 var(--line), 0 6px 18px rgba(31, 26, 23, 0.06);
  animation: pod-in 0.4s ease backwards;
  animation-delay: calc(0.2s + var(--i) * 0.06s);
}
.pod-tile-icon {
  font-size: 1.3rem;
}
.pod-tile-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.pod-tile strong {
  font-size: 0.95rem;
  line-height: 1.3;
}
.pod-tile small {
  font-size: 0.78rem;
  color: var(--ink-soft);
}
.pod-tile-link {
  margin-top: 4px;
  font-size: 0.8rem;
  font-weight: 700;
  text-decoration: none;
  color: var(--accent) !important;
}

/* ---------- Descripción ---------- */
.pod-desc {
  margin: 18px 24px 0;
  padding: 18px 20px;
  border-radius: 16px;
  background: var(--card);
  box-shadow: 0 1px 0 var(--line);
}
.pod-desc-text {
  max-height: 10em;
  overflow: hidden;
  font-size: 0.92rem;
  line-height: 1.65;
  -webkit-mask-image: linear-gradient(#000 60%, transparent);
  mask-image: linear-gradient(#000 60%, transparent);
}
.pod-desc-text.open {
  max-height: none;
  -webkit-mask-image: none;
  mask-image: none;
}
.pod-desc-text :deep(p) {
  margin: 0 0 0.7em;
  text-align: left !important;
}
.pod-more {
  margin-top: 6px;
  padding: 0;
  border: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--accent);
  background: none;
  cursor: pointer;
}
.pod-extra {
  margin: 12px 24px 0;
  font-size: 0.85rem;
  color: var(--ink-soft);
}

/* ---------- Acciones ---------- */
.pod-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 18px 24px 22px;
}
.pod-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
  color: var(--ink) !important;
  background: var(--card);
  cursor: pointer;
  transition: transform 0.15s ease;
}
.pod-btn:hover,
.pod-btn:focus-visible {
  transform: translateY(-1px);
  border-color: var(--accent);
}
.pod-btn.primary {
  border-color: var(--accent);
  color: #fff !important;
  background: var(--accent);
}

@keyframes pod-fade { from { opacity: 0; } }
@keyframes pod-rise { from { opacity: 0; transform: translateY(40px) scale(0.96); } }
@keyframes pod-in { from { opacity: 0; transform: translateY(14px); } }
@keyframes pod-float { 50% { transform: translateY(-10px) rotate(3deg); } }
@keyframes pod-shimmer { to { background-position: -150% 0; } }
@keyframes pod-kenburns { from { transform: scale(1.03); } to { transform: scale(1.14) translate(-2%, -1%); } }

@media (prefers-reduced-motion: reduce) {
  .pod, .pod-overlay, .pod-photo, .pod-art span, .pod-tile, .pod-shimmer { animation: none !important; }
}

@media (max-width: 640px) {
  .pod-overlay { padding: 0; }
  .pod {
    width: 100%;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
  }
  .pod-hero { height: 260px; }
  .pod-hero-text { padding: 18px 16px; }
  .pod-credit { margin: 6px 16px 0; }
  .pod-tiles { padding: 16px 16px 0; }
  .pod-desc { margin: 16px 16px 0; }
  .pod-actions { padding: 16px; }
  .pod-btn { flex: 1 1 auto; justify-content: center; }
}
</style>

<!-- Modo oscuro (fuera de scoped: el atributo está en <html>) -->
<style>
[data-theme='dark'] .pod {
  --ink: #f3ece6;
  --ink-soft: #b9ada3;
  --paper: #1d1916;
  --card: #29231f;
  --line: rgba(255, 255, 255, 0.1);
}
[data-theme='dark'] .pod .pod-tile-link,
[data-theme='dark'] .pod .pod-more {
  color: color-mix(in srgb, var(--accent) 45%, #fff) !important;
}
</style>
