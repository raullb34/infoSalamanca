<template>
  <figure v-if="poster" class="festival-poster">
    <!-- Imagen guardada en nuestro servidor: miniatura que abre el cartel grande -->
    <a v-if="poster.thumb" :href="poster.image || poster.thumb" target="_blank" rel="noopener" class="poster-image">
      <img
        :key="poster.thumb"
        :src="poster.thumb"
        :alt="`Cartel de las fiestas de ${townName} ${poster.year}`"
        loading="lazy"
        :class="{ loaded }"
        @load="loaded = true"
      >
    </a>

    <!-- Facebook / Instagram: la publicación solo se carga al pulsar (cookies y privacidad) -->
    <div v-else-if="embedUrl" ref="socialBox" class="poster-social">
      <iframe
        v-if="showEmbed"
        :src="embedUrl"
        :style="{ height: `${embedHeight}px` }"
        :title="`Cartel de las fiestas de ${townName} en ${networkName}`"
        loading="lazy"
        allow="encrypted-media"
      ></iframe>
      <button v-else type="button" class="poster-load" @click="openEmbed">
        <span class="poster-load-title">Ver el cartel {{ poster.year }}</span>
        <span class="poster-load-note">Se carga desde {{ networkName }}, que puede guardar cookies</span>
      </button>
    </div>

    <figcaption>
      Cartel {{ poster.year }} ·
      <a :href="poster.source_url" target="_blank" rel="noopener noreferrer">
        {{ poster.source === 'web' ? 'ver fuente' : `ver en ${networkName}` }}
      </a>
    </figcaption>
  </figure>
</template>

<script>
import { computed, ref, watch } from 'vue'

export default {
  name: 'FestivalPoster',
  props: {
    // Carteles aprobados del pueblo, el más reciente primero (GET /api/posters/town/:ine)
    posters: { type: Array, default: () => [] },
    townName: { type: String, default: '' }
  },
  setup(props) {
    const poster = computed(() => props.posters[0] || null)
    const showEmbed = ref(false)
    const loaded = ref(false)
    watch(poster, () => { showEmbed.value = false; loaded.value = false })

    // Facebook dibuja la publicación al ancho que se le pide: el del panel
    const socialBox = ref(null)
    const embedWidth = ref(350)
    const embedHeight = computed(() => Math.round(embedWidth.value * 1.25 + 90)) // cartel vertical + cabecera y pie
    const openEmbed = () => {
      embedWidth.value = Math.max(260, Math.min(500, Math.round(socialBox.value?.clientWidth || 350)))
      showEmbed.value = true
    }

    const networkName = computed(() => (poster.value?.source === 'instagram' ? 'Instagram' : 'Facebook'))
    const embedUrl = computed(() => {
      const p = poster.value
      if (!p) return null
      if (p.source === 'facebook') {
        return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(p.source_url)}&show_text=false&width=${embedWidth.value}`
      }
      if (p.source === 'instagram') {
        const m = p.source_url.match(/instagram\.com\/(p|reel)\/([^/?#]+)/)
        return m ? `https://www.instagram.com/${m[1]}/${m[2]}/embed` : null
      }
      return null
    })

    return { poster, showEmbed, loaded, networkName, embedUrl, socialBox, embedHeight, openEmbed }
  }
}
</script>

<style scoped>
.festival-poster {
  margin: 10px 0 0;
}
.poster-image {
  display: block;
  border-radius: 10px;
  overflow: hidden;
  background: var(--bg-secondary, rgba(127, 127, 127, 0.12));
  min-height: 120px; /* hueco mientras carga */
  max-width: 260px;
}
.poster-image img {
  width: 100%;
  height: auto;
  display: block;
  opacity: 0;
  transition: opacity 0.25s ease;
}
.poster-image img.loaded {
  opacity: 1;
}
.poster-social iframe {
  width: 100%;
  max-width: 500px;
  border: 0;
  border-radius: 10px;
  background: #fff;
}
.poster-load {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
  text-align: left;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--border-color, rgba(127, 127, 127, 0.35));
  background: var(--bg-secondary, transparent);
  color: inherit;
  cursor: pointer;
  font: inherit;
}
.poster-load:hover,
.poster-load:focus-visible {
  border-color: #ff7043;
}
.poster-load-title {
  font-weight: 600;
}
.poster-load-title::before {
  content: '🖼️ ';
}
.poster-load-note {
  font-size: 12px;
  opacity: 0.75;
}
figcaption {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 6px;
}
figcaption a {
  color: inherit;
}
@media (prefers-reduced-motion: reduce) {
  .poster-image img { transition: none; }
}
</style>
