<template>
  <Teleport to="body">
    <div class="tss-overlay" @click.self="$emit('close')">
      <div
        ref="dialog"
        class="tss"
        role="dialog"
        aria-modal="true"
        :aria-label="`Productos de ${name}`"
        :style="{ '--accent': theme.accent }"
        tabindex="-1"
        @keydown.esc="$emit('close')"
        @keydown.left.prevent="step(-1)"
        @keydown.right.prevent="step(1)"
      >
        <!-- Portada del productor -->
        <header class="tss-hero">
          <button ref="closeBtn" type="button" class="tss-close" aria-label="Cerrar" @click="$emit('close')">✕</button>
          <!-- El logotipo del productor; si no tiene, la foto de lo que más produce -->
          <div v-if="heroLogo" class="tss-hero-art logo" :class="{ light: heroLogo.light }" aria-hidden="true">
            <img :src="heroLogo.src" alt="" />
          </div>
          <div v-else class="tss-hero-art" :class="{ photo: heroPhoto }" aria-hidden="true">
            <img v-if="heroPhoto" :src="heroPhoto.src" alt="" />
            <span v-else>{{ theme.emoji }}</span>
          </div>
          <div class="tss-hero-text">
            <p class="tss-kicker">Tierra de Sabor · {{ town }}</p>
            <h2 class="tss-name">{{ name }}</h2>
            <p class="tss-stats">
              <template v-if="full">
                <strong>{{ products.length }}</strong> productos · <strong>{{ groups.length }}</strong> {{ groups.length === 1 ? 'variedad' : 'variedades' }}
                <template v-if="brands.length > 1"> · <strong>{{ brands.length }}</strong> marcas</template>
              </template>
              <template v-else-if="loading">Cargando productos…</template>
            </p>
            <div class="tss-cta">
              <a v-if="venta.online" :href="venta.online.url" target="_blank" rel="noopener noreferrer" class="tss-btn primary">🛒 Comprar online</a>
              <a v-if="venta.dondeComprar" :href="venta.dondeComprar.url" target="_blank" rel="noopener noreferrer" class="tss-btn">📍 Dónde comprar</a>
              <a v-if="venta.telefono" :href="`tel:${venta.telefono.replace(/\s/g, '')}`" class="tss-btn">📞 {{ venta.telefono }}</a>
              <a v-if="venta.email" :href="`mailto:${venta.email}`" class="tss-btn">✉️ Correo</a>
              <a v-if="web" :href="web" target="_blank" rel="noopener noreferrer" class="tss-btn">Web ↗</a>
            </div>
          </div>
        </header>

        <!-- Sellos de calidad -->
        <ul v-if="seals.length" class="tss-seals" aria-label="Sellos de calidad">
          <li v-for="(s, i) in seals" :key="s.raw" class="tss-seal" :style="{ '--i': i }" :title="s.raw">
            <img v-if="s.logo" :src="s.logo" class="tss-seal-logo" :alt="s.abbr" />
            <span v-else class="tss-stamp">{{ s.abbr }}</span>
            <span class="tss-seal-name">{{ s.name }}</span>
          </li>
        </ul>

        <!-- Secciones (solo si hay más de una) -->
        <nav v-if="sections.length > 1" class="tss-tabs" aria-label="Secciones">
          <button
            v-for="s in ['Todo', ...sections]"
            :key="s"
            type="button"
            class="tss-tab"
            :class="{ on: section === s }"
            :aria-pressed="section === s"
            @click="pickSection(s)"
          >{{ s }}</button>
        </nav>

        <div v-if="error" class="tss-empty">No hemos podido cargar los productos. Prueba de nuevo en un rato.</div>
        <div v-else-if="full && !groups.length" class="tss-empty">La Junta no tiene productos registrados para este productor.</div>

        <!-- Carrusel de variedades -->
        <section v-else class="tss-stage" aria-label="Variedades">
          <button type="button" class="tss-arrow left" aria-label="Anterior" :disabled="active === 0" @click="step(-1)">‹</button>
          <div ref="track" class="tss-track" @scroll.passive="onScroll">
            <template v-if="loading">
              <div v-for="n in 4" :key="n" class="tss-card skeleton" aria-hidden="true"></div>
            </template>
            <button
              v-for="(g, i) in visibleGroups"
              v-else
              :key="g.key"
              type="button"
              class="tss-card"
              :class="{ active: i === active }"
              :style="{ '--i': i, '--card': g.accent }"
              :aria-current="i === active"
              @click="goTo(i)"
            >
              <span v-if="g.photo" class="tss-card-photo" aria-hidden="true"><img :src="g.photo.src" alt="" loading="lazy" /></span>
              <span v-else class="tss-card-art" aria-hidden="true">{{ g.emoji }}</span>
              <span class="tss-card-title">{{ g.title }}</span>
              <span class="tss-card-sub">{{ g.variants.length }} {{ g.variants.length === 1 ? 'presentación' : 'presentaciones' }}</span>
              <span v-if="g.precintos.length" class="tss-card-dots" aria-hidden="true">
                <i v-for="p in g.precintos" :key="p.key" :style="{ background: p.color }"></i>
              </span>
            </button>
          </div>
          <button type="button" class="tss-arrow right" aria-label="Siguiente" :disabled="active >= visibleGroups.length - 1" @click="step(1)">›</button>
        </section>

        <div v-if="visibleGroups.length > 1" class="tss-pager" aria-hidden="true">
          <i v-for="(g, i) in visibleGroups" :key="g.key" :class="{ on: i === active }"></i>
        </div>

        <!-- Detalle de la variedad elegida -->
        <section v-if="current" :key="current.key" class="tss-detail" aria-live="polite">
          <!-- Foto ilustrativa de la variedad (no es la del productor), con su autor y licencia -->
          <figure v-if="current.photo" class="tss-detail-photo">
            <img :src="current.photo.src" alt="" />
            <figcaption>
              <h3>{{ current.title }}</h3>
              <p v-if="current.marcas.length">{{ current.marcas.length === 1 ? 'Marca' : 'Marcas' }}: {{ current.marcas.join(', ') }}</p>
            </figcaption>
          </figure>
          <p v-if="current.photo" class="tss-credit">
            Foto ilustrativa:
            <a :href="current.photo.page" target="_blank" rel="noopener">{{ current.photo.author }}</a>,
            <a v-if="current.photo.licenseUrl" :href="current.photo.licenseUrl" target="_blank" rel="noopener license">{{ current.photo.license }}</a>
            <template v-else>{{ current.photo.license }}</template>
            · Wikimedia Commons
          </p>
          <div v-else class="tss-detail-head">
            <h3><span aria-hidden="true">{{ current.emoji }}</span> {{ current.title }}</h3>
            <p v-if="current.marcas.length">{{ current.marcas.length === 1 ? 'Marca' : 'Marcas' }}: {{ current.marcas.join(', ') }}</p>
          </div>

          <!-- Leyenda del precinto del ibérico -->
          <div v-if="current.precintos.length" class="tss-legend">
            <span class="tss-legend-title">Precinto</span>
            <span v-for="p in PRECINTO_LIST" :key="p.key" class="tss-legend-item" :class="{ off: !current.precintos.some(x => x.key === p.key) }">
              <i :style="{ background: p.color }"></i>{{ p.label }}
            </span>
          </div>

          <ul class="tss-variants">
            <li v-for="(v, i) in current.variants" :key="v.label" class="tss-variant" :style="{ '--i': i, '--tag': v.precinto?.color || 'transparent' }" :class="{ tagged: v.precinto }">
              <span v-if="v.precinto" class="tss-tag" :title="`Precinto ${v.precinto.key}: ${v.precinto.label}`"></span>
              <span class="tss-variant-name" :title="v.nombre">{{ v.label }}</span>
              <span v-if="current.marcas.length > 1 && v.marcas.length" class="tss-variant-brands">{{ v.marcas.join(' · ') }}</span>
              <span v-if="ownSeals(v).length" class="tss-variant-seals">
                <abbr v-for="s in ownSeals(v)" :key="s" :title="sealTitle(s)">{{ s }}</abbr>
              </span>
            </li>
          </ul>
        </section>

        <p class="tss-source">Productos registrados en la marca Tierra de Sabor (Junta de Castilla y León). Los datos de venta salen de la web de cada productor.</p>
      </div>
    </div>
  </Teleport>
