/**
 * Test script to validate municipal history endpoints
 * Usage: node test-history-endpoints.js
 */

require('dotenv').config();

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

// Helper function to make API requests
async function fetchAPI(endpoint) {
  try {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`\n🔗 Testing: ${url}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Status: ${response.status}`);
      if (data.metadata) {
        console.log(`📊 Results: ${data.metadata.total_results || data.metadata.total_municipalities || data.metadata.total_events || '1'}`);
      }
      return data;
    } else {
      console.log(`❌ Status: ${response.status}`);
      console.log(`❌ Error:`, data);
      return null;
    }
  } catch (error) {
    console.error(`❌ Connection error:`, error.message);
    return null;
  }
}

async function testEndpoints() {
  console.log('🧪 STARTING HISTORY ENDPOINT TESTS');
  console.log('='.repeat(50));
  
  // 1. Check server is running
  console.log('\n1️⃣ CHECKING SERVER...');
  const health = await fetchAPI('/health');
  if (!health) {
    console.error('❌ Server is not available');
    return;
  }
  
  // 2. Get complete history of Salamanca
  console.log('\n2️⃣ COMPLETE HISTORY - SALAMANCA (37274)');
  const salamancaHistory = await fetchAPI('/api/history/37274');
  
  if (salamancaHistory) {
    console.log(`📖 Municipality: ${salamancaHistory.data.municipality_name}`);
    console.log(`🏛️ Historical periods: ${salamancaHistory.data.historical_periods?.length || 0}`);
    console.log(`🏛️ Monuments: ${salamancaHistory.data.historical_monuments?.length || 0}`);
    console.log(`👤 Figures: ${salamancaHistory.data.illustrious_figures?.length || 0}`);
  }
  
  // 3. Get historical summary
  console.log('\n3️⃣ HISTORICAL SUMMARY - SALAMANCA');
  const salamancaSummary = await fetchAPI('/api/history/37274?summary=true');
  
  if (salamancaSummary) {
    console.log(`📝 Summary:`, salamancaSummary.data.historical_summary?.substring(0, 100) + '...');
  }
  
  // 4. History of La Alberca
  console.log('\n4️⃣ COMPLETE HISTORY - LA ALBERCA (37010)');
  const albercaHistory = await fetchAPI('/api/history/37010');
  
  if (albercaHistory) {
    console.log(`📖 Municipality: ${albercaHistory.data.municipality_name}`);
    console.log(`🎭 Traditions: ${albercaHistory.data.legends_traditions?.length || 0}`);
  }
  
  // 5. Text search
  console.log('\n5️⃣ TEXT SEARCH - "university"');
  const universitySearch = await fetchAPI('/api/history/search/text?q=university');
  
  if (universitySearch) {
    console.log(`🔍 Municipalities found with "university":`);
    universitySearch.data.forEach(item => {
      console.log(`  - ${item.municipality_name} (${item.cod_ine})`);
    });
  }
  
  // 6. Text search - specific term
  console.log('\n6️⃣ TEXT SEARCH - "cathedral"');
  const cathedralSearch = await fetchAPI('/api/history/search/text?q=cathedral');
  
  // 7. Search by historical period
  console.log('\n7️⃣ SEARCH BY PERIOD - "Medieval"');
  const medievalPeriod = await fetchAPI('/api/history/period/medieval');
  
  // 8. Search by period - more specific
  console.log('\n8️⃣ SEARCH BY PERIOD - "Roman Period"');
  const romanPeriod = await fetchAPI('/api/history/period/Roman Period');
  
  // 9. Search by tags
  console.log('\n9️⃣ SEARCH BY TAGS - "university,medieval"');
  const tagsSearch = await fetchAPI('/api/history/tags/university,medieval');
  
  // 10. Search by individual tags
  console.log('\n🔟 SEARCH BY TAGS - "traditions"');
  const traditionsTag = await fetchAPI('/api/history/tags/traditions');
  
  // 11. Events by chronology
  console.log('\n1️⃣1️⃣ CHRONOLOGICAL EVENTS - Years 1200-1500');
  const medievalEvents = await fetchAPI('/api/history/events/chronology?start=1200&end=1500');
  
  if (medievalEvents) {
    console.log(`📅 Events found between 1200-1500:`);
    medievalEvents.data.slice(0, 3).forEach(event => {
      console.log(`  - ${event.event.date}: ${event.event.description} (${event.municipality})`);
    });
  }
  
  // 12. Wide chronology events
  console.log('\n1️⃣2️⃣ CHRONOLOGICAL EVENTS - Golden Age (1500-1700)');
  const goldenAgeEvents = await fetchAPI('/api/history/events/chronology?start=1500&end=1700');
  
  // 13. General statistics
  console.log('\n1️⃣3️⃣ GENERAL STATISTICS');
  const statistics = await fetchAPI('/api/history/statistics/general');
  
  if (statistics) {
    const stats = statistics.data;
    console.log(`📊 Total municipalities with history: ${stats.total_municipalities}`);
    console.log(`📊 Total registered monuments: ${stats.total_monuments}`);
    console.log(`📊 Total illustrious figures: ${stats.total_figures}`);
    console.log(`📊 Unique historical periods: ${stats.unique_periods?.length || 0}`);
    
    if (stats.municipalities_by_tags) {
      console.log(`🏷️ Most frequent tags:`);
      Object.entries(stats.municipalities_by_tags)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([tag, count]) => {
          console.log(`  - ${tag}: ${count} municipalities`);
        });
    }
  }
  
  // 14. Error tests - invalid INE code
  console.log('\n1️⃣4️⃣ ERROR TEST - Invalid INE code');
  await fetchAPI('/api/history/99999');
  
  // 15. Error tests - search too short
  console.log('\n1️⃣5️⃣ ERROR TEST - Search too short');
  await fetchAPI('/api/history/search/text?q=ab');
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ TESTS COMPLETED');
  console.log('\n📋 SUMMARY OF TESTED ENDPOINTS:');
  console.log('   ✅ GET /api/history/:codeINE');
  console.log('   ✅ GET /api/history/:codeINE?summary=true');
  console.log('   ✅ GET /api/history/search/text?q=term');
  console.log('   ✅ GET /api/history/period/:period');
  console.log('   ✅ GET /api/history/tags/:tags');
  console.log('   ✅ GET /api/history/events/chronology?start=X&end=Y');
  console.log('   ✅ GET /api/history/statistics/general');
  console.log('\n🔗 For more manual testing:');
  console.log(`   curl "${BASE_URL}/api/history/37274"`);
  console.log(`   curl "${BASE_URL}/api/history/search/text?q=university"`);
  console.log(`   curl "${BASE_URL}/api/history/statistics/general"`);
}

// Check that fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ This script requires Node.js 18+ or install node-fetch');
  console.log('💡 Install node-fetch: npm install node-fetch');
  console.log('💡 Or use Node.js 18+');
  process.exit(1);
}

// Run tests
testEndpoints().catch(console.error);
