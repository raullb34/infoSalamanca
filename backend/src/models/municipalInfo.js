/**
 * MongoDB Schema for municipal administrative and cultural information
 * Collection: municipalInfo
 */

const mongoose = require('mongoose');

const municipalInfoSchema = new mongoose.Schema({
  // Basic municipality identification
  cod_ine: {
    type: String,
    required: true,
    unique: true,
    length: 5,
    match: /^\d{5}$/,
    index: true
  },
  
  municipality_name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  // Contact information
  contact_info: {
    // Ayuntamiento (Town Hall)
    town_hall: {
      address: String,
      postal_code: String,
      phone: String,
      fax: String,
      email: {
        type: String,
        lowercase: true,
        trim: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      },
      website: String,
      social_media: {
        facebook: String,
        twitter: String,
        instagram: String,
        youtube: String
      }
    },
    
    // Other important contacts
    tourist_office: {
      phone: String,
      email: String,
      address: String,
      schedule: String
    },
    
    health_center: {
      phone: String,
      address: String,
      emergency_phone: String
    },
    
    police: {
      local_police: String,
      civil_guard: String
    }
  },
  
  // Patron saint festivals
  patron_festivals: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    
    patron_saint: String, // e.g., "San Juan", "Virgen de la Asunción"
    
    celebration_dates: {
      start_date: String, // Format: "MM-DD" or specific dates
      end_date: String,
      approximate: Boolean, // If dates vary each year
      date_description: String // e.g., "Primer fin de semana de agosto"
    },
    
    description: {
      type: String,
      maxlength: 1000
    },
    
    // Poster images for the festival
    posters: [{
      year: {
        type: Number,
        required: true,
        min: 1900,
        max: 2100
      },
      image_url: {
        type: String,
        required: true
      },
      thumbnail_url: String,
      title: String,
      designer: String, // Artist or designer of the poster
      description: String,
      file_size: Number,
      dimensions: {
        width: Number,
        height: Number
      },
      uploaded_date: {
        type: Date,
        default: Date.now
      }
    }],
    
    // Traditional events during the festival
    traditional_events: [{
      name: String,
      description: String,
      typical_date: String, // e.g., "Día del patrón", "Víspera"
      time: String
    }],
    
    // Historical information
    historical_origin: String,
    first_documented: String, // Year or period
    
    importance: {
      type: String,
      enum: ['local', 'regional', 'provincial', 'national'],
      default: 'local'
    },
    
    declared_of_interest: {
      is_declared: Boolean,
      category: String, // e.g., "Fiesta de Interés Turístico Regional"
      year_declared: Number
    }
  }],
  
  // Other festivities and events
  other_festivities: [{
    name: String,
    type: {
      type: String,
      enum: ['religious', 'cultural', 'gastronomic', 'sports', 'traditional', 'market', 'fair']
    },
    celebration_date: String,
    description: String,
    recurrence: {
      type: String,
      enum: ['annual', 'biennial', 'occasional']
    },
    posters: [{
      year: Number,
      image_url: String,
      thumbnail_url: String
    }]
  }],
  
  // Local gastronomy
  gastronomy: {
    typical_dishes: [{
      name: String,
      description: String,
      season: String, // When it's typically eaten
      ingredients: [String]
    }],
    
    typical_products: [{
      name: String,
      type: String, // e.g., "embutido", "queso", "dulce"
      description: String,
      denomination_origin: Boolean,
      tierra_sabor: Boolean
    }],
    
    restaurants: [{
      name: String,
      specialty: String,
      contact: String
    }]
  },
  
  // Tourism information
  tourism: {
    must_see: [{
      name: String,
      type: String,
      description: String,
      visit_schedule: String
    }],
    
    hiking_routes: [{
      name: String,
      difficulty: {
        type: String,
        enum: ['easy', 'moderate', 'difficult']
      },
      distance_km: Number,
      estimated_time: String,
      description: String,
      gpx_url: String
    }],
    
    accommodations: {
      hotels: Number,
      rural_houses: Number,
      hostels: Number
    },
    
    tourist_guide_url: String
  },
  
  // Services and facilities
  services: {
    has_pharmacy: Boolean,
    has_health_center: Boolean,
    has_schools: Boolean,
    has_library: Boolean,
    has_sports_facilities: Boolean,
    has_public_pool: Boolean,
    has_cultural_center: Boolean,
    
    public_transport: {
      has_bus: Boolean,
      bus_companies: [String],
      has_train: Boolean,
      train_station: String
    },
    
    markets_schedule: String,
    
    other_services: [String]
  },
  
  // Media gallery
  media_gallery: {
    featured_images: [{
      url: String,
      thumbnail_url: String,
      title: String,
      description: String,
      photographer: String,
      date_taken: Date,
      category: {
        type: String,
        enum: ['landscape', 'monument', 'festival', 'people', 'nature', 'aerial', 'historical']
      },
      is_cover: Boolean // Featured image for the municipality
    }],
    
    videos: [{
      url: String,
      title: String,
      description: String,
      platform: {
        type: String,
        enum: ['youtube', 'vimeo', 'other']
      },
      video_id: String,
      duration: String
    }]
  },
  
  // Historical population data
  population_data: [{
    year: Number,
    population: Number,
    source: String
  }],
  
  // Publication and validation status
  public: {
    type: Boolean,
    default: true,
    index: true
  },
  
  verified: {
    type: Boolean,
    default: false,
    index: true
  },
  
  last_verified_date: Date,
  
  // Data source and metadata
  metadata: {
    data_completeness: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    last_editor: String,
    editor_notes: String,
    needs_update: {
      type: Boolean,
      default: false
    },
    update_notes: String
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  collection: 'municipalInfo'
});

