/**
 * Service for managing municipal administrative and cultural information
 */

const MunicipalInfo = require('../models/municipalInfo');

class MunicipalInfoService {
  /**
   * Get municipal info by INE code
   */
  async getMunicipalInfo(codIne) {
    try {
      const info = await MunicipalInfo.findOne({ cod_ine: codIne, public: true });
      return info;
    } catch (error) {
      console.error(`Error getting municipal info for ${codIne}:`, error);
      throw error;
    }
  }

  /**
   * Get all municipal info
   */
  async getAllMunicipalInfo(filters = {}) {
    try {
      const query = { public: true, ...filters };
      const municipalInfos = await MunicipalInfo.find(query).sort({ municipality_name: 1 });
      return municipalInfos;
    } catch (error) {
      console.error('Error getting all municipal info:', error);
      throw error;
    }
  }

  /**
   * Create or update municipal info
   */
  async upsertMunicipalInfo(codIne, data) {
    try {
      const info = await MunicipalInfo.findOneAndUpdate(
        { cod_ine: codIne },
        { 
          ...data,
          cod_ine: codIne,
          'metadata.last_editor': data.editor || 'system',
          updatedAt: new Date()
        },
        { 
          new: true, 
          upsert: true,
          runValidators: true
        }
      );
      return info;
    } catch (error) {
      console.error(`Error upserting municipal info for ${codIne}:`, error);
      throw error;
    }
  }

  /**
   * Add festival poster
   */
  async addFestivalPoster(codIne, festivalName, posterData) {
    try {
      const info = await MunicipalInfo.findOne({ cod_ine: codIne });
      
      if (!info) {
        throw new Error(`Municipal info not found for ${codIne}`);
      }

      const festival = info.patron_festivals?.find(f => f.name === festivalName);
      
      if (!festival) {
        throw new Error(`Festival ${festivalName} not found for municipality ${codIne}`);
      }

      // Check if poster for this year already exists
      const existingPosterIndex = festival.posters?.findIndex(p => p.year === posterData.year);
      
      if (existingPosterIndex !== -1) {
        // Update existing poster
        festival.posters[existingPosterIndex] = {
          ...festival.posters[existingPosterIndex].toObject(),
          ...posterData,
          uploaded_date: new Date()
        };
      } else {
        // Add new poster
        if (!festival.posters) festival.posters = [];
        festival.posters.push({
          ...posterData,
          uploaded_date: new Date()
        });
      }

      await info.save();
      return info;
    } catch (error) {
      console.error(`Error adding festival poster:`, error);
      throw error;
    }
  }

  /**
   * Get festival posters for a municipality
   */
  async getFestivalPosters(codIne, festivalName = null, year = null) {
    try {
      const info = await MunicipalInfo.findOne({ cod_ine: codIne, public: true });
      
      if (!info) {
        return [];
      }

      let allPosters = [];

      info.patron_festivals?.forEach(festival => {
        if (festivalName && festival.name !== festivalName) return;

        festival.posters?.forEach(poster => {
          if (year && poster.year !== year) return;

          allPosters.push({
            festival_name: festival.name,
            patron_saint: festival.patron_saint,
            ...poster.toObject()
          });
        });
      });

      // Sort by year descending
      allPosters.sort((a, b) => b.year - a.year);

      return allPosters;
    } catch (error) {
      console.error(`Error getting festival posters:`, error);
      throw error;
    }
  }

