// frontend/src/components/MapaSalamanca.vue
<template>
  <div class="mapa-container">
    <object
      id="mapa-salamanca"
      type="image/svg+xml"
      :data="svgPath"
      @load="initializeSVG"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useMunicipiosStore } from '../store/municipios';

const store = useMunicipiosStore();
const svgPath = 'Limites_salamanca.svg';

const initializeSVG = async () => {
  const svgDoc = document.getElementById('mapa-salamanca')
    .contentDocument;
  
  const pueblos = svgDoc.querySelectorAll('path');
  pueblos.forEach(pueblo => {
    pueblo.addEventListener('click', () => 
      store.selectMunicipio(pueblo.id));
  });
};
</script>