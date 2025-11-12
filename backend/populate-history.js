/**
 * Script to populate database with example historical data
 * Usage: node populate-history.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');
const historyExamples = require('./src/data/historyExamples');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/infoSalamanca';

async function populateHistory() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔗 Connecting to MongoDB...');
    await client.connect();
    
    const db = client.db();
    const collection = db.collection('municipalHistory');
    
    console.log('📚 Inserting example historical data...');
    
    // Insert or update example data
    for (const history of historyExamples) {
      const result = await collection.replaceOne(
        { cod_ine: history.cod_ine },
        history,
        { upsert: true }
      );
      
      console.log(`  ✅ ${history.municipality_name} (${history.cod_ine}): ${result.upsertedCount > 0 ? 'inserted' : 'updated'}`);
    }
    
    // Create recommended indexes
    console.log('🔍 Creating indexes...');
    
    const indexes = [
      { cod_ine: 1 },
      { municipality_name: 1 },
      { "historical_tags": 1 },
      { "historical_periods.name": 1 },
      { "illustrious_figures.name": 1 },
      { "historical_monuments.name": 1 },
      { public: 1 },
      { validated: 1 }
    ];
    
    for (const index of indexes) {
      await collection.createIndex(index);
      console.log(`  📇 Index created:`, Object.keys(index).join(', '));
    }
    
    // Create full-text search index
    await collection.createIndex({
      municipality_name: "text",
      historical_summary: "text",
      "historical_periods.description": "text",
      "historical_monuments.description": "text",
      "legends_traditions.description": "text",
      "illustrious_figures.name": "text",
      "historical_tags": "text"
    }, {
      name: "full_text_search",
      default_language: "spanish"
    });
    
    console.log('  📇 Full-text search index created');
    
    // Show statistics
    const totalDocs = await collection.countDocuments();
    const municipalitiesWithHistory = await collection.distinct('municipality_name');
    
    console.log('\n📊 STATISTICS:');
    console.log(`  📚 Total historical documents: ${totalDocs}`);
    console.log(`  🏘️ Municipalities with history: ${municipalitiesWithHistory.length}`);
    console.log(`  🏘️ Municipalities: ${municipalitiesWithHistory.join(', ')}`);
    
    console.log('\n✅ Database populated successfully');
    console.log('\n🔗 Available endpoints:');
    console.log('  GET /api/history/:codeINE - Complete history of a municipality');
    console.log('  GET /api/history/:codeINE?summary=true - Historical summary');
    console.log('  GET /api/history/search/text?q=university - Text search');
    console.log('  GET /api/history/period/medieval - Municipalities by period');
    console.log('  GET /api/history/tags/university,medieval - Search by tags');
    console.log('  GET /api/history/events/chronology?start=1200&end=1500 - Events by dates');
    console.log('  GET /api/history/statistics/general - Statistics');
    
    console.log('\n🧪 Test examples:');
    console.log('  curl http://localhost:4000/api/history/37274');
    console.log('  curl http://localhost:4000/api/history/search/text?q=university');
    console.log('  curl http://localhost:4000/api/history/tags/medieval');
    
  } catch (error) {
    console.error('❌ Error populating database:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Connection closed');
  }
}

// Execute if called directly
if (require.main === module) {
  populateHistory();
}

module.exports = populateHistory;
