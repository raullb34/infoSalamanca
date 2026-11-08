<template>
  <div class="search-container" :class="{ 'search-active': isSearchActive }">
    <div class="search-box">
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input
          ref="searchInput"
          v-model="searchQuery"
          @input="handleSearchInput"
          @focus="handleSearchFocus"
          @blur="handleSearchBlur"
          @keydown="handleKeyDown"
          type="text"
          :placeholder="isLoadingMunicipios ? 'Cargando municipios...' : 'Buscar municipio...'"
          class="search-input"
          :disabled="isLoadingMunicipios"
        />
        <button
          v-if="searchQuery"
          @click="clearSearch"
          class="clear-btn"
          title="Limpiar búsqueda"
        >
          ✕
        </button>
      </div>
      
      <!-- Dropdown de resultados -->
      <div 
        v-if="showResults && filteredMunicipios.length > 0" 
        class="search-results"
        ref="resultsContainer"
      >
        <div class="results-header">
          <span class="results-count">{{ filteredMunicipios.length }} resultado{{ filteredMunicipios.length !== 1 ? 's' : '' }}</span>
        </div>
        <div 
          v-for="(municipio, index) in filteredMunicipios" 
          :key="municipio.id"
          class="result-item"
          :class="{ 
            'highlighted': index === selectedIndex,
            'selected': selectedMunicipio?.id === municipio.id 
          }"
          @click="selectMunicipio(municipio)"
          @mouseenter="selectedIndex = index"
        >
          <div class="result-content">
            <span class="municipio-name">{{ municipio.name }}</span>
            <span class="municipio-province">{{ municipio.province }}</span>
          </div>
          <div class="result-actions">
            <span class="action-icon">📍</span>
          </div>
        </div>
      </div>
      
      <!-- Mensaje cuando no hay resultados -->
      <div 
        v-if="showResults && searchQuery && filteredMunicipios.length === 0 && !isLoadingMunicipios" 
        class="no-results"
      >
        <span class="no-results-icon">🔍</span>
        <span class="no-results-text">No se encontraron municipios que coincidan con "{{ searchQuery }}"</span>
      </div>

      <!-- Mensaje de carga -->
      <div 
        v-if="isLoadingMunicipios && showResults" 
        class="loading-state"
      >
        <span class="loading-icon">⏳</span>
        <span class="loading-text">Cargando municipios...</span>
      </div>
      
      <!-- Mensaje de ayuda cuando está vacío -->
      <div 
        v-if="showResults && !searchQuery && !isLoadingMunicipios" 
        class="search-help"
      >
        <div class="help-item">
          <span class="help-icon">🏘️</span>
          <span class="help-text">Busca municipios de Salamanca</span>
        </div>
        <div class="help-item">
          <span class="help-icon">⌨️</span>
          <span class="help-text">Usa las flechas ↑↓ para navegar</span>
        </div>
        <div class="help-item">
          <span class="help-icon">↵</span>
          <span class="help-text">Presiona Enter para seleccionar</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { apiService } from '@/services/apiService'

