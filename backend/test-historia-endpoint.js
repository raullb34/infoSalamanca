/**
 * Script de pruebas para validar el endpoint de historia de municipios
 * Uso: node test-historia-endpoint.js
 */

require('dotenv').config();

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

// Función auxiliar para hacer peticiones
async function fetchAPI(endpoint) {
  try {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`\n🔗 Probando: ${url}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Status: ${response.status}`);
      if (data.metadata) {
        console.log(`📊 Resultados: ${data.metadata.total_resultados || data.metadata.total_municipios || '1'}`);
      }
      return data;
    } else {
      console.log(`❌ Status: ${response.status}`);
      console.log(`❌ Error:`, data);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error de conexión:`, error.message);
    return null;
  }
}

async function probarEndpoints() {
  console.log('🧪 INICIANDO PRUEBAS DEL ENDPOINT DE HISTORIA');
  console.log('='.repeat(50));
  
  // 1. Verificar que el servidor esté funcionando
  console.log('\n1️⃣ VERIFICANDO SERVIDOR...');
  const health = await fetchAPI('/health');
  if (!health) {
    console.error('❌ El servidor no está disponible');
    return;
  }
  
  // 2. Obtener historia completa de Salamanca
  console.log('\n2️⃣ HISTORIA COMPLETA - SALAMANCA (37274)');
  const historiaSalamanca = await fetchAPI('/api/historia/37274');
  
  if (historiaSalamanca) {
    console.log(`📖 Municipio: ${historiaSalamanca.data.nombre_municipio}`);
    console.log(`🏛️ Períodos históricos: ${historiaSalamanca.data.periodos_historicos?.length || 0}`);
    console.log(`🏛️ Monumentos: ${historiaSalamanca.data.monumentos_historicos?.length || 0}`);
    console.log(`👤 Personajes: ${historiaSalamanca.data.personajes_ilustres?.length || 0}`);
  }
  
  // 3. Obtener resumen histórico
  console.log('\n3️⃣ RESUMEN HISTÓRICO - SALAMANCA');
  const resumenSalamanca = await fetchAPI('/api/historia/37274?resumen=true');
  
  if (resumenSalamanca) {
    console.log(`📝 Resumen:`, resumenSalamanca.data.resumen_historico?.substring(0, 100) + '...');
  }
  
  // 4. Historia de La Alberca
  console.log('\n4️⃣ HISTORIA COMPLETA - LA ALBERCA (37010)');
  const historiaAlberca = await fetchAPI('/api/historia/37010');
  
  if (historiaAlberca) {
    console.log(`📖 Municipio: ${historiaAlberca.data.nombre_municipio}`);
    console.log(`🎭 Tradiciones: ${historiaAlberca.data.leyendas_tradiciones?.length || 0}`);
  }
  
  // 5. Búsqueda de texto
  console.log('\n5️⃣ BÚSQUEDA DE TEXTO - "universidad"');
  const busquedaUniversidad = await fetchAPI('/api/historia/buscar/texto?q=universidad');
  
  if (busquedaUniversidad) {
    console.log(`🔍 Municipios encontrados con "universidad":`);
    busquedaUniversidad.data.forEach(item => {
      console.log(`  - ${item.nombre_municipio} (${item.cod_ine})`);
    });
  }
  
  // 6. Búsqueda de texto - término específico
  console.log('\n6️⃣ BÚSQUEDA DE TEXTO - "catedral"');
  const busquedaCatedral = await fetchAPI('/api/historia/buscar/texto?q=catedral');
  
  // 7. Búsqueda por período histórico
  console.log('\n7️⃣ BÚSQUEDA POR PERÍODO - "Medieval"');
  const periodoMedieval = await fetchAPI('/api/historia/periodo/medieval');
  
  // 8. Búsqueda por período - más específico
  console.log('\n8️⃣ BÚSQUEDA POR PERÍODO - "Época Romana"');
  const periodoRomano = await fetchAPI('/api/historia/periodo/Época Romana');
  
  // 9. Búsqueda por tags
  console.log('\n9️⃣ BÚSQUEDA POR TAGS - "universidad,medieval"');
  const tagsBusqueda = await fetchAPI('/api/historia/tags/universidad,medieval');
  
  // 10. Búsqueda por tags individuales
  console.log('\n🔟 BÚSQUEDA POR TAGS - "tradiciones"');
  const tagsTradiciones = await fetchAPI('/api/historia/tags/tradiciones');
  
  // 11. Eventos por cronología
  console.log('\n1️⃣1️⃣ EVENTOS CRONOLÓGICOS - Años 1200-1500');
  const eventosMedievales = await fetchAPI('/api/historia/eventos/cronologia?inicio=1200&fin=1500');
  
  if (eventosMedievales) {
    console.log(`📅 Eventos encontrados entre 1200-1500:`);
    eventosMedievales.data.slice(0, 3).forEach(evento => {
      console.log(`  - ${evento.fecha}: ${evento.descripcion} (${evento.municipio})`);
    });
  }
  
  // 12. Eventos cronología amplia
  console.log('\n1️⃣2️⃣ EVENTOS CRONOLÓGICOS - Siglo de Oro (1500-1700)');
  const eventosSigloOro = await fetchAPI('/api/historia/eventos/cronologia?inicio=1500&fin=1700');
  
  // 13. Estadísticas generales
  console.log('\n1️⃣3️⃣ ESTADÍSTICAS GENERALES');
  const estadisticas = await fetchAPI('/api/historia/estadisticas/generales');
  
  if (estadisticas) {
    const stats = estadisticas.data;
    console.log(`📊 Total municipios con historia: ${stats.total_municipios}`);
    console.log(`📊 Total monumentos registrados: ${stats.total_monumentos}`);
    console.log(`📊 Total personajes ilustres: ${stats.total_personajes}`);
    console.log(`📊 Períodos históricos únicos: ${stats.periodos_unicos?.length || 0}`);
    
    if (stats.municipios_por_tags) {
      console.log(`🏷️ Tags más frecuentes:`);
      Object.entries(stats.municipios_por_tags)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([tag, count]) => {
          console.log(`  - ${tag}: ${count} municipios`);
        });
    }
  }
  
  // 14. Pruebas de error - código INE inválido
  console.log('\n1️⃣4️⃣ PRUEBA DE ERROR - Código INE inválido');
  await fetchAPI('/api/historia/99999');
  
  // 15. Pruebas de error - búsqueda muy corta
  console.log('\n1️⃣5️⃣ PRUEBA DE ERROR - Búsqueda muy corta');
  await fetchAPI('/api/historia/buscar/texto?q=ab');
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ PRUEBAS COMPLETADAS');
  console.log('\n📋 RESUMEN DE ENDPOINTS PROBADOS:');
  console.log('   ✅ GET /api/historia/:codIne');
  console.log('   ✅ GET /api/historia/:codIne?resumen=true');
  console.log('   ✅ GET /api/historia/buscar/texto?q=term');
  console.log('   ✅ GET /api/historia/periodo/:periodo');
  console.log('   ✅ GET /api/historia/tags/:tags');
  console.log('   ✅ GET /api/historia/eventos/cronologia?inicio=X&fin=Y');
  console.log('   ✅ GET /api/historia/estadisticas/generales');
  console.log('\n🔗 Para más pruebas manuales:');
  console.log(`   curl "${BASE_URL}/api/historia/37274"`);
  console.log(`   curl "${BASE_URL}/api/historia/buscar/texto?q=universidad"`);
  console.log(`   curl "${BASE_URL}/api/historia/estadisticas/generales"`);
}

// Verificar que fetch esté disponible (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ Este script requiere Node.js 18+ o instalar node-fetch');
  console.log('💡 Instala node-fetch: npm install node-fetch');
  console.log('💡 O usa Node.js 18+');
  process.exit(1);
}

// Ejecutar pruebas
probarEndpoints().catch(console.error);
