<template>
  <div class="filter-content">
    <h2>{{ currentFilterTitle }}</h2>
  
    <!-- Loader mientras carga -->
    <div v-if="isLoading" class="loading-container">
      <div class="spinner"></div>
      <p>Cargando resultados...</p>
    </div>
    
    <!-- Lista de resultados de filtros -->
    <div v-else class="filter-results">
      <!-- Resultados Tierra de Sabor -->
      <div v-if="activeFilter === 'tierraSabor' && tierraSaborResults.length > 0">
        <div 
          v-for="(item, index) in tierraSaborResults" 
          :key="index"
          class="filter-item tierra-sabor-item"
          @click="showTierraSaborProducts(item)"
        >
          <div class="item-header">
            <h4>{{ item.nombre_comercial || item.razon_social || 'Sin nombre' }}</h4>
            <span class="item-category" v-if="item.web">
              <a :href="formatWebUrl(item.web)" target="_blank" rel="noopener noreferrer">Ir a la Web</a>
            </span>
            <span class="item-category" v-else>Tierra de Sabor</span>
          </div>
          <div class="item-details">
            <p v-if="item.direccion"><strong>📍</strong> {{ item.direccion }}</p>
            <p v-if="item.localidad"><strong>🏘️</strong> {{ item.localidad }}</p>
          </div>
        </div>
      </div>

      <!-- Resultados Teatro -->
      <div v-if="activeFilter === 'teatro' && teatroResults.length > 0">
        <div 
          v-for="(item, index) in teatroResults" 
          :key="index"
          class="filter-item teatro-item"
          @click="showItemDetails(item)"
        >
          <div class="item-header">
            <h4>{{ item.titulo || 'Sin título' }}</h4>
            <span class="item-category">Teatro</span>
          </div>
          <div class="item-details">
            <p v-if="item.fecha"><strong>📅</strong> {{ formatDate(item.fecha) }}</p>
            <p v-if="item.lugar"><strong>📍</strong> {{ item.lugar }}</p>
            <p v-if="item.precio"><strong>💰</strong> {{ item.precio }}</p>
          </div>
        </div>
      </div>

      <!-- Resultados Pantallas -->
      <div v-if="activeFilter === 'pantallas' && pantallasResults.length > 0">
        <div 
          v-for="(item, index) in pantallasResults" 
          :key="index"
          class="filter-item pantallas-item"
          @click="showItemDetails(item)"
        >
          <div class="item-header">
            <h4>{{ item.titulo || 'Sin título' }}</h4>
            <span class="item-category">Cine</span>
          </div>
          <div class="item-details">
            <p v-if="item.fecha"><strong>📅</strong> {{ formatDate(item.fecha) }}</p>
            <p v-if="item.lugar"><strong>📍</strong> {{ item.lugar }}</p>
            <p v-if="item.genero"><strong>🎬</strong> {{ item.genero }}</p>
          </div>
        </div>
      </div>

      <!-- Resultados Exposición -->
      <div v-if="activeFilter === 'exposicion' && exposicionResults.length > 0">
        <div 
          v-for="(item, index) in exposicionResults" 
          :key="index"
          class="filter-item exposicion-item"
          @click="showItemDetails(item)"
        >
          <div class="item-header">
            <h4>{{ item.titulo || 'Sin título' }}</h4>
            <span class="item-category">Exposición</span>
          </div>
          <div class="item-details">
            <p v-if="item.fecha_inicio"><strong>📅</strong> {{ formatDate(item.fecha_inicio) }} - {{ formatDate(item.fecha_fin) }}</p>
            <p v-if="item.lugar"><strong>📍</strong> {{ item.lugar }}</p>
            <p v-if="item.descripcion"><strong>ℹ️</strong> {{ truncateText(item.descripcion, 100) }}</p>
          </div>
        </div>
      </div>

      <!-- Mensaje cuando no hay resultados -->
      <div v-if="!hasResults && !isLoading" class="no-results">
        <p>No se encontraron resultados para este filtro</p>
      </div>

      <!-- Mensaje cuando no hay filtro activo -->
      <div v-if="activeFilter === null && !isLoading" class="no-filter">
        <p>Selecciona un filtro en la leyenda para ver los resultados</p>
      </div>
    </div>

    <!-- Botón para limpiar filtros -->
    <button 
      v-if="activeFilter" 
      @click="clearFilter"
      class="btn btn-danger mt-3"
    >
      Limpiar Filtro
    </button>
  </div>

  <!-- Banner de productos Tierra de Sabor -->
  <div v-if="showProductsBanner" class="products-banner-overlay" @click="closeProductsBanner">
    <div class="products-banner" @click.stop>
      <div class="products-banner-header">
        <h3>{{ selectedEstablishment?.nombre_comercial || selectedEstablishment?.razon_social }}</h3>
        <button class="close-btn" @click="closeProductsBanner">&times;</button>
      </div>
      <div class="products-banner-content">
        <div v-if="loadingProducts" class="loading-container">
          <div class="spinner"></div>
          <p>Cargando productos...</p>
        </div>
        <div v-else-if="tierraSaborProducts.length > 0" class="products-grid">
          <div v-for="product in tierraSaborProducts" :key="product.id" class="product-card">
            <h4>{{ product.nombre }}</h4>
            <p v-if="product.categoria" class="product-category">{{ product.categoria }}</p>
            <p v-if="product.descripcion" class="product-description">{{ truncateText(product.descripcion, 150) }}</p>
            <div class="product-contact">
              <p v-if="product.telefono"><strong>📞</strong> {{ product.telefono }}</p>
              <p v-if="product.email"><strong>✉️</strong> {{ product.email }}</p>
              <p v-if="product.web"><strong>🌐</strong> <a :href="formatWebUrl(product.web)" target="_blank">Ver web</a></p>
            </div>
          </div>
        </div>
        <div v-else class="no-products">
          <p>No se encontraron productos para este establecimiento</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref } from 'vue'