export default {
  name: 'SearchBar',
  emits: ['municipioSelected'],
  setup(props, { emit }) {
    const searchInput = ref(null)
    const resultsContainer = ref(null)
    const searchQuery = ref('')
    const isSearchActive = ref(false)
    const showResults = ref(false)
    const selectedIndex = ref(-1)
    const selectedMunicipio = ref(null)
    const municipios = ref([])
    const isLoadingMunicipios = ref(false)

    // Cargar municipios desde el backend
    const loadMunicipios = async () => {
      try {
        isLoadingMunicipios.value = true
        const data = await apiService.getMunicipiosList()
        municipios.value = data
        console.log(`✅ ${data.length} municipios cargados para búsqueda`)
      } catch (error) {
        console.error('Error cargando municipios:', error)
        // Fallback a lista básica en caso de error
        municipios.value = [
          { id: '37233', name: 'Salamanca', province: 'Salamanca' },
          { id: '37008', name: 'Alba de Tormes', province: 'Salamanca' },
          { id: '37042', name: 'Béjar', province: 'Salamanca' },
          { id: '37085', name: 'Ciudad Rodrigo', province: 'Salamanca' }
        ]
      } finally {
        isLoadingMunicipios.value = false
      }
    }
    
    // Para datos estáticos como fallback
    const municipiosEstaticos = ref([
      { id: '37001', name: 'Abusejo', province: 'Salamanca' },
      { id: '37002', name: 'Agallas', province: 'Salamanca' },
      { id: '37003', name: 'Ahigal de los Aceiteros', province: 'Salamanca' },
      { id: '37004', name: 'Ahigal de Villarino', province: 'Salamanca' },
      { id: '37005', name: 'Alameda de Gardón', province: 'Salamanca' },
      { id: '37006', name: 'Alamedilla', province: 'Salamanca' },
      { id: '37007', name: 'Alaraz', province: 'Salamanca' },
      { id: '37008', name: 'Alba de Tormes', province: 'Salamanca' },
      { id: '37009', name: 'Alba de Yeltes', province: 'Salamanca' },
      { id: '37010', name: 'Alberca, La', province: 'Salamanca' },
      { id: '37011', name: 'Alberguería de Argañán, La', province: 'Salamanca' },
      { id: '37012', name: 'Alconada', province: 'Salamanca' },
      { id: '37013', name: 'Aldeacipreste', province: 'Salamanca' },
      { id: '37014', name: 'Aldeadávila de la Ribera', province: 'Salamanca' },
      { id: '37015', name: 'Aldealengua', province: 'Salamanca' },
      { id: '37016', name: 'Aldeanueva de Figueroa', province: 'Salamanca' },
      { id: '37017', name: 'Aldeanueva de la Sierra', province: 'Salamanca' },
      { id: '37018', name: 'Aldearrodrigo', province: 'Salamanca' },
      { id: '37019', name: 'Aldearrubia', province: 'Salamanca' },
      { id: '37020', name: 'Aldeaseca de Alba', province: 'Salamanca' },
      { id: '37021', name: 'Aldeaseca de la Frontera', province: 'Salamanca' },
      { id: '37022', name: 'Aldeatejada', province: 'Salamanca' },
      { id: '37023', name: 'Aldehuela de la Bóveda', province: 'Salamanca' },
      { id: '37024', name: 'Aldehuela de Yeltes', province: 'Salamanca' },
      { id: '37025', name: 'Almenara de Tormes', province: 'Salamanca' },
      { id: '37026', name: 'Almendra', province: 'Salamanca' },
      { id: '37027', name: 'Anaya de Alba', province: 'Salamanca' },
      { id: '37028', name: 'Añover de Tormes', province: 'Salamanca' },
      { id: '37029', name: 'Arabayona de Mógica', province: 'Salamanca' },
      { id: '37030', name: 'Arapiles', province: 'Salamanca' },
      { id: '37031', name: 'Arcediano', province: 'Salamanca' },
      { id: '37032', name: 'Arevalillo', province: 'Salamanca' },
      { id: '37033', name: 'Armenteros', province: 'Salamanca' },
      { id: '37034', name: 'Atalaya, La', province: 'Salamanca' },
      { id: '37035', name: 'Babilafuente', province: 'Salamanca' },
      { id: '37036', name: 'Bañobárez', province: 'Salamanca' },
      { id: '37037', name: 'Barbadillo', province: 'Salamanca' },
      { id: '37038', name: 'Barbalos', province: 'Salamanca' },
      { id: '37039', name: 'Barceo', province: 'Salamanca' },
      { id: '37040', name: 'Barruecopardo', province: 'Salamanca' },
      { id: '37041', name: 'Bastida, La', province: 'Salamanca' },
      { id: '37042', name: 'Béjar', province: 'Salamanca' },
      { id: '37043', name: 'Beleña', province: 'Salamanca' },
      { id: '37044', name: 'Bermellar', province: 'Salamanca' },
      { id: '37045', name: 'Berrocal de Huebra', province: 'Salamanca' },
      { id: '37046', name: 'Berrocal de Salvatierra', province: 'Salamanca' },
      { id: '37047', name: 'Boada', province: 'Salamanca' },
      { id: '37048', name: 'Bóveda del Río Almar', province: 'Salamanca' },
      { id: '37049', name: 'Brincones', province: 'Salamanca' },
      { id: '37050', name: 'Cabaco, El', province: 'Salamanca' },
      { id: '37051', name: 'Cabeza de Caballo', province: 'Salamanca' },
      { id: '37052', name: 'Cabeza del Caballo', province: 'Salamanca' },
      { id: '37053', name: 'Cabezabellosa de la Calzada', province: 'Salamanca' },
      { id: '37054', name: 'Cabrerizos', province: 'Salamanca' },
      { id: '37055', name: 'Calvarrasa de Abajo', province: 'Salamanca' },
      { id: '37056', name: 'Calvarrasa de Arriba', province: 'Salamanca' },
      { id: '37057', name: 'Calzada de Don Diego', province: 'Salamanca' },
      { id: '37058', name: 'Calzada de Valdunciel', province: 'Salamanca' },
      { id: '37059', name: 'Campillo de Azaba', province: 'Salamanca' },
      { id: '37060', name: 'Campillo de Salvatierra', province: 'Salamanca' },
      { id: '37061', name: 'Campo de Peñaranda', province: 'Salamanca' },
      { id: '37062', name: 'Candelario', province: 'Salamanca' },
      { id: '37063', name: 'Canillas de Abajo', province: 'Salamanca' },
      { id: '37064', name: 'Cantagallo', province: 'Salamanca' },
      { id: '37065', name: 'Cantalpino', province: 'Salamanca' },
      { id: '37066', name: 'Cantaracillo', province: 'Salamanca' },
      { id: '37067', name: 'Carbajosa de la Sagrada', province: 'Salamanca' },
      { id: '37068', name: 'Carpio de Azaba', province: 'Salamanca' },
      { id: '37069', name: 'Carrascal de Barregas', province: 'Salamanca' },
      { id: '37070', name: 'Carrascal del Obispo', province: 'Salamanca' },
      { id: '37071', name: 'Casafranca', province: 'Salamanca' },
      { id: '37072', name: 'Casas del Conde, Las', province: 'Salamanca' },
      { id: '37073', name: 'Casillas de Flores', province: 'Salamanca' },
      { id: '37074', name: 'Castellanos de Moriscos', province: 'Salamanca' },
      { id: '37075', name: 'Castellanos de Villiquera', province: 'Salamanca' },
      { id: '37076', name: 'Castillejo de Martín Viejo', province: 'Salamanca' },
      { id: '37077', name: 'Castraz', province: 'Salamanca' },
      { id: '37078', name: 'Cepeda', province: 'Salamanca' },
      { id: '37079', name: 'Cereceda de la Sierra', province: 'Salamanca' },
      { id: '37080', name: 'Cerezal de Peñahorcada', province: 'Salamanca' },
      { id: '37081', name: 'Cerralbo', province: 'Salamanca' },
      { id: '37082', name: 'Charrido', province: 'Salamanca' },
      { id: '37083', name: 'Cilleros de la Bastida', province: 'Salamanca' },
      { id: '37084', name: 'Cipérez', province: 'Salamanca' },
      { id: '37085', name: 'Ciudad Rodrigo', province: 'Salamanca' },
      { id: '37086', name: 'Coca de Alba', province: 'Salamanca' },
      { id: '37087', name: 'Cochinos de Argañán', province: 'Salamanca' },
      { id: '37088', name: 'Colmenar de Montemayor', province: 'Salamanca' },
      { id: '37089', name: 'Cordobilla la Real', province: 'Salamanca' },
      { id: '37090', name: 'Cordovilla', province: 'Salamanca' },
      { id: '37091', name: 'Cristóbal', province: 'Salamanca' },
      { id: '37092', name: 'Cubo de Don Sancho, El', province: 'Salamanca' },
      { id: '37093', name: 'Cuelgamures', province: 'Salamanca' },
      { id: '37094', name: 'Dios le Guarde', province: 'Salamanca' },
      { id: '37095', name: 'Doñinos de Ledesma', province: 'Salamanca' },
      { id: '37096', name: 'Doñinos de Salamanca', province: 'Salamanca' },
      { id: '37097', name: 'Ejeme', province: 'Salamanca' },
      { id: '37098', name: 'Encina de San Silvestre', province: 'Salamanca' },
      { id: '37099', name: 'Encina, La', province: 'Salamanca' },
      { id: '37100', name: 'Encinas de Abajo', province: 'Salamanca' },
      { id: '37101', name: 'Encinas de Arriba', province: 'Salamanca' },
      { id: '37102', name: 'Encinasola de los Comendadores', province: 'Salamanca' },
      { id: '37103', name: 'Escurial de la Sierra', province: 'Salamanca' },
      { id: '37104', name: 'Espadaña', province: 'Salamanca' },
      { id: '37105', name: 'Espeja', province: 'Salamanca' },
      { id: '37106', name: 'Espino de la Orbada', province: 'Salamanca' },
      { id: '37107', name: 'Frades de la Sierra', province: 'Salamanca' },
      { id: '37108', name: 'Fregeneda, La', province: 'Salamanca' },
      { id: '37109', name: 'Fresno Alhándiga', province: 'Salamanca' },
      { id: '37110', name: 'Fuente de San Esteban, La', province: 'Salamanca' },
      { id: '37111', name: 'Fuentegiante', province: 'Salamanca' },
      { id: '37112', name: 'Fuenteguinaldo', province: 'Salamanca' },
      { id: '37113', name: 'Fuenteliante', province: 'Salamanca' },
      { id: '37114', name: 'Fuenterroble de Salvatierra', province: 'Salamanca' },
      { id: '37115', name: 'Fuentes de Béjar', province: 'Salamanca' },
      { id: '37116', name: 'Fuentes de Oñoro', province: 'Salamanca' },
      { id: '37117', name: 'Gajates', province: 'Salamanca' },
      { id: '37118', name: 'Galinduste', province: 'Salamanca' },
      { id: '37119', name: 'Galisancho', province: 'Salamanca' },
      { id: '37120', name: 'Gallegos de Argañán', province: 'Salamanca' },
      { id: '37121', name: 'Gallegos de Solmirón', province: 'Salamanca' },
      { id: '37122', name: 'Garcibuey', province: 'Salamanca' },
      { id: '37123', name: 'Garcihernández', province: 'Salamanca' },
      { id: '37124', name: 'Garcirrey', province: 'Salamanca' },
      { id: '37125', name: 'Gejo de los Reyes', province: 'Salamanca' },
      { id: '37126', name: 'Golpejas', province: 'Salamanca' },
      { id: '37127', name: 'Gomecello', province: 'Salamanca' },
      { id: '37128', name: 'Guadramiro', province: 'Salamanca' },
      { id: '37129', name: 'Guijo de Ávila', province: 'Salamanca' },
      { id: '37130', name: 'Guijuelo', province: 'Salamanca' },
      { id: '37131', name: 'Herguijuela de Ciudad Rodrigo', province: 'Salamanca' },
      { id: '37132', name: 'Herguijuela de la Sierra', province: 'Salamanca' },
      { id: '37133', name: 'Herguijuela del Campo', province: 'Salamanca' },
      { id: '37134', name: 'Hinojosa de Duero', province: 'Salamanca' },
      { id: '37135', name: 'Horcajo de Montemayor', province: 'Salamanca' },
      { id: '37136', name: 'Horcajo Medianero', province: 'Salamanca' },
      { id: '37137', name: 'Huerta', province: 'Salamanca' },
      { id: '37138', name: 'Iruelos', province: 'Salamanca' },
      { id: '37139', name: 'Ituero de Azaba', province: 'Salamanca' },
      { id: '37140', name: 'Juzbado', province: 'Salamanca' },
      { id: '37141', name: 'Lagunilla', province: 'Salamanca' },
      { id: '37142', name: 'Larrodrigo', province: 'Salamanca' },
      { id: '37143', name: 'Ledesma', province: 'Salamanca' },
      { id: '37144', name: 'Ledrada', province: 'Salamanca' },
      { id: '37145', name: 'Linares de Riofrío', province: 'Salamanca' },
      { id: '37146', name: 'Lumbrales', province: 'Salamanca' },
      { id: '37147', name: 'Macotera', province: 'Salamanca' },
      { id: '37148', name: 'Machacón', province: 'Salamanca' },
      { id: '37149', name: 'Malpartida de Corneja', province: 'Salamanca' },
      { id: '37150', name: 'Mancera de Abajo', province: 'Salamanca' },
      { id: '37151', name: 'Manzano, El', province: 'Salamanca' },
      { id: '37152', name: 'Martiago', province: 'Salamanca' },
      { id: '37153', name: 'Martín de Yeltes', province: 'Salamanca' },
      { id: '37154', name: 'Martinamor', province: 'Salamanca' },
      { id: '37155', name: 'Masueco', province: 'Salamanca' },
      { id: '37156', name: 'Mata de Ledesma, La', province: 'Salamanca' },
      { id: '37157', name: 'Matilla de los Caños del Río', province: 'Salamanca' },
      { id: '37158', name: 'Maya, La', province: 'Salamanca' },
      { id: '37159', name: 'Membribe de la Sierra', province: 'Salamanca' },
      { id: '37160', name: 'Mieza', province: 'Salamanca' },
      { id: '37161', name: 'Milano', province: 'Salamanca' },
      { id: '37162', name: 'Miranda de Azán', province: 'Salamanca' },
      { id: '37163', name: 'Miranda del Castañar', province: 'Salamanca' },
      { id: '37164', name: 'Mogarraz', province: 'Salamanca' },
      { id: '37165', name: 'Molinillo', province: 'Salamanca' },
      { id: '37166', name: 'Monforte de la Sierra', province: 'Salamanca' },
      { id: '37167', name: 'Monleón', province: 'Salamanca' },
      { id: '37168', name: 'Monleras', province: 'Salamanca' },
      { id: '37169', name: 'Montejo', province: 'Salamanca' },
      { id: '37170', name: 'Montemayor del Río', province: 'Salamanca' },
      { id: '37171', name: 'Monterrubio de Armuña', province: 'Salamanca' },
      { id: '37172', name: 'Monterrubio de la Sierra', province: 'Salamanca' },
      { id: '37173', name: 'Morasverdes', province: 'Salamanca' },
      { id: '37174', name: 'Morille', province: 'Salamanca' },
      { id: '37175', name: 'Moríñigo', province: 'Salamanca' },
      { id: '37176', name: 'Moriscos', province: 'Salamanca' },
      { id: '37177', name: 'Mozárbez', province: 'Salamanca' },
      { id: '37178', name: 'Murco de la Fuentecilla', province: 'Salamanca' },
      { id: '37179', name: 'Nava de Béjar', province: 'Salamanca' },
      { id: '37180', name: 'Nava de Francia', province: 'Salamanca' },
      { id: '37181', name: 'Nava de Sotrobal', province: 'Salamanca' },
      { id: '37182', name: 'Navarredonda de la Rinconada', province: 'Salamanca' },
      { id: '37183', name: 'Navasfrías', province: 'Salamanca' },
      { id: '37184', name: 'Negrilla de Palencia', province: 'Salamanca' },
      { id: '37185', name: 'Olmedo de Camaces', province: 'Salamanca' },
      { id: '37186', name: 'Orbada, La', province: 'Salamanca' },
      { id: '37187', name: 'Pajares de la Laguna', province: 'Salamanca' },
      { id: '37188', name: 'Palaciosrubios', province: 'Salamanca' },
      { id: '37189', name: 'Palencia de Negrilla', province: 'Salamanca' },
      { id: '37190', name: 'Parada de Arriba', province: 'Salamanca' },
      { id: '37191', name: 'Parada de Rubiales', province: 'Salamanca' },
      { id: '37192', name: 'Paradinas de San Juan', province: 'Salamanca' },
      { id: '37193', name: 'Pastores', province: 'Salamanca' },
      { id: '37194', name: 'Payo, El', province: 'Salamanca' },
      { id: '37195', name: 'Pedraza de Alba', province: 'Salamanca' },
      { id: '37196', name: 'Pedrosillo de Alba', province: 'Salamanca' },
      { id: '37197', name: 'Pedrosillo de los Aires', province: 'Salamanca' },
      { id: '37198', name: 'Pedrosillo el Ralo', province: 'Salamanca' },
      { id: '37199', name: 'Pedroso de la Armuña, El', province: 'Salamanca' },
      { id: '37200', name: 'Pelabravo', province: 'Salamanca' },
      { id: '37201', name: 'Pelayos', province: 'Salamanca' },
      { id: '37202', name: 'Peña, La', province: 'Salamanca' },
      { id: '37203', name: 'Peñacaballera', province: 'Salamanca' },
      { id: '37204', name: 'Peñaparda', province: 'Salamanca' },
      { id: '37205', name: 'Peñaranda de Bracamonte', province: 'Salamanca' },
      { id: '37206', name: 'Peñarandilla', province: 'Salamanca' },
      { id: '37207', name: 'Peralejos de Abajo', province: 'Salamanca' },
      { id: '37208', name: 'Peralejos de Arriba', province: 'Salamanca' },
      { id: '37209', name: 'Pereña de la Ribera', province: 'Salamanca' },
      { id: '37210', name: 'Peromingo', province: 'Salamanca' },
      { id: '37211', name: 'Pitiegua', province: 'Salamanca' },
      { id: '37212', name: 'Pizarral', province: 'Salamanca' },
      { id: '37213', name: 'Poveda de las Cintas', province: 'Salamanca' },
      { id: '37214', name: 'Pozos de Hinojo', province: 'Salamanca' },
      { id: '37215', name: 'Puebla de Azaba', province: 'Salamanca' },
      { id: '37216', name: 'Puebla de San Medel', province: 'Salamanca' },
      { id: '37217', name: 'Puebla de Yeltes', province: 'Salamanca' },
      { id: '37218', name: 'Puente del Congosto', province: 'Salamanca' },
      { id: '37219', name: 'Puertas', province: 'Salamanca' },
      { id: '37220', name: 'Puerto de Béjar', province: 'Salamanca' },
      { id: '37221', name: 'Puerto Seguro', province: 'Salamanca' },
      { id: '37222', name: 'Quilamas', province: 'Salamanca' },
      { id: '37223', name: 'Rágama', province: 'Salamanca' },
      { id: '37224', name: 'Redonda, La', province: 'Salamanca' },
      { id: '37225', name: 'Retortillo', province: 'Salamanca' },
      { id: '37226', name: 'Revilla de la Sierra', province: 'Salamanca' },
      { id: '37227', name: 'Robleda', province: 'Salamanca' },
      { id: '37228', name: 'Robliza de Cojos', province: 'Salamanca' },
      { id: '37229', name: 'Rollán', province: 'Salamanca' },
      { id: '37230', name: 'Rubiales de Arriba', province: 'Salamanca' },
      { id: '37231', name: 'Sagrada, La', province: 'Salamanca' },
      { id: '37232', name: 'Sahugo', province: 'Salamanca' },
      { id: '37233', name: 'Salamanca', province: 'Salamanca' },
      { id: '37234', name: 'Saldeana', province: 'Salamanca' },
      { id: '37235', name: 'Salmoral', province: 'Salamanca' },
      { id: '37236', name: 'Salvatierra de Tormes', province: 'Salamanca' },
      { id: '37237', name: 'San Cristóbal de la Cuesta', province: 'Salamanca' },
      { id: '37238', name: 'San Esteban de la Sierra', province: 'Salamanca' },
      { id: '37239', name: 'San Felices de los Gallegos', province: 'Salamanca' },
      { id: '37240', name: 'San Martín del Castañar', province: 'Salamanca' },
      { id: '37241', name: 'San Miguel de Valero', province: 'Salamanca' },
      { id: '37242', name: 'San Miguel del Robledo', province: 'Salamanca' },
      { id: '37243', name: 'San Morales', province: 'Salamanca' },
      { id: '37244', name: 'San Muñoz', province: 'Salamanca' },
      { id: '37245', name: 'San Pedro de Rozados', province: 'Salamanca' },
      { id: '37246', name: 'San Pedro del Valle', province: 'Salamanca' },
      { id: '37247', name: 'San Pelayo de Guareña', province: 'Salamanca' },
      { id: '37248', name: 'Sanchón de la Ribera', province: 'Salamanca' },
      { id: '37249', name: 'Sanchón de la Sagrada', province: 'Salamanca' },
      { id: '37250', name: 'Sanchotello', province: 'Salamanca' },
      { id: '37251', name: 'Sancti-Spíritus', province: 'Salamanca' },
      { id: '37252', name: 'Santa María de Sando', province: 'Salamanca' },
      { id: '37253', name: 'Santa Marta de Tormes', province: 'Salamanca' },
      { id: '37254', name: 'Santiago de la Puebla', province: 'Salamanca' },
      { id: '37255', name: 'Santibáñez de Béjar', province: 'Salamanca' },
      { id: '37256', name: 'Santibáñez de la Sierra', province: 'Salamanca' },
      { id: '37257', name: 'Santiz', province: 'Salamanca' },
      { id: '37258', name: 'Santos, Los', province: 'Salamanca' },
      { id: '37259', name: 'Sardón de los Frailes', province: 'Salamanca' },
      { id: '37260', name: 'Saucelle', province: 'Salamanca' },
      { id: '37261', name: 'Sepulcro-Hilario', province: 'Salamanca' },
      { id: '37262', name: 'Sequeros', province: 'Salamanca' },
      { id: '37263', name: 'Serradilla del Arroyo', province: 'Salamanca' },
      { id: '37264', name: 'Serradilla del Llano', province: 'Salamanca' },
      { id: '37265', name: 'Sierpe, La', province: 'Salamanca' },
      { id: '37266', name: 'Sieteiglesias', province: 'Salamanca' },
      { id: '37267', name: 'Sobradillo', province: 'Salamanca' },
      { id: '37268', name: 'Sorihuela', province: 'Salamanca' },
      { id: '37269', name: 'Sotoserrano', province: 'Salamanca' },
      { id: '37270', name: 'Tabera de Abajo', province: 'Salamanca' },
      { id: '37271', name: 'Tala', province: 'Salamanca' },
      { id: '37272', name: 'Tamames', province: 'Salamanca' },
      { id: '37273', name: 'Tarazona de Guareña', province: 'Salamanca' },
      { id: '37274', name: 'Tardáguila', province: 'Salamanca' },
      { id: '37275', name: 'Tejado, El', province: 'Salamanca' },
      { id: '37276', name: 'Tejeda y Segoyuela', province: 'Salamanca' },
      { id: '37277', name: 'Tenebrón', province: 'Salamanca' },
      { id: '37278', name: 'Terradillos', province: 'Salamanca' },
      { id: '37279', name: 'Topas', province: 'Salamanca' },
      { id: '37280', name: 'Tordillos', province: 'Salamanca' },
      { id: '37281', name: 'Tornadizo, El', province: 'Salamanca' },
      { id: '37282', name: 'Torresmenudas', province: 'Salamanca' },
      { id: '37283', name: 'Trabanca', province: 'Salamanca' },
      { id: '37284', name: 'Tremedal de Tormes', province: 'Salamanca' },
      { id: '37285', name: 'Turra, La', province: 'Salamanca' },
      { id: '37286', name: 'Urdiales, Los', province: 'Salamanca' },
      { id: '37287', name: 'Valdecarros', province: 'Salamanca' },
      { id: '37288', name: 'Valdefuentes de Sangusín', province: 'Salamanca' },
      { id: '37289', name: 'Valdehijaderos', province: 'Salamanca' },
      { id: '37290', name: 'Valdelacasa', province: 'Salamanca' },
      { id: '37291', name: 'Valdelageve', province: 'Salamanca' },
      { id: '37292', name: 'Valdelosa', province: 'Salamanca' },
      { id: '37293', name: 'Valdemierque', province: 'Salamanca' },
      { id: '37294', name: 'Valderrodrigo', province: 'Salamanca' },
      { id: '37295', name: 'Valdunciel', province: 'Salamanca' },
      { id: '37296', name: 'Valencia de San Juan', province: 'Salamanca' },
      { id: '37297', name: 'Valero', province: 'Salamanca' },
      { id: '37298', name: 'Vallejera de Riofrío', province: 'Salamanca' },
      { id: '37299', name: 'Valsalabroso', province: 'Salamanca' },
      { id: '37300', name: 'Valverde de Valdelacasa', province: 'Salamanca' },
      { id: '37301', name: 'Valverdón', province: 'Salamanca' },
      { id: '37302', name: 'Vecinos', province: 'Salamanca' },
      { id: '37303', name: 'Vega de Tirados', province: 'Salamanca' },
      { id: '37304', name: 'Velayos', province: 'Salamanca' },
      { id: '37305', name: 'Vellés, La', province: 'Salamanca' },
      { id: '37306', name: 'Ventosa del Río Almar', province: 'Salamanca' },
      { id: '37307', name: 'Vídola, La', province: 'Salamanca' },
      { id: '37308', name: 'Vieja, La', province: 'Salamanca' },
      { id: '37309', name: 'Villaflores', province: 'Salamanca' },
      { id: '37310', name: 'Villagonzalo de Tormes', province: 'Salamanca' },
      { id: '37311', name: 'Villamayor', province: 'Salamanca' },
      { id: '37312', name: 'Villanueva del Conde', province: 'Salamanca' },
      { id: '37313', name: 'Villar de Argañán', province: 'Salamanca' },
      { id: '37314', name: 'Villar de Ciervo', province: 'Salamanca' },
      { id: '37315', name: 'Villar de Gallimazo', province: 'Salamanca' },
      { id: '37316', name: 'Villar de la Yegua', province: 'Salamanca' },
      { id: '37317', name: 'Villar de Peralonso', province: 'Salamanca' },
      { id: '37318', name: 'Villar de Samaniego', province: 'Salamanca' },
      { id: '37319', name: 'Villares de la Reina', province: 'Salamanca' },
      { id: '37320', name: 'Villares de Yeltes', province: 'Salamanca' },
      { id: '37321', name: 'Villarino de los Aires', province: 'Salamanca' },
      { id: '37322', name: 'Villarmayor', province: 'Salamanca' },
      { id: '37323', name: 'Villarmuerto', province: 'Salamanca' },
      { id: '37324', name: 'Villasbuenas', province: 'Salamanca' },
      { id: '37325', name: 'Villasdardo', province: 'Salamanca' },
      { id: '37326', name: 'Villaseco de los Gamitos', province: 'Salamanca' },
      { id: '37327', name: 'Villaseco de los Reyes', province: 'Salamanca' },
      { id: '37328', name: 'Villasrubias', province: 'Salamanca' },
      { id: '37329', name: 'Villavieja de Yeltes', province: 'Salamanca' },
      { id: '37330', name: 'Villaverde de Guareña', province: 'Salamanca' },
      { id: '37331', name: 'Villoruela', province: 'Salamanca' },
      { id: '37332', name: 'Yecla de Yeltes', province: 'Salamanca' },
      { id: '37333', name: 'Zafrón', province: 'Salamanca' },
      { id: '37334', name: 'Zamarra', province: 'Salamanca' },
      { id: '37335', name: 'Zamayón', province: 'Salamanca' },
      { id: '37336', name: 'Zorita de la Frontera', province: 'Salamanca' }
    ])

    // Computed para filtrar municipios basado en la búsqueda
    const filteredMunicipios = computed(() => {
      if (!searchQuery.value.trim() || isLoadingMunicipios.value) return []
      
      const query = searchQuery.value.toLowerCase().trim()
      return municipios.value
        .filter(municipio => 
          municipio.name.toLowerCase().includes(query) ||
          municipio.id.includes(query)
        )
        .slice(0, 10) // Limitar a 10 resultados máximo
    })

    // Manejar input de búsqueda
    const handleSearchInput = () => {
      selectedIndex.value = -1
      if (searchQuery.value.trim()) {
        showResults.value = true
      }
    }

    // Manejar focus del input
    const handleSearchFocus = () => {
      isSearchActive.value = true
      showResults.value = true
    }

    // Manejar blur del input (con delay para clicks)
    const handleSearchBlur = () => {
      setTimeout(() => {
        isSearchActive.value = false
        showResults.value = false
        selectedIndex.value = -1
      }, 200)
    }

    // Limpiar búsqueda
    const clearSearch = () => {
      searchQuery.value = ''
      showResults.value = false
      selectedIndex.value = -1
      selectedMunicipio.value = null
      searchInput.value?.focus()
    }

    // Manejar navegación con teclado
    const handleKeyDown = (event) => {
      if (!showResults.value || filteredMunicipios.value.length === 0) return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          selectedIndex.value = Math.min(
            selectedIndex.value + 1, 
            filteredMunicipios.value.length - 1
          )
          scrollToSelected()
          break
        case 'ArrowUp':
          event.preventDefault()
          selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
          scrollToSelected()
          break
        case 'Enter':
          event.preventDefault()
          if (selectedIndex.value >= 0) {
            selectMunicipio(filteredMunicipios.value[selectedIndex.value])
          }
          break
        case 'Escape':
          clearSearch()
          break
      }
    }

    // Scroll al elemento seleccionado
    const scrollToSelected = () => {
      nextTick(() => {
        const container = resultsContainer.value
        if (!container) return

        const selectedElement = container.querySelector('.result-item.highlighted')
        if (selectedElement) {
          selectedElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
          })
        }
      })
    }

    // Seleccionar municipio
    const selectMunicipio = (municipio) => {
      selectedMunicipio.value = municipio
      searchQuery.value = municipio.name
      showResults.value = false
      isSearchActive.value = false
      
      // Emitir evento con el municipio seleccionado
      emit('municipioSelected', municipio)
      
      console.log('Municipio seleccionado:', municipio)
    }

    // Click fuera para cerrar
    const handleClickOutside = (event) => {
      const searchContainer = event.target.closest('.search-container')
      if (!searchContainer) {
        showResults.value = false
        isSearchActive.value = false
      }
    }

    onMounted(() => {
      loadMunicipios()
      document.addEventListener('click', handleClickOutside)
    })

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside)
    })

    return {
      searchInput,
      resultsContainer,
      searchQuery,
      isSearchActive,
      showResults,
      selectedIndex,
      selectedMunicipio,
      filteredMunicipios,
      handleSearchInput,
      handleSearchFocus,
      handleSearchBlur,
      clearSearch,
      handleKeyDown,
      selectMunicipio,
      isLoadingMunicipios,
      loadMunicipios
    }
  }
}
</script>

