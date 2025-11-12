/**
 * Service class for managing municipal historical data operations
 * Handles all business logic for historical information
 */

const { MongoClient } = require('mongodb');

class MunicipalHistoryService {
  constructor(mongoClient) {
    this.client = mongoClient;
    this.db = mongoClient.db();
    this.collection = this.db.collection('municipalHistory');
  }

  /**
   * Get complete historical information for a municipality by INE code
   * @param {string} codeINE - 5-digit INE code
   * @returns {Object|null} Complete historical data
   */
  async getHistoryByCodeINE(codeINE) {
    try {
      console.log(`📚 Searching history for municipality: ${codeINE}`);
      
      const history = await this.collection.findOne({
        cod_ine: codeINE,
        public: true
      });
      
      if (history) {
        console.log(`✅ History found: ${history.municipality_name}`);
      }
      
      return history;
    } catch (error) {
      console.error('Error getting history by INE code:', error);
      throw error;
    }
  }

  /**
   * Get historical summary for a municipality
   * @param {string} codeINE - 5-digit INE code
   * @returns {Object|null} Summary data only
   */
  async getHistorySummary(codeINE) {
    try {
      const summary = await this.collection.findOne(
        { cod_ine: codeINE, public: true },
        {
          projection: {
            cod_ine: 1,
            municipality_name: 1,
            historical_summary: 1,
            historical_tags: 1,
            last_update_date: 1,
            'metadata.data_completeness': 1
          }
        }
      );
      
      return summary;
    } catch (error) {
      console.error('Error getting history summary:', error);
      throw error;
    }
  }

  /**
   * Full-text search across all historical information
   * @param {string} searchTerm - Search term
   * @returns {Array} Array of matching municipalities with scores
   */
  async searchInHistory(searchTerm) {
    try {
      console.log(`🔍 Full-text search for: "${searchTerm}"`);
      
      const results = await this.collection.find(
        {
          $text: { $search: searchTerm },
          public: true
        },
        {
          score: { $meta: 'textScore' }
        }
      )
      .sort({ score: { $meta: 'textScore' } })
      .limit(20)
      .toArray();
      
      // Add search score to results
      const resultsWithScore = results.map(result => ({
        cod_ine: result.cod_ine,
        municipality_name: result.municipality_name,
        historical_summary: result.historical_summary,
        historical_tags: result.historical_tags,
        score: result.score || 1
      }));
      
      console.log(`📊 Found ${resultsWithScore.length} results`);
      return resultsWithScore;
      
    } catch (error) {
      console.error('Error in full-text search:', error);
      throw error;
    }
  }

  /**
   * Get municipalities by historical period
   * @param {string} periodName - Name of historical period
   * @returns {Array} Municipalities with that period
   */
  async getMunicipalitiesByPeriod(periodName) {
    try {
      console.log(`🏛️ Searching municipalities from period: ${periodName}`);
      
      const municipalities = await this.collection.find(
        {
          'historical_periods.name': new RegExp(periodName, 'i'),
          public: true
        },
        {
          projection: {
            cod_ine: 1,
            municipality_name: 1,
            historical_summary: 1,
            historical_periods: {
              $elemMatch: { name: new RegExp(periodName, 'i') }
            }
          }
        }
      ).toArray();
      
      console.log(`📊 Found ${municipalities.length} municipalities from period "${periodName}"`);
      return municipalities;
      
    } catch (error) {
      console.error(`Error searching by period ${periodName}:`, error);
      throw error;
    }
  }

  /**
   * Get municipalities by historical tags
   * @param {Array} tags - Array of historical tags
   * @returns {Array} Municipalities matching any of the tags
   */
  async getMunicipalitiesByTags(tags) {
    try {
      console.log(`🏷️ Searching municipalities with tags:`, tags);
      
      // Convert tags to lowercase for case-insensitive search
      const lowerTags = tags.map(tag => tag.toLowerCase());
      
      const municipalities = await this.collection.find(
        {
          historical_tags: { $in: lowerTags },
          public: true
        },
        {
          projection: {
            cod_ine: 1,
            municipality_name: 1,
            historical_summary: 1,
            historical_tags: 1
          }
        }
      ).toArray();
      
      console.log(`📊 Found ${municipalities.length} municipalities with specified tags`);
      return municipalities;
      
    } catch (error) {
      console.error('Error searching by tags:', error);
      throw error;
    }
  }

  /**
   * Get historical events within a date range
   * @param {string} startYear - Start year
   * @param {string} endYear - End year
   * @returns {Array} Historical events in chronological order
   */
  async getHistoricalEventsByDate(startYear, endYear) {
    try {
      console.log(`📅 Searching events between ${startYear} and ${endYear}`);
      
      const municipalities = await this.collection.find(
        { public: true },
        {
          projection: {
            cod_ine: 1,
            municipality_name: 1,
            historical_periods: 1
          }
        }
      ).toArray();
      
      const events = [];
      
      municipalities.forEach(municipality => {
        municipality.historical_periods?.forEach(period => {
          period.important_events?.forEach(event => {
            // Parse event date (can be negative for BC dates)
            const eventYear = parseInt(event.date);
            const startYearInt = parseInt(startYear);
            const endYearInt = parseInt(endYear);
            
            if (eventYear >= startYearInt && eventYear <= endYearInt) {
              events.push({
                municipality: municipality.municipality_name,
                cod_ine: municipality.cod_ine,
                event: {
                  date: event.date,
                  description: event.description,
                  type: event.type
                },
                period: period.name
              });
            }
          });
        });
      });
      
      // Sort events chronologically
      events.sort((a, b) => parseInt(a.event.date) - parseInt(b.event.date));
      
      console.log(`📊 Found ${events.length} events between ${startYear}-${endYear}`);
      return events;
      
    } catch (error) {
      console.error('Error getting historical events by date:', error);
      throw error;
    }
  }

