/**
 * Script para poblar la base de datos con datos históricos de ejemplo
 * Uso: node poblar-historia.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');
const ejemplosHistoria = require('./data/ejemplosHistoria');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/infoSalamanca';

async function poblarHistoria() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔗 Conectando a MongoDB...');
    await client.connect();
    
    const db = client.db();
    const collection = db.collection('municipioHistoria');
    
    console.log('📚 Insertando datos históricos de ejemplo...');
    
    // Insertar o actualizar datos de ejemplo
    for (const historia of ejemplosHistoria) {
      const result = await collection.replaceOne(
        { cod_ine: historia.cod_ine },
        historia,
        { upsert: true }
      );
      
      console.log(`  ✅ ${historia.nombre_municipio} (${historia.cod_ine}): ${result.upsertedCount > 0 ? 'insertado' : 'actualizado'}`);
    }
    
    // Crear índices recomendados
    console.log('🔍 Creando índices...');
    
    const indices = [
      { cod_ine: 1 },
      { nombre_municipio: 1 },
      { "tags_historicos": 1 },
      { "periodos_historicos.nombre": 1 },
      { "personajes_ilustres.nombre": 1 },
      { "monumentos_historicos.nombre": 1 },
      { publico: 1 },
      { validado: 1 }
    ];
    
    for (const index of indices) {
      await collection.createIndex(index);
      console.log(`  📇 Índice creado:`, Object.keys(index).join(', '));
    }
    
    // Crear índice de texto completo
    await collection.createIndex({
      nombre_municipio: "text",
      resumen_historico: "text",
      "periodos_historicos.descripcion": "text",
      "monumentos_historicos.descripcion": "text",
      "leyendas_tradiciones.descripcion": "text",
      "personajes_ilustres.nombre": "text",
      "tags_historicos": "text"
    }, {
      name: "busqueda_texto_completo",
      default_language: "spanish"
    });
    
    console.log('  📇 Índice de texto completo creado');
    
    // Mostrar estadísticas
    const totalDocs = await collection.countDocuments();
    const municipiosConHistoria = await collection.distinct('nombre_municipio');
    
    console.log('\n📊 ESTADÍSTICAS:');
    console.log(`  📚 Total documentos históricos: ${totalDocs}`);
    console.log(`  🏘️ Municipios con historia: ${municipiosConHistoria.length}`);
    console.log(`  🏘️ Municipios: ${municipiosConHistoria.join(', ')}`);
    
    console.log('\n✅ Base de datos poblada correctamente');
    console.log('\n🔗 Endpoints disponibles:');
    console.log('  GET /api/historia/:codIne - Historia completa de un municipio');
    console.log('  GET /api/historia/:codIne?resumen=true - Resumen histórico');
    console.log('  GET /api/historia/buscar/texto?q=universidad - Búsqueda de texto');
    console.log('  GET /api/historia/periodo/medieval - Municipios por período');
    console.log('  GET /api/historia/tags/universidad,medieval - Búsqueda por tags');
    console.log('  GET /api/historia/eventos/cronologia?inicio=1200&fin=1500 - Eventos por fechas');
    console.log('  GET /api/historia/estadisticas/generales - Estadísticas');
    
    console.log('\n🧪 Ejemplos de prueba:');
    console.log('  curl http://localhost:4000/api/historia/37274');
    console.log('  curl http://localhost:4000/api/historia/buscar/texto?q=universidad');
    console.log('  curl http://localhost:4000/api/historia/tags/medieval');
    
  } catch (error) {
    console.error('❌ Error poblando la base de datos:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Conexión cerrada');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  poblarHistoria();
}

module.exports = poblarHistoria;