<style scoped>
/* Va dentro de la barra superior (App.vue): ocupa el espacio central */
.search-container {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 520px;
  margin: 0 auto;
  z-index: 1500;
}

.search-box {
  position: relative;
  background: var(--bg-secondary);
  border-radius: 12px;
  box-shadow: none;
  backdrop-filter: blur(10px);
  /* Unified border using theme token; var(--border-color) removed for consistency */
  border: 1px solid var(--border-secondary);
  outline: 0;
  overflow: visible; /* el desplegable sale por debajo */
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-container.search-active .search-box {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25), 0 0 0 2px rgba(var(--primary-color-rgb), 0.3);
  border-color: var(--primary-color);
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  padding: 0 16px;
  min-height: 40px;
}

.search-icon {
  font-size: 1.2em;
  color: var(--text-secondary);
  margin-right: 12px;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  min-width: 0; /* que encoja en móvil en vez de pisar el selector 2D/3D */
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 500;
  padding: 8px 0;
}

@media (max-width: 767px) {
  .search-input {
    font-size: 16px; /* 16 px evita el zoom automático de iOS al enfocar */
  }

  .search-icon {
    margin-right: 6px;
  }

  .search-input-wrapper {
    padding: 0 10px;
  }
}

.search-input::placeholder {
  color: var(--text-muted);
  font-weight: 400;
}