</template>

<script>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { apiService } from '@/services/apiService'
import { groupProducts, sealsOf, sectionTheme, niceCase, logoFor, PRECINTO_LIST } from '@/utils/tierraSabor'

export default {
  name: 'TierraSaborShowcase',
  props: {
    producer: { type: Object, required: true }
  },
  emits: ['close'],
  setup(props) {
    const full = ref(null)
    const loading = ref(true)
    const error = ref(false)
    const section = ref('Todo')
    const active = ref(0)
    const track = ref(null)
    const dialog = ref(null)
    const closeBtn = ref(null)

    const src = computed(() => full.value || props.producer)
    const name = computed(() => niceCase(src.value.nombre_comercial || src.value.razon_social || 'Productor'))
    const town = computed(() => niceCase(src.value.localidad || ''))
    const venta = computed(() => src.value.venta || {})
    const web = computed(() => {
      const w = src.value.web
      return w ? (/^https?:\/\//i.test(w) ? w : `https://${w}`) : null
    })
    const products = computed(() => full.value?.productos || [])
    const allGroups = computed(() => groupProducts(products.value).map(g => ({
      ...g,
      precintos: PRECINTO_LIST.filter(p => g.variants.some(v => v.precinto?.key === p.key))
    })))
    const groups = allGroups
    const sections = computed(() => [...new Set(allGroups.value.map(g => g.seccion).filter(Boolean))])
    const visibleGroups = computed(() => section.value === 'Todo' ? allGroups.value : allGroups.value.filter(g => g.seccion === section.value))
    const current = computed(() => visibleGroups.value[active.value] || null)
    const seals = computed(() => sealsOf(products.value))
    // Foto de la portada: la de la variedad con más productos
    const heroPhoto = computed(() => allGroups.value.find(g => g.photo)?.photo || null)
    const heroLogo = computed(() => logoFor(props.producer.idempresa))
    const brands = computed(() => [...new Set(products.value.map(p => p.marca).filter(Boolean))])

    // Color de la portada: el de la sección con más productos
    const theme = computed(() => {
      const count = {}
      for (const p of products.value) count[p.seccion] = (count[p.seccion] || 0) + 1
      const main = Object.keys(count).sort((a, b) => count[b] - count[a])[0] || (props.producer.secciones || [])[0]
      return sectionTheme(main)
    })

    // Solo los sellos que distinguen unas presentaciones de otras (los comunes ya están arriba)
    const ownSeals = (v) => {
      const all = current.value?.variants || []
      return v.seals.filter(s => !all.every(x => x.seals.includes(s)))
    }
    const sealTitle = (abbr) => seals.value.filter(s => s.abbr === abbr).map(s => s.name).join(', ')

    const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const goTo = (i) => {
      if (i < 0 || i >= visibleGroups.value.length) return
      active.value = i
      const card = track.value?.querySelectorAll('.tss-card')[i]
      if (!card) return
      const left = card.offsetLeft - (track.value.clientWidth - card.clientWidth) / 2
      track.value.scrollTo({ left, behavior: reduceMotion() ? 'auto' : 'smooth' })
    }
    const step = (d) => goTo(active.value + d)

    // La tarjeta más cerca del centro pasa a ser la activa
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const t = track.value
        if (!t) return
        const center = t.scrollLeft + t.clientWidth / 2
        let best = 0
        let dist = Infinity
        t.querySelectorAll('.tss-card').forEach((c, i) => {
          const d = Math.abs(c.offsetLeft + c.clientWidth / 2 - center)
          if (d < dist) { dist = d; best = i }
        })
        active.value = best
      })
    }

    const pickSection = (s) => {
      section.value = s
      active.value = 0
      nextTick(() => track.value?.scrollTo({ left: 0 }))
    }

    const load = async () => {
      loading.value = true
      error.value = false
      full.value = null
      section.value = 'Todo'
      active.value = 0
      const id = props.producer.idempresa || props.producer.id
      const data = id ? await apiService.getTierraSaborProducer(id) : null
      if (data) full.value = data
      else error.value = true
      loading.value = false
    }

    watch(() => props.producer, load)
    onMounted(() => {
      load()
      closeBtn.value?.focus()
    })

    return {
      full, loading, error, section, active, track, dialog, closeBtn,
      name, town, venta, web, products, groups, sections, visibleGroups, current, seals, heroPhoto, heroLogo, brands, theme,
      sealTitle, ownSeals, goTo, step, onScroll, pickSection, PRECINTO_LIST
    }
  }
}
</script>