  /**
   * Get upcoming festivals across all municipalities
   */
  async getUpcomingFestivals(limit = 10) {
    try {
      const municipalities = await MunicipalInfo.find({ 
        public: true,
        'patron_festivals.0': { $exists: true }
      });

      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentDay = now.getDate();

      const upcomingFestivals = [];

      municipalities.forEach(muni => {
        const upcoming = muni.getUpcomingFestivals();
        upcoming.forEach(festival => {
          upcomingFestivals.push({
            municipality_name: muni.municipality_name,
            cod_ine: muni.cod_ine,
            ...festival.toObject()
          });
        });
      });

      // Sort by date
      upcomingFestivals.sort((a, b) => {
        const [aMonth, aDay] = a.celebration_dates.start_date.split('-').map(Number);
        const [bMonth, bDay] = b.celebration_dates.start_date.split('-').map(Number);
        
        if (aMonth !== bMonth) return aMonth - bMonth;
        return aDay - bDay;
      });

      return upcomingFestivals.slice(0, limit);
    } catch (error) {
      console.error('Error getting upcoming festivals:', error);
      throw error;
    }
  }

  /**
   * Search municipal info by text
   */
  async searchMunicipalInfo(searchText) {
    try {
      const results = await MunicipalInfo.find(
        { 
          $text: { $search: searchText },
          public: true
        },
        { score: { $meta: 'textScore' } }
      ).sort({ score: { $meta: 'textScore' } });

      return results;
    } catch (error) {
      console.error('Error searching municipal info:', error);
      throw error;
    }
  }

  /**
   * Update contact information
   */
  async updateContactInfo(codIne, contactInfo) {
    try {
      const info = await MunicipalInfo.findOneAndUpdate(
        { cod_ine: codIne },
        { 
          $set: { 
            contact_info: contactInfo,
            updatedAt: new Date()
          }
        },
        { new: true, runValidators: true }
      );

      if (!info) {
        throw new Error(`Municipal info not found for ${codIne}`);
      }

      return info;
    } catch (error) {
      console.error(`Error updating contact info for ${codIne}:`, error);
      throw error;
    }
  }

  /**
   * Delete festival poster
   */
  async deleteFestivalPoster(codIne, festivalName, year) {
    try {
      const info = await MunicipalInfo.findOne({ cod_ine: codIne });
      
      if (!info) {
        throw new Error(`Municipal info not found for ${codIne}`);
      }

      const festival = info.patron_festivals?.find(f => f.name === festivalName);
      
      if (!festival) {
        throw new Error(`Festival ${festivalName} not found`);
      }

      festival.posters = festival.posters?.filter(p => p.year !== year) || [];

      await info.save();
      return info;
    } catch (error) {
      console.error(`Error deleting festival poster:`, error);
      throw error;
    }
  }

  /**
   * Get all patron festivals with days until next occurrence
   */
  async getAllFestivalsWithDaysUntil() {
    try {
      const municipalities = await MunicipalInfo.find({
        public: true,
        'patron_festivals.0': { $exists: true }
      }).select('municipality_name cod_ine patron_festivals');

      const allFestivals = [];
      const today = new Date();
      const currentYear = today.getFullYear();

      for (const municipality of municipalities) {
        for (const festival of municipality.patron_festivals) {
          if (!festival.celebration_dates?.start_date) continue;

          // start_date y end_date son dos días sueltos de fiesta ("20 de enero y 5 de mayo"),
          // no un intervalo: cuenta el más cercano. Fechas a medianoche para que hoy sea 0.
          const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          let daysUntil = null;
          for (const mmdd of [festival.celebration_dates.start_date, festival.celebration_dates.end_date]) {
            const [month, day] = String(mmdd || '').split('-').map(Number);
            if (!month || !day) continue;
            let festivalDate = new Date(currentYear, month - 1, day);
            if (festivalDate < midnight) festivalDate = new Date(currentYear + 1, month - 1, day);
            const days = Math.round((festivalDate - midnight) / 86400000);
            if (daysUntil === null || days < daysUntil) daysUntil = days;
          }

          allFestivals.push({
            municipality_name: municipality.municipality_name,
            cod_ine: municipality.cod_ine,
            festival_name: festival.name,
            celebration_dates: festival.celebration_dates,
            daysUntil
          });
        }
      }

      return allFestivals;
    } catch (error) {
      console.error('Error getting all festivals with days until:', error);
      throw error;
    }
  }
}

module.exports = new MunicipalInfoService();