.clear-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
  margin-left: 8px;
}

.clear-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

/* Resultados de búsqueda */
/* Desplegables flotantes bajo el buscador (no empujan la barra) */
.no-results,
.loading-state,
.search-help {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
}

.search-results {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  max-height: 60vh;
  overflow-y: auto;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
}

.results-header {
  padding: 12px 16px 8px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-secondary);
}

.results-count {
  font-size: 0.85em;
  color: var(--text-secondary);
  font-weight: 500;
}

.result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid var(--border-light);
}

.result-item:last-child {
  border-bottom: none;
}

.result-item:hover,
.result-item.highlighted {
  background: var(--hover-bg);
}

.result-item.selected {
  background: var(--primary-color);
  color: white;
}

.result-item.selected .municipio-name,
.result-item.selected .municipio-province {
  color: white;
}

.result-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.municipio-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.95em;
}

.municipio-province {
  font-size: 0.8em;
  color: var(--text-secondary);
  opacity: 0.8;
}

.result-actions {
  display: flex;
  align-items: center;
  margin-left: 12px;
}

.action-icon {
  font-size: 1.1em;
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.result-item:hover .action-icon,
.result-item.highlighted .action-icon {
  opacity: 1;
}

/* No hay resultados */
.no-results {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-secondary);
}