import axios from 'axios'

export default {
  name: 'FilterResults',
  props: {
    activeFilter: {
      type: String,
      default: null
    },
    tierraSaborResults: {
      type: Array,
      default: () => []
    },
    teatroResults: {
      type: Array,
      default: () => []
    },
    pantallasResults: {
      type: Array,
      default: () => []
    },
    exposicionResults: {
      type: Array,
      default: () => []
    },
    isLoading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['clearFilter', 'itemSelected'],
  setup(props, { emit }) {
    // Variables reactivas para el banner de productos
    const showProductsBanner = ref(false)
    const selectedEstablishment = ref(null)
    const tierraSaborProducts = ref([])
    const loadingProducts = ref(false)
    
    const currentFilterTitle = computed(() => {
      switch (props.activeFilter) {
        case 'tierraSabor':
          return '🍯 Tierra de Sabor'
        case 'teatro':
          return '🎭 Teatro'
        case 'pantallas':
          return '🎬 Pantallas'
        case 'exposicion':
          return '🖼️ Exposiciones'
        default:
          return '📊 Aquí aparecerán los resultados de los filtros'
      }
    })

    const hasResults = computed(() => {
      if (!props.activeFilter) return false
      switch (props.activeFilter) {
        case 'tierraSabor':
          return props.tierraSaborResults.length > 0
        case 'teatro':
          return props.teatroResults.length > 0
        case 'pantallas':
          return props.pantallasResults.length > 0
        case 'exposicion':
          return props.exposicionResults.length > 0
        default:
          return false
      }
    })

    const clearFilter = () => {
      emit('clearFilter')
    }

    const showItemDetails = (item) => {
      emit('itemSelected', item)
    }

    const showTierraSaborProducts = async (establishment) => {
      selectedEstablishment.value = establishment
      showProductsBanner.value = true
      loadingProducts.value = true
      tierraSaborProducts.value = []

      try {
        const establishmentName = establishment.nombre_comercial || establishment.razon_social
        if (establishmentName) {
          const response = await axios.get(`/api/towns/tierra-sabor/${encodeURIComponent(establishmentName)}`)
          tierraSaborProducts.value = response.data
        }
      } catch (error) {
        console.error('Error obteniendo productos de Tierra de Sabor:', error)
        tierraSaborProducts.value = []
      } finally {
        loadingProducts.value = false
      }
    }

    const closeProductsBanner = () => {
      showProductsBanner.value = false
      selectedEstablishment.value = null
      tierraSaborProducts.value = []
    }

    const formatDate = (dateString) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    }

    const truncateText = (text, maxLength) => {
      if (!text) return ''
      return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
    }

    const formatWebUrl = (url) => {
      if (!url) return ''
      // Si ya tiene protocolo, devolverla tal como está
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url
      }
      // Si no tiene protocolo, agregar https://
      return `https://${url}`
    }

    return {
      currentFilterTitle,
      hasResults,
      clearFilter,
      showItemDetails,
      showTierraSaborProducts,
      closeProductsBanner,
      formatDate,
      truncateText,
      formatWebUrl,
      // Variables reactivas del banner
      showProductsBanner,
      selectedEstablishment,
      tierraSaborProducts,
      loadingProducts
    }
  }
}
</script>