<style scoped>
.tss-overlay {
  position: fixed;
  inset: 0;
  z-index: 10002;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(15, 12, 10, 0.55);
  backdrop-filter: blur(6px);
  animation: tss-fade 0.25s ease both;
}

.tss {
  --ink: #1f1a17;
  --ink-soft: #6b6159;
  --paper: #fffaf4;
  --card-bg: #ffffff;
  --line: rgba(31, 26, 23, 0.1);
  position: relative;
  width: min(880px, 100%);
  max-height: min(92vh, 900px);
  overflow-y: auto;
  overflow-x: hidden;
  border-radius: 24px;
  background: var(--paper);
  color: var(--ink);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
  outline: none;
  animation: tss-rise 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.15) both;
}

/* ---------- Portada ---------- */
.tss-hero {
  position: relative;
  display: flex;
  gap: 24px;
  align-items: center;
  padding: 32px 32px 28px;
  color: #fff;
  background:
    radial-gradient(circle at 12% 30%, rgba(255, 255, 255, 0.22), transparent 45%),
    radial-gradient(circle at 90% 120%, rgba(0, 0, 0, 0.25), transparent 55%),
    var(--accent);
  overflow: hidden;
}
.tss-hero::after {
  content: '';
  position: absolute;
  inset: auto -10% -60px -10%;
  height: 90px;
  background: var(--paper);
  border-radius: 50% 50% 0 0 / 100% 100% 0 0;
}
.tss-hero-art {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  width: 120px;
  height: 120px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.35), 0 12px 30px rgba(0, 0, 0, 0.2);
}
.tss-hero-art.photo {
  overflow: hidden;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.85), 0 14px 34px rgba(0, 0, 0, 0.3);
  animation: tss-pop 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.3) 0.1s backwards;
}
.tss-hero-art.logo {
  padding: 16px;
  border-radius: 28px;
  background: #fff;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.3);
  animation: tss-pop 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.3) 0.1s backwards;
}
.tss-hero-art.logo.light {
  background: #2b2622;
}
.tss-hero-art.logo img {
  object-fit: contain;
  transform: none;
  animation: none;
}
.tss-hero-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.05);
  animation: tss-kenburns 14s ease-in-out infinite alternate;
}
.tss-hero-art span {
  font-size: 64px;
  line-height: 1;
  filter: drop-shadow(0 8px 10px rgba(0, 0, 0, 0.25));
  animation: tss-float 4s ease-in-out infinite;
}
.tss-hero-text {
  position: relative;
  z-index: 1;
  min-width: 0;
  padding-bottom: 18px;
}
.tss-kicker {
  margin: 0 0 4px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.85;
}
.tss-name {
  margin: 0;
  font-size: clamp(1.5rem, 3.6vw, 2.25rem);
  font-weight: 800;
  line-height: 1.1;
  color: #fff;
  text-wrap: balance;
}
.tss-stats {
  margin: 8px 0 14px;
  font-size: 0.95rem;
  opacity: 0.92;
  min-height: 1.4em;
}
.tss-cta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tss-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  color: #fff;
  background: rgba(255, 255, 255, 0.16);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4);
  transition: transform 0.15s ease, background 0.15s ease;
}
.tss-btn:hover,
.tss-btn:focus-visible {
  background: rgba(255, 255, 255, 0.28);
  transform: translateY(-1px);
}
.tss-btn.primary {
  background: #fff;
  color: var(--accent);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
}
.tss-close {
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
  background: rgba(0, 0, 0, 0.22);
  cursor: pointer;
}
.tss-close:hover,
.tss-close:focus-visible {
  background: rgba(0, 0, 0, 0.4);
}