.no-results-icon {
  font-size: 2em;
  display: block;
  margin-bottom: 8px;
  opacity: 0.5;
}

.no-results-text {
  font-size: 0.9em;
  line-height: 1.4;
}

/* Estado de carga */
.loading-state {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-secondary);
}

.loading-icon {
  font-size: 2em;
  display: block;
  margin-bottom: 8px;
  opacity: 0.7;
  animation: pulse 1.5s ease-in-out infinite;
}

.loading-text {
  font-size: 0.9em;
  line-height: 1.4;
}

@keyframes pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

/* Ayuda de búsqueda */
.search-help {
  padding: 16px;
  background: var(--bg-secondary);
}

.help-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  font-size: 0.85em;
  color: var(--text-secondary);
}

.help-icon {
  font-size: 1.1em;
  width: 20px;
  text-align: center;
  opacity: 0.7;
}

.help-text {
  line-height: 1.3;
}

/* Scroll personalizado */
.search-results::-webkit-scrollbar {
  width: 6px;
}

.search-results::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

.search-results::-webkit-scrollbar-thumb {
  background: var(--border-secondary);
  border-radius: 3px;
}

.search-results::-webkit-scrollbar-thumb:hover {
  background: var(--primary-color);
}

/* Responsive */
@media (max-width: 480px) {
  .search-box {
    border-radius: 8px;
  }
  
  .search-input-wrapper {
    min-height: 40px;
    padding: 0 10px;
  }
  
  .search-results {
    max-height: 200px;
  }
}

/* Animaciones */
@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.search-results {
  animation: fadeInDown 0.3s ease;
}

/* Estados de focus */
.search-input:focus {
  outline: none;
  /* subtle glow for accessibility */
  box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.35);
}

.search-container.search-active .search-icon {
  color: var(--primary-color);
}

/* Mejoras de accesibilidad */
.result-item:focus {
  outline: 2px solid var(--primary-color);
  outline-offset: -2px;
}

.clear-btn:focus {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}
</style>

