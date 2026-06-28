const db = require('../config/database');
const logger = require('../utils/logger');

// Simulated disease prediction model based on symptoms
const DISEASE_PATTERNS = {
  1: {
    name: 'White Spot Syndrome',
    keywords: ['white', 'spot', 'lesion', 'crust'],
    confidence_base: 0.85
  },
  2: {
    name: 'Black Spot Disease',
    keywords: ['black', 'spot', 'dark', 'discoloration'],
    confidence_base: 0.80
  },
  3: {
    name: 'Shell Disease',
    keywords: ['shell', 'soft', 'erosion', 'decay'],
    confidence_base: 0.75
  },
  4: {
    name: 'Gill Disease',
    keywords: ['gill', 'brown', 'discharge', 'debris'],
    confidence_base: 0.78
  },
  5: {
    name: 'Vibriosis',
    keywords: ['vibrio', 'hemorrhage', 'bleeding', 'tail'],
    confidence_base: 0.82
  },
};

const aiPredictionService = {
  // Predict disease from image description or metadata
  async predictDisease(imageData, symptoms) {
    try {
      // Combine image data and symptoms for analysis
      const analysisText = `${imageData || ''} ${symptoms || ''}`.toLowerCase();
      
      const predictions = [];

      // Analyze against each disease pattern
      for (const [diseaseId, pattern] of Object.entries(DISEASE_PATTERNS)) {
        let matchCount = 0;
        let baseConfidence = pattern.confidence_base;

        // Count keyword matches
        pattern.keywords.forEach(keyword => {
          if (analysisText.includes(keyword)) {
            matchCount++;
          }
        });

        // Calculate confidence based on matches
        const confidence = Math.min(
          baseConfidence + (matchCount * 0.05),
          0.99
        );

        if (matchCount > 0 || baseConfidence > 0.75) {
          predictions.push({
            disease_id: parseInt(diseaseId),
            confidence: parseFloat(confidence.toFixed(2)),
            matched_keywords: matchCount
          });
        }
      }

      // Sort by confidence descending
      predictions.sort((a, b) => b.confidence - a.confidence);

      // If no clear match, add top disease with base confidence
      if (predictions.length === 0) {
        predictions.push({
          disease_id: 1,
          confidence: 0.50,
          matched_keywords: 0
        });
      }

      return predictions.slice(0, 3); // Return top 3 predictions
    } catch (error) {
      logger.error('Error in predictDisease:', error);
      throw error;
    }
  },

  // Save prediction to database
  async savePrediction(imageId, predictions) {
    try {
      const savedPredictions = [];

      for (const pred of predictions) {
        const result = await db.query(
          `INSERT INTO disease_predictions (image_id, disease_id, confidence, predicted_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           RETURNING *`,
          [imageId, pred.disease_id, pred.confidence]
        );

        if (result.rows[0]) {
          savedPredictions.push(result.rows[0]);
        }
      }

      return savedPredictions;
    } catch (error) {
      logger.error('Error in savePrediction:', error);
      throw error;
    }
  },

  // Get prediction history for a pond
  async getPredictionHistory(pondId, limit = 50) {
    try {
      const result = await db.query(
        `SELECT dp.prediction_id, dp.image_id, dp.disease_id, d.disease_name, 
                dp.confidence, dp.predicted_at, dp.is_confirmed
         FROM disease_predictions dp
         JOIN shrimp_diseases d ON dp.disease_id = d.disease_id
         JOIN disease_images di ON dp.image_id = di.image_id
         JOIN seasons s ON di.season_id = s.season_id
         WHERE s.pond_id = $1
         ORDER BY dp.predicted_at DESC
         LIMIT $2`,
        [pondId, limit]
      );

      return result.rows || [];
    } catch (error) {
      logger.error('Error in getPredictionHistory:', error);
      return [];
    }
  },

  // Get prediction statistics
  async getPredictionStats(pondId) {
    try {
      const result = await db.query(
        `SELECT 
           COUNT(*) as total_predictions,
           COUNT(CASE WHEN is_confirmed = true THEN 1 END) as confirmed_predictions,
           COUNT(DISTINCT disease_id) as unique_diseases,
           AVG(confidence) as avg_confidence
         FROM disease_predictions dp
         JOIN disease_images di ON dp.image_id = di.image_id
         JOIN seasons s ON di.season_id = s.season_id
         WHERE s.pond_id = $1`,
        [pondId]
      );

      return result.rows[0] || {
        total_predictions: 0,
        confirmed_predictions: 0,
        unique_diseases: 0,
        avg_confidence: 0
      };
    } catch (error) {
      logger.error('Error in getPredictionStats:', error);
      return {
        total_predictions: 0,
        confirmed_predictions: 0,
        unique_diseases: 0,
        avg_confidence: 0
      };
    }
  },

  // Confirm AI prediction as accurate
  async confirmPrediction(predictionId, confirmed = true) {
    try {
      const result = await db.query(
        `UPDATE disease_predictions
         SET is_confirmed = $1, confirmed_at = CURRENT_TIMESTAMP
         WHERE prediction_id = $2
         RETURNING *`,
        [confirmed, predictionId]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error in confirmPrediction:', error);
      throw error;
    }
  },

  // Train model with confirmed predictions
  async trainModel(diseaseId, imageCount = 10) {
    try {
      // Get confirmed predictions for this disease
      const result = await db.query(
        `SELECT COUNT(*) as count
         FROM disease_predictions
         WHERE disease_id = $1 AND is_confirmed = true
         LIMIT $2`,
        [diseaseId, imageCount]
      );

      // In real scenario, this would trigger model retraining
      // For now, just log the training event
      logger.info(`Model training initiated for disease ${diseaseId}`, result.rows[0]);

      return {
        success: true,
        message: `Model trained with ${result.rows[0]?.count || 0} samples for disease ${diseaseId}`,
        trained_at: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error in trainModel:', error);
      throw error;
    }
  },
};

module.exports = aiPredictionService;