  /**
   * Get general statistics about historical data
   * @returns {Object} Statistics object
   */
  async getStatistics() {
    try {
      console.log('📊 Calculating historical data statistics...');
      
      // Basic counts
      const totalMunicipalities = await this.collection.countDocuments({ public: true });
      const validatedMunicipalities = await this.collection.countDocuments({ 
        public: true, 
        validated: true 
      });
      
      // Aggregation for detailed statistics
      const stats = await this.collection.aggregate([
        { $match: { public: true } },
        {
          $group: {
            _id: null,
            total_municipalities: { $sum: 1 },
            total_monuments: { $sum: { $size: { $ifNull: ['$historical_monuments', []] } } },
            total_figures: { $sum: { $size: { $ifNull: ['$illustrious_figures', []] } } },
            total_traditions: { $sum: { $size: { $ifNull: ['$legends_traditions', []] } } },
            avg_completeness: { $avg: '$metadata.data_completeness' }
          }
        }
      ]).toArray();
      
      // Get unique periods and tags
      const uniquePeriods = await this.collection.distinct('historical_periods.name', { public: true });
      const allTags = await this.collection.distinct('historical_tags', { public: true });
      
      // Tag frequency
      const tagStats = await this.collection.aggregate([
        { $match: { public: true } },
        { $unwind: '$historical_tags' },
        { $group: { _id: '$historical_tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray();
      
      const municipalitiesByTags = {};
      tagStats.forEach(tag => {
        municipalitiesByTags[tag._id] = tag.count;
      });
      
      const result = {
        total_municipalities: totalMunicipalities,
        validated_municipalities: validatedMunicipalities,
        public_municipalities: totalMunicipalities,
        total_monuments: stats[0]?.total_monuments || 0,
        total_figures: stats[0]?.total_figures || 0,
        total_traditions: stats[0]?.total_traditions || 0,
        average_completeness: Math.round(stats[0]?.avg_completeness || 0),
        unique_periods: uniquePeriods,
        total_tags: allTags.length,
        most_frequent_tags: municipalitiesByTags,
        municipalities_by_tags: municipalitiesByTags
      };
      
      console.log('✅ Statistics calculated successfully');
      return result;
      
    } catch (error) {
      console.error('Error calculating statistics:', error);
      throw error;
    }
  }

  /**
   * Create or update historical information for a municipality
   * @param {Object} historyData - Complete historical data
   * @returns {Object} Operation result
   */
  async upsertHistory(historyData) {
    try {
      console.log(`💾 Saving/updating history for: ${historyData.cod_ine}`);
      
      // Set update timestamp
      historyData.last_update_date = new Date();
      
      const result = await this.collection.replaceOne(
        { cod_ine: historyData.cod_ine },
        historyData,
        { upsert: true }
      );
      
      console.log(`✅ History saved: ${result.upsertedCount > 0 ? 'created' : 'updated'}`);
      return result;
      
    } catch (error) {
      console.error('Error saving history:', error);
      throw error;
    }
  }

  /**
   * Delete historical information for a municipality
   * @param {string} codeINE - 5-digit INE code
   * @returns {Object} Deletion result
   */
  async deleteHistory(codeINE) {
    try {
      console.log(`🗑️ Deleting history for municipality: ${codeINE}`);
      
      const result = await this.collection.deleteOne({
        cod_ine: codeINE
      });
      
      if (result.deletedCount > 0) {
        console.log(`✅ History deleted successfully`);
      } else {
        console.log(`⚠️ No history found to delete`);
      }
      
      return result;
      
    } catch (error) {
      console.error('Error deleting history:', error);
      throw error;
    }
  }

  /**
   * Create recommended indexes for better performance
   * Should be called during application initialization
   */
  async createIndexes() {
    try {
      console.log('🔍 Creating database indexes...');
      
      const indexes = [
        { cod_ine: 1 },
        { municipality_name: 1 },
        { historical_tags: 1 },
        { 'historical_periods.name': 1 },
        { 'illustrious_figures.name': 1 },
        { 'historical_monuments.name': 1 },
        { public: 1 },
        { validated: 1 },
        { public: 1, validated: 1 },
        { last_update_date: -1 }
      ];
      
      for (const index of indexes) {
        await this.collection.createIndex(index);
      }
      
      // Full-text search index
      await this.collection.createIndex(
        {
          municipality_name: 'text',
          historical_summary: 'text',
          'historical_periods.description': 'text',
          'historical_monuments.description': 'text',
          'legends_traditions.description': 'text',
          'illustrious_figures.name': 'text',
          historical_tags: 'text'
        },
        {
          name: 'full_text_search',
          default_language: 'spanish'
        }
      );
      
      console.log('✅ Database indexes created successfully');
      
    } catch (error) {
      console.error('Error creating indexes:', error);
      throw error;
    }
  }
}

module.exports = MunicipalHistoryService;