<style scoped>
.filter-content {
  padding: 0;
}

.filter-content h2 {
  color: #333;
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #f0f0f0;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Estilos para los elementos de filtro */
.filter-item {
  background: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 12px;
  margin: 10px 0;
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 4px solid transparent;
}

.filter-item:hover {
  background: #f0f8ff;
  border-left-color: #4CAF50;
  transform: translateX(2px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.tierra-sabor-item {
  border-left-color: #ff9800;
}

.teatro-item {
  border-left-color: #e91e63;
}

.pantallas-item {
  border-left-color: #9c27b0;
}

.exposicion-item {
  border-left-color: #3f51b5;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.item-header h4 {
  margin: 0;
  font-size: 1rem;
  color: #333;
  flex: 1;
  line-height: 1.3;
}

.item-category {
  background: #4CAF50;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  white-space: nowrap;
  margin-left: 8px;
}

.item-details p {
  margin: 4px 0;
  font-size: 0.9rem;
  color: #666;
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4CAF50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.no-results, .no-filter {
  text-align: center;
  padding: 40px 20px;
  color: #666;
  font-style: italic;
}

/* Scroll personalizado */
.filter-results {
  max-height: 800px;
  overflow-y: auto;
}

.filter-results::-webkit-scrollbar {
  width: 6px;
}

.filter-results::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.filter-results::-webkit-scrollbar-thumb {
  background: #ffffff;
  border-radius: 3px;
}

.filter-results::-webkit-scrollbar-thumb:hover {
  background: #45a049;
}

/* Botones mejorados */
.btn-danger {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
  border: none;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn-danger:hover {
  background: linear-gradient(135deg, #ff5252 0%, #e91e63 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.4);
}

a {
  color: #ffffff;
  text-decoration: none;
}

a:hover {
  text-decoration: none;
}

/* Estilos para el banner de productos */
.products-banner-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.products-banner {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.products-banner-header {
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  color: white;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.products-banner-header h3 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 2rem;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.3s ease;
}

.close-btn:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.products-banner-content {
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

.product-card {
  background: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.product-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.product-card h4 {
  color: #333;
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.product-category {
  color: #4CAF50;
  font-weight: 500;
  font-size: 0.9rem;
  margin: 0 0 8px 0;
}

.product-description {
  color: #666;
  font-size: 0.9rem;
  line-height: 1.4;
  margin: 0 0 12px 0;
}

.product-contact {
  border-top: 1px solid #eee;
  padding-top: 8px;
}

.product-contact p {
  margin: 4px 0;
  font-size: 0.85rem;
  color: #555;
}

.product-contact a {
  color: #4CAF50;
  text-decoration: none;
}

.product-contact a:hover {
  text-decoration: underline;
}

.no-products {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

.no-products p {
  margin: 0;
  font-size: 1.1rem;
}
</style>