// Indexes for better performance
municipalInfoSchema.index({ cod_ine: 1, municipality_name: 1 });
municipalInfoSchema.index({ 'patron_festivals.name': 1 });
municipalInfoSchema.index({ 'patron_festivals.celebration_dates.start_date': 1 });
municipalInfoSchema.index({ public: 1, verified: 1 });

// Text search index
municipalInfoSchema.index({
  municipality_name: 'text',
  'patron_festivals.name': 'text',
  'patron_festivals.description': 'text',
  'gastronomy.typical_dishes.name': 'text',
  'tourism.must_see.name': 'text'
}, {
  name: 'municipal_info_text_search',
  default_language: 'spanish'
});

// Virtual for URL-friendly municipality name
municipalInfoSchema.virtual('slug').get(function() {
  return this.municipality_name
    .toLowerCase()
    .replace(/[áéíóú]/g, match => ({á:'a',é:'e',í:'i',ó:'o',ú:'u'}[match]))
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
});

// Instance method to get current year festival posters
municipalInfoSchema.methods.getCurrentFestivalPosters = function(year = new Date().getFullYear()) {
  const posters = [];
  
  this.patron_festivals?.forEach(festival => {
    const yearPoster = festival.posters?.find(p => p.year === year);
    if (yearPoster) {
      posters.push({
        festival_name: festival.name,
        ...yearPoster.toObject()
      });
    }
  });
  
  return posters;
};

// Instance method to get upcoming festivals
municipalInfoSchema.methods.getUpcomingFestivals = function() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  
  return this.patron_festivals?.filter(festival => {
    if (!festival.celebration_dates?.start_date) return false;
    
    const [month, day] = festival.celebration_dates.start_date.split('-').map(Number);
    
    if (month > currentMonth) return true;
    if (month === currentMonth && day >= currentDay) return true;
    
    return false;
  }).sort((a, b) => {
    const [aMonth, aDay] = a.celebration_dates.start_date.split('-').map(Number);
    const [bMonth, bDay] = b.celebration_dates.start_date.split('-').map(Number);
    
    if (aMonth !== bMonth) return aMonth - bMonth;
    return aDay - bDay;
  }) || [];
};

// Static method to find municipalities by festival
municipalInfoSchema.statics.findByFestival = function(festivalName) {
  return this.find({
    'patron_festivals.name': new RegExp(festivalName, 'i'),
    public: true
  });
};

// Static method to get all municipalities with festivals in a date range
municipalInfoSchema.statics.findFestivalsInRange = function(startMonth, endMonth) {
  return this.find({
    public: true,
    'patron_festivals.0': { $exists: true }
  }).then(municipalities => {
    return municipalities.filter(muni => {
      return muni.patron_festivals?.some(festival => {
        if (!festival.celebration_dates?.start_date) return false;
        const [month] = festival.celebration_dates.start_date.split('-').map(Number);
        return month >= startMonth && month <= endMonth;
      });
    });
  });
};

module.exports = mongoose.model('MunicipalInfo', municipalInfoSchema);
