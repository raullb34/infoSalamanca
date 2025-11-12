/**
 * MongoDB Schema for municipal historical information
 * Collection: municipalHistory
 */

const mongoose = require('mongoose');

const municipalHistorySchema = new mongoose.Schema({
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
  
  // General historical summary
  historical_summary: {
    type: String,
    required: true,
    maxlength: 2000
  },
  
  // Historical periods array
  historical_periods: [{
    name: {
      type: String,
      required: true
    },
    start_date: {
      type: String, // Can be approximate dates like "1200", "-220", etc.
      required: true
    },
    end_date: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000
    },
    relevant_figures: [{
      name: String,
      description: String,
      activity_period: String
    }],
    important_events: [{
      date: String,
      description: String,
      type: {
        type: String,
        enum: ['military', 'political', 'religious', 'architectural', 'cultural', 'economic', 'educational', 'documentary', 'archaeological']
      }
    }]
  }],
  
  // Historical monuments and buildings
  historical_monuments: [{
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['religious', 'civil', 'military', 'educational', 'urban', 'infrastructure', 'archaeological'],
      required: true
    },
    construction_date: String,
    style: String,
    description: {
      type: String,
      maxlength: 500
    },
    importance: {
      type: String,
      enum: ['local', 'regional', 'national', 'international'],
      default: 'local'
    },
    current_state: {
      type: String,
      enum: ['excellent', 'good', 'regular', 'poor', 'ruins', 'disappeared'],
      default: 'good'
    }
  }],
  
  // Legends and traditions
  legends_traditions: [{
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['legend', 'tradition', 'festival', 'custom', 'oral_history', 'belief'],
      required: true
    },
    description: {
      type: String,
      required: true,
      maxlength: 800
    },
    approximate_origin: String,
    current_validity: {
      type: Boolean,
      default: false
    },
    celebration_date: String // For festivals and traditions
  }],
  
  // Illustrious personalities
  illustrious_figures: [{
    name: {
      type: String,
      required: true
    },
    profession: String,
    life_period: String, // "1864-1936", "s. XV", etc.
    salamanca_connection: {
      type: String,
      required: true
    },
    relevance: String,
    achievements: [String]
  }],
  
  // Urban evolution through time
  urban_evolution: [{
    period: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    characteristics: [String],
    population_estimate: String,
    main_buildings: [String]
  }],
  
  // Historical tags for searching and classification
  historical_tags: [{
    type: String,
    lowercase: true,
    trim: true,
    index: true
  }],
  
  // Bibliography and sources
  bibliography_sources: [{
    author: String,
    title: {
      type: String,
      required: true
    },
    year: Number,
    type: {
      type: String,
      enum: ['book', 'article', 'thesis', 'document', 'webpage', 'archive'],
      required: true
    },
    publisher: String,
    url: String,
    archive_location: String
  }],
  
  // Historical images
  historical_images: [{
    url: String,
    description: String,
    approximate_date: String,
    author: String,
    source: String,
    type: {
      type: String,
      enum: ['photography', 'engraving', 'drawing', 'map', 'plan', 'painting']
    }
  }],
  
  // Publication and validation status
  public: {
    type: Boolean,
    default: true,
    index: true
  },
  
  validated: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Timestamps
  last_update_date: {
    type: Date,
    default: Date.now
  },
  
  creation_date: {
    type: Date,
    default: Date.now
  },
  
  // Data source and metadata
  data_source: String,
  metadata: {
    data_completeness: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    needs_revision: {
      type: Boolean,
      default: false
    },
    collaborators: [String],
    quality_score: {
      type: Number,
      min: 0,
      max: 10,
      default: 5
    },
    last_validator: String,
    validation_notes: String
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  collection: 'municipalHistory'
});

// Compound indexes for better performance
municipalHistorySchema.index({ cod_ine: 1, municipality_name: 1 });
municipalHistorySchema.index({ historical_tags: 1, public: 1 });
municipalHistorySchema.index({ 'historical_periods.name': 1 });
municipalHistorySchema.index({ validated: 1, public: 1 });

// Text search index for full-text search
municipalHistorySchema.index({
  municipality_name: 'text',
  historical_summary: 'text',
  'historical_periods.description': 'text',
  'historical_monuments.description': 'text',
  'legends_traditions.description': 'text',
  'illustrious_figures.name': 'text',
  historical_tags: 'text'
}, {
  name: 'full_text_search',
  default_language: 'spanish'
});

// Virtual for URL-friendly municipality name
municipalHistorySchema.virtual('slug').get(function() {
  return this.municipality_name
    .toLowerCase()
    .replace(/[áéíóú]/g, match => ({á:'a',é:'e',í:'i',ó:'o',ú:'u'}[match]))
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
});

// Instance method to get summary statistics
municipalHistorySchema.methods.getStatistics = function() {
  return {
    total_periods: this.historical_periods?.length || 0,
    total_monuments: this.historical_monuments?.length || 0,
    total_figures: this.illustrious_figures?.length || 0,
    total_traditions: this.legends_traditions?.length || 0,
    data_completeness: this.metadata?.data_completeness || 0
  };
};

// Static method to find by historical tag
municipalHistorySchema.statics.findByHistoricalTag = function(tag) {
  return this.find({
    historical_tags: { $in: [tag.toLowerCase()] },
    public: true
  });
};

// Static method to find by period
municipalHistorySchema.statics.findByPeriod = function(periodName) {
  return this.find({
    'historical_periods.name': new RegExp(periodName, 'i'),
    public: true
  });
};

module.exports = mongoose.model('MunicipalHistory', municipalHistorySchema);
