const express = require('express');
const router = express.Router();
const MunicipalHistoryService = require('../services/municipalHistoryService');

// Service instance (will be initialized when MongoDB connection is configured)
let municipalHistoryService;

/**
 * Middleware to initialize service if it doesn't exist
 */
const ensureService = (req, res, next) => {
  if (!municipalHistoryService && req.app.locals.mongoClient) {
    municipalHistoryService = new MunicipalHistoryService(req.app.locals.mongoClient);
  }
  
  if (!municipalHistoryService) {
    return res.status(500).json({ 
      error: 'History service unavailable',
      message: 'Could not connect to database'
    });
  }
  
  next();
};

/**
 * GET /api/history/:codeINE
 * Get complete history of a municipality by INE code
 */
router.get('/:codeINE', ensureService, async (req, res) => {
  try {
    const { codeINE } = req.params;
    const { summary } = req.query; // ?summary=true to get only summary

    console.log(`📚 Requesting history for municipality: ${codeINE}`);

    if (!codeINE || codeINE.length !== 5) {
      return res.status(400).json({
        error: 'Invalid INE code',
        message: 'INE code must have exactly 5 digits'
      });
    }

    let history;
    
    if (summary === 'true') {
      history = await municipalHistoryService.getHistorySummary(codeINE);
    } else {
      history = await municipalHistoryService.getHistoryByCodeINE(codeINE);
    }

    if (!history) {
      return res.status(404).json({
        error: 'History not found',
        message: `No historical information found for municipality with INE code: ${codeINE}`,
        code_ine: codeINE
      });
    }

    console.log(`✅ History found for ${history.municipality_name}`);
    
    res.json({
      success: true,
      data: history,
      metadata: {
        response_type: summary === 'true' ? 'summary' : 'complete',
        query_date: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in GET /history/:codeINE:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Could not retrieve municipality history',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/history/search/text
 * Full-text search in municipal history
 */
router.get('/search/text', ensureService, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 3) {
      return res.status(400).json({
        error: 'Invalid query',
        message: 'Search must have at least 3 characters'
      });
    }

    console.log(`🔍 Text search in history: "${q}"`);

    const results = await municipalHistoryService.searchInHistory(q.trim());

    res.json({
      success: true,
      data: results,
      metadata: {
        query: q,
        total_results: results.length,
        query_date: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in text search:', error);
    res.status(500).json({
      error: 'Search error',
      message: 'Could not perform history search'
    });
  }
});

/**
 * GET /api/history/period/:period
 * Get municipalities by historical period
 */
router.get('/period/:period', ensureService, async (req, res) => {
  try {
    const { period } = req.params;

    console.log(`🏛️ Searching municipalities from period: ${period}`);

    const municipalities = await municipalHistoryService.getMunicipalitiesByPeriod(period);

    res.json({
      success: true,
      data: municipalities,
      metadata: {
        queried_period: period,
        total_municipalities: municipalities.length,
        query_date: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(`Error searching period ${period}:`, error);
    res.status(500).json({
      error: 'Period search error',
      message: 'Could not get municipalities from requested period'
    });
  }
});

/**
 * GET /api/history/tags/:tags
 * Search municipalities by historical tags
 */
router.get('/tags/:tags', ensureService, async (req, res) => {
  try {
    const { tags } = req.params;
    const tagsArray = tags.split(',').map(tag => tag.trim());

    console.log(`🏷️ Searching municipalities with tags:`, tagsArray);

    const municipalities = await municipalHistoryService.getMunicipalitiesByTags(tagsArray);

    res.json({
      success: true,
      data: municipalities,
      metadata: {
        queried_tags: tagsArray,
        total_municipalities: municipalities.length,
        query_date: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error searching by tags:', error);
    res.status(500).json({
      error: 'Tag search error',
      message: 'Could not get municipalities with requested tags'
    });
  }
});

/**
 * GET /api/history/events/chronology
 * Get historical events within a date range
 */
router.get('/events/chronology', ensureService, async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'Both "start" and "end" parameters are required (years)'
      });
    }

    console.log(`📅 Searching events between ${start} and ${end}`);

    const events = await municipalHistoryService.getHistoricalEventsByDate(start, end);

    res.json({
      success: true,
      data: events,
      metadata: {
        period: { start, end },
        total_events: events.length,
        query_date: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error getting chronology:', error);
    res.status(500).json({
      error: 'Chronology query error',
      message: 'Could not get events from requested period'
    });
  }
});

/**
 * GET /api/history/statistics
 * Get general statistics of historical information
 */
router.get('/statistics/general', ensureService, async (req, res) => {
  try {
    console.log('📊 Getting history statistics');

    const statistics = await municipalHistoryService.getStatistics();

    res.json({
      success: true,
      data: statistics,
      metadata: {
        query_date: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error getting statistics:', error);
    res.status(500).json({
      error: 'Statistics error',
      message: 'Could not get history statistics'
    });
  }
});

/**
 * POST /api/history/:codeINE
 * Create or update history of a municipality
 * (Administrative endpoint - would require authentication in production)
 */
router.post('/:codeINE', ensureService, async (req, res) => {
  try {
    const { codeINE } = req.params;
    const historyData = req.body;

    // Basic validations
    if (!codeINE || codeINE.length !== 5) {
      return res.status(400).json({
        error: 'Invalid INE code'
      });
    }

    if (!historyData.municipality_name) {
      return res.status(400).json({
        error: 'Incomplete data',
        message: 'Municipality name is required at minimum'
      });
    }

    // Ensure INE code matches
    historyData.cod_ine = codeINE;

    // Default values
    if (historyData.public === undefined) {
      historyData.public = true;
    }
    if (historyData.validated === undefined) {
      historyData.validated = false;
    }

    console.log(`💾 Saving history for municipality: ${codeINE}`);

    const result = await municipalHistoryService.upsertHistory(historyData);

    res.json({
      success: true,
      data: {
        code_ine: codeINE,
        operation: result.upsertedCount > 0 ? 'created' : 'updated',
        modified: result.modifiedCount > 0,
        id: result.upsertedId || 'existing'
      },
      metadata: {
        operation_date: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error saving history:', error);
    res.status(500).json({
      error: 'Save error',
      message: 'Could not save historical information'
    });
  }
});

/**
 * DELETE /api/history/:codeINE
 * Delete history of a municipality
 * (Administrative endpoint - would require authentication in production)
 */
router.delete('/:codeINE', ensureService, async (req, res) => {
  try {
    const { codeINE } = req.params;

    console.log(`🗑️ Deleting history for municipality: ${codeINE}`);

    const result = await municipalHistoryService.deleteHistory(codeINE);

    if (result.deletedCount === 0) {
      return res.status(404).json({
        error: 'History not found',
        message: `No history exists for municipality with INE code: ${codeINE}`
      });
    }

    res.json({
      success: true,
      data: {
        code_ine: codeINE,
        deleted: true
      },
      metadata: {
        operation_date: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error deleting history:', error);
    res.status(500).json({
      error: 'Delete error',
      message: 'Could not delete historical information'
    });
  }
});

module.exports = router;
