<template>
  <!-- Iconos planos de la línea del tiempo. Colores: --hi-main (piedra dorada), --hi-dark (contorno),
       --hi-light (relleno claro) y --hi-accent (detalles); se definen en HistoryTimeline.vue -->
  <svg class="history-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <g v-if="name === 'castro'">
      <path d="M8 40h32" class="d" />
      <path d="M12 40V28h24v12z" class="m" />
      <path d="M9 29L24 14l15 15z" class="a" />
      <path d="M21 40v-7h6v7" class="l" />
      <path d="M24 14v-4" class="d" />
    </g>
    <g v-else-if="name === 'espada'">
      <path d="M33 6l4 4-17 17-4-4z" class="l" />
      <path d="M14 22l12 12-3 3-12-12z" class="m" />
      <path d="M13 31l-5 5 4 4 5-5" class="a" />
    </g>
    <g v-else-if="name === 'puente'">
      <path d="M4 22h40v6H4z" class="m" />
      <path d="M6 28h8v12H6zM20 28h8v12h-8zM34 28h8v12h-8z" class="m" />
      <path d="M14 40a3 6 0 0 1 6 0M28 40a3 6 0 0 1 6 0" class="d" />
      <path d="M4 42c4-2 8 2 12 0s8 2 12 0 8 2 12 0 4 0 4 0" class="w" />
      <path d="M4 22h40" class="d" />
    </g>
    <g v-else-if="name === 'castillo'">
      <path d="M8 40V18h32v22z" class="m" />
      <path d="M8 18v-5h5v5M16 18v-5h5v5M27 18v-5h5v5M35 18v-5h5v5" class="m" />
      <path d="M20 40v-9a4 4 0 0 1 8 0v9" class="l" />
      <path d="M14 26h3v4h-3zM31 26h3v4h-3z" class="a" />
    </g>
    <g v-else-if="name === 'muralla'">
      <path d="M4 40V22h40v18z" class="m" />
      <path d="M4 22v-5h5v5M11 22v-5h5v5M18 22v-5h5v5M25 22v-5h5v5M32 22v-5h5v5M39 22v-5h5v5" class="d" />
      <path d="M18 40v-9a6 6 0 0 1 12 0v9" class="l" />
      <path d="M4 30h40" class="d" />
    </g>
    <g v-else-if="name === 'libro'">
      <path d="M24 14c-5-3-11-3-17-1v24c6-2 12-2 17 1z" class="l" />
      <path d="M24 14c5-3 11-3 17-1v24c-6-2-12-2-17 1z" class="m" />
      <path d="M24 14v24" class="d" />
      <path d="M11 20c3-1 6-1 9 0M11 25c3-1 6-1 9 0M28 20c3-1 6-1 9 0M28 25c3-1 6-1 9 0" class="d" />
      <!-- La rana de la fachada -->
      <circle cx="34" cy="31" r="3" class="a" />
    </g>
    <g v-else-if="name === 'corona'">
      <path d="M8 34l-2-18 9 8 9-12 9 12 9-8-2 18z" class="m" />
      <path d="M8 34h32v5H8z" class="a" />
      <circle cx="24" cy="12" r="2.5" class="l" />
      <circle cx="6" cy="16" r="2" class="l" />
      <circle cx="42" cy="16" r="2" class="l" />
    </g>
    <g v-else-if="name === 'pluma'">
      <path d="M38 6C24 8 14 18 12 34l4 2C20 22 28 14 38 6z" class="l" />
      <path d="M38 6C30 16 22 24 16 36" class="d" />
      <path d="M10 42h28" class="d" />
      <path d="M12 34l-3 7 7-5" class="a" />
    </g>
    <g v-else-if="name === 'catedral'">
      <path d="M6 40V26h36v14z" class="m" />
      <path d="M17 26V16h14v10z" class="m" />
      <path d="M17 16a7 7 0 0 1 14 0z" class="a" />
      <path d="M24 9V5M22 7h4" class="d" />
      <path d="M21 40v-8a3 3 0 0 1 6 0v8" class="l" />
      <path d="M10 30h4v5h-4zM34 30h4v5h-4z" class="l" />
    </g>
    <g v-else-if="name === 'vela'">
      <path d="M18 18h12v20H18z" class="l" />
      <path d="M14 38h20v4H14z" class="m" />
      <path d="M24 6c-4 5-4 8 0 10 4-2 4-5 0-10z" class="a" />
      <path d="M24 16v2" class="d" />
    </g>
    <g v-else-if="name === 'plaza'">
      <path d="M4 40V16h40v24z" class="m" />
      <path d="M8 40v-8a3 3 0 0 1 6 0v8M16 40v-8a3 3 0 0 1 6 0v8M26 40v-8a3 3 0 0 1 6 0v8M34 40v-8a3 3 0 0 1 6 0v8" class="l" />
      <path d="M8 20h4v5H8zM16 20h4v5h-4zM28 20h4v5h-4zM36 20h4v5h-4z" class="a" />
      <path d="M22 16v-6h4v6" class="d" />
    </g>
    <g v-else-if="name === 'canon'">
      <path d="M8 26l26-10 3 7-26 10z" class="m" />
      <circle cx="16" cy="34" r="6" class="a" />
      <circle cx="16" cy="34" r="2" class="l" />
      <path d="M38 14l4-2M39 20h4M38 25l4 2" class="d" />
      <path d="M8 40h32" class="d" />
    </g>
    <g v-else-if="name === 'casa'">
      <path d="M10 40V22h28v18z" class="l" />
      <path d="M6 23L24 9l18 14z" class="a" />
      <path d="M10 28h28M10 34h28M18 22v18M30 22v18" class="d" />
      <path d="M21 40v-6h6v6" class="m" />
    </g>
    <g v-else-if="name === 'presa'">
      <path d="M6 12c8 2 28 2 36 0l-4 28H10z" class="m" />
      <path d="M6 12c8 2 28 2 36 0" class="d" />
      <path d="M18 22v10M24 22v12M30 22v10" class="w" />
      <path d="M4 42c4-2 8 2 12 0s8 2 12 0 8 2 12 0" class="w" />
    </g>
    <g v-else-if="name === 'estrella'">
      <path d="M24 5l5.6 11.4 12.6 1.8-9.1 8.9 2.1 12.5L24 33.7l-11.2 5.9 2.1-12.5-9.1-8.9 12.6-1.8z" class="m" />
      <circle cx="24" cy="22" r="5" class="l" />
    </g>
    <g v-else-if="name === 'mascaras'">
      <path d="M6 10h18v12a9 9 0 0 1-18 0z" class="l" />
      <path d="M24 18h18v12a9 9 0 0 1-18 0z" class="m" />
      <path d="M10 16h3M17 16h3M11 25c2 2 6 2 8 0" class="d" />
      <path d="M28 24h3M35 24h3M29 34c2-2 6-2 8 0" class="d" />
    </g>
    <g v-else>
      <circle cx="24" cy="24" r="14" class="m" />
    </g>
  </svg>
</template>

<script>
export default {
  name: 'HistoryIcons',
  props: { name: { type: String, default: '' } }
}
</script>

<style scoped>
.history-icon {
  width: 100%;
  height: 100%;
  overflow: visible;
  /* global.css da fondo, borde redondeado y sombra a todos los svg */
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}
.m { fill: var(--hi-main); stroke: var(--hi-dark); stroke-width: 2; stroke-linejoin: round; }
.l { fill: var(--hi-light); stroke: var(--hi-dark); stroke-width: 2; stroke-linejoin: round; }
.a { fill: var(--hi-accent); stroke: var(--hi-dark); stroke-width: 2; stroke-linejoin: round; }
.d { fill: none; stroke: var(--hi-dark); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.w { fill: none; stroke: var(--hi-water); stroke-width: 2.5; stroke-linecap: round; }
</style>