/* ---------- Sellos ---------- */
.tss-seals {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px 18px;
  margin: 0;
  padding: 0 24px 8px;
  list-style: none;
}
.tss-seal {
  display: flex;
  align-items: center;
  gap: 8px;
  animation: tss-pop 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.4) backwards;
  animation-delay: calc(0.25s + var(--i) * 0.07s);
}
.tss-stamp {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: var(--accent);
  border: 2px dashed var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  transform: rotate(-8deg);
}
.tss-seal-logo {
  width: 52px;
  height: 52px;
  object-fit: contain;
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.18));
  border-radius: 0 !important;
  background: none !important;
  box-shadow: none !important;
}
.tss-seal-name {
  max-width: 160px;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.2;
  color: var(--ink-soft);
}

/* ---------- Secciones ---------- */
.tss-tabs {
  display: flex;
  gap: 8px;
  padding: 14px 24px 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.tss-tab {
  flex: 0 0 auto;
  padding: 6px 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink-soft);
  background: var(--card-bg);
  cursor: pointer;
}
.tss-tab.on {
  color: #fff;
  border-color: var(--accent);
  background: var(--accent);
}

/* ---------- Carrusel ---------- */
.tss-stage {
  position: relative;
  margin-top: 8px;
}
.tss-track {
  display: flex;
  gap: 16px;
  padding: 22px calc(50% - 90px) 18px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.tss-track::-webkit-scrollbar {
  display: none;
}
.tss-card {
  --card: var(--accent);
  flex: 0 0 180px;
  height: 220px;
  scroll-snap-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 18px 14px;
  border: 0;
  border-radius: 22px;
  text-align: center;
  color: var(--ink);
  background: var(--card-bg);
  box-shadow: 0 1px 0 var(--line), 0 8px 24px rgba(31, 26, 23, 0.08);
  cursor: pointer;
  transform: scale(0.88);
  opacity: 0.6;
  transition: transform 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2), opacity 0.3s ease, box-shadow 0.3s ease;
  animation: tss-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.1) backwards;
  animation-delay: calc(0.15s + min(var(--i), 6) * 0.06s);
}
.tss-card:hover {
  opacity: 0.85;
}
.tss-card.active {
  transform: scale(1);
  opacity: 1;
  box-shadow: 0 0 0 2px var(--card), 0 18px 40px color-mix(in srgb, var(--card) 35%, transparent);
}
.tss-card:focus-visible {
  outline: 3px solid var(--card);
  outline-offset: 3px;
}
.tss-card-art {
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  font-size: 52px;
  line-height: 1;
  background: radial-gradient(circle at 35% 30%, #fff, color-mix(in srgb, var(--card) 20%, #fff));
  transition: transform 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.4);
}
.tss-card.active .tss-card-art {
  transform: translateY(-4px) rotate(-6deg) scale(1.06);
}
/* Tarjeta con foto: la imagen ocupa la parte de arriba */
.tss-card:has(.tss-card-photo) {
  justify-content: flex-start;
  padding: 0 0 14px;
  overflow: hidden;
}
.tss-card-photo {
  display: block;
  width: 100%;
  height: 128px;
  margin-bottom: 6px;
  overflow: hidden;
  background: color-mix(in srgb, var(--card) 15%, #fff);
}
.tss-card-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.6s cubic-bezier(0.2, 0.9, 0.3, 1);
}
.tss-card.active .tss-card-photo img,
.tss-card:hover .tss-card-photo img {
  transform: scale(1.08);
}
.tss-card:has(.tss-card-photo) .tss-card-title,
.tss-card:has(.tss-card-photo) .tss-card-sub {
  padding: 0 10px;
}
.tss-card-title {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.2;
}
.tss-card-sub {
  font-size: 0.8rem;
  color: var(--ink-soft);
}
.tss-card-dots {
  display: flex;
  gap: 4px;
}
.tss-card-dots i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
}
.tss-card.skeleton {
  cursor: default;
  background: linear-gradient(100deg, var(--card-bg) 30%, color-mix(in srgb, var(--accent) 10%, var(--card-bg)) 50%, var(--card-bg) 70%) 0 0 / 300% 100%;
  animation: tss-shimmer 1.2s linear infinite;
}
.tss-arrow {
  position: absolute;
  top: 50%;
  z-index: 1;
  width: 40px;
  height: 40px;
  margin-top: -20px;
  border: 0;
  border-radius: 50%;
  font-size: 1.6rem;
  line-height: 1;
  color: var(--ink);
  background: var(--card-bg);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
  cursor: pointer;
}
.tss-arrow.left { left: 12px; }
.tss-arrow.right { right: 12px; }
.tss-arrow:disabled {
  opacity: 0;
  pointer-events: none;
}
.tss-pager {
  display: flex;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 0 24px;
}
.tss-pager i {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--line);
  transition: width 0.3s ease, background 0.3s ease;
}
.tss-pager i.on {
  width: 22px;
  background: var(--accent);
}

/* ---------- Detalle ---------- */
.tss-detail {
  margin: 18px 24px 0;
  padding: 20px;
  border-radius: 20px;
  background: var(--card-bg);
  box-shadow: 0 1px 0 var(--line);
  animation: tss-in 0.35s ease backwards;
}
.tss-detail-photo {
  position: relative;
  margin: -20px -20px 0;
  height: 200px;
  overflow: hidden;
  border-radius: 20px 20px 0 0;
}
.tss-detail-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  animation: tss-kenburns 16s ease-in-out infinite alternate;
}
.tss-detail-photo figcaption {
  position: absolute;
  inset: auto 0 0 0;
  padding: 40px 20px 14px;
  color: #fff;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.72));
}
.tss-detail-photo h3 {
  margin: 0;
  font-size: 1.35rem;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}
.tss-detail-photo p {
  margin: 2px 0 0;
  font-size: 0.85rem;
  opacity: 0.9;
}
.tss-credit {
  margin: 6px 0 0;
  font-size: 0.7rem;
  color: var(--ink-soft);
}
.tss-credit a {
  color: inherit;
}
.tss-detail-head h3 {
  margin: 0;
  font-size: 1.2rem;
  color: var(--ink);
}
.tss-detail-head p {
  margin: 4px 0 0;
  font-size: 0.88rem;
  color: var(--ink-soft);
}
.tss-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
  margin-top: 14px;
  font-size: 0.78rem;
  color: var(--ink-soft);
}
.tss-legend-title {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.tss-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.tss-legend-item.off {
  opacity: 0.35;
}
.tss-legend-item i {
  width: 18px;
  height: 8px;
  border-radius: 2px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
}
.tss-variants {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}
.tss-variant {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--accent) 6%, var(--paper));
  animation: tss-in 0.35s ease backwards;
  animation-delay: calc(min(var(--i), 10) * 0.035s);
}
.tss-variant.tagged {
  padding-left: 22px;
}
.tss-tag {
  position: absolute;
  left: 8px;
  top: 12px;
  bottom: 12px;
  width: 6px;
  border-radius: 3px;
  background: var(--tag);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
}
.tss-variant-name {
  font-weight: 700;
  font-size: 0.95rem;
}
.tss-variant-brands {
  font-size: 0.8rem;
  color: var(--ink-soft);
}
.tss-variant-seals {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.tss-variant-seals abbr {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.68rem;
  font-weight: 700;
  text-decoration: none;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}
.tss-empty {
  margin: 24px;
  padding: 24px;
  border-radius: 16px;
  text-align: center;
  color: var(--ink-soft);
  background: var(--card-bg);
}
.tss-source {
  margin: 18px 24px 22px;
  font-size: 0.75rem;
  color: var(--ink-soft);
}

/* ---------- Animaciones ---------- */
@keyframes tss-fade { from { opacity: 0; } }
@keyframes tss-rise { from { opacity: 0; transform: translateY(40px) scale(0.96); } }
@keyframes tss-in { from { opacity: 0; transform: translateY(16px) scale(0.92); } }
@keyframes tss-pop { from { opacity: 0; transform: scale(0.4); } }
@keyframes tss-float { 50% { transform: translateY(-8px) rotate(4deg); } }
@keyframes tss-kenburns { from { transform: scale(1.04) translate(0, 0); } to { transform: scale(1.14) translate(-2%, -2%); } }
@keyframes tss-shimmer { to { background-position: -150% 0; } }

@media (prefers-reduced-motion: reduce) {
  .tss, .tss-overlay, .tss-card, .tss-seal, .tss-variant, .tss-detail, .tss-hero-art span,
  .tss-hero-art, .tss-hero-art img, .tss-detail-photo img {
    animation: none !important;
  }
  .tss-card, .tss-card-art, .tss-card-photo img { transition: none; }
}

/* ---------- Móvil: a pantalla completa ---------- */
@media (max-width: 640px) {
  .tss-overlay { padding: 0; }
  .tss {
    width: 100%;
    max-height: 100dvh;
    height: 100dvh;
    border-radius: 0;
  }
  .tss-hero {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
    padding: 24px 16px 22px;
  }
  .tss-hero-art { width: 84px; height: 84px; }
  .tss-hero-art span { font-size: 44px; }
  .tss-seals { justify-content: flex-start; padding: 0 16px 8px; }
  .tss-tabs { padding: 12px 16px 0; }
  .tss-track { padding-inline: calc(50% - 80px); }
  .tss-card { flex-basis: 160px; height: 200px; }
  .tss-arrow { display: none; }
  .tss-detail { margin: 16px 16px 0; padding: 16px; }
  .tss-variants { grid-template-columns: 1fr; }
  .tss-source { margin: 16px; }
}
</style>

<!-- Modo oscuro (fuera de scoped: el atributo está en <html>) -->
<style>
[data-theme='dark'] .tss {
  --ink: #f3ece6;
  --ink-soft: #b9ada3;
  --paper: #1d1916;
  --card-bg: #29231f;
  --line: rgba(255, 255, 255, 0.1);
}
[data-theme='dark'] .tss-card-art {
  background: radial-gradient(circle at 35% 30%, #3a322c, color-mix(in srgb, var(--card) 30%, #29231f));
}
</style>
<style>
[data-theme='dark'] .tss .tss-tag,
[data-theme='dark'] .tss .tss-card-dots i,
[data-theme='dark'] .tss .tss-legend-item i {
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45);
}
</style>
