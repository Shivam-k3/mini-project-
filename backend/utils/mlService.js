/**
 * ML Service client — communicates with the Python ML service (Flask on port 8000).
 *
 * Supports multi-tenant scoping:
 *   - "user"       : per-user predictions (default)
 *   - "department" : department-level predictions (aggregated student data)
 *   - "college"    : college-level predictions (aggregated campus data)
 *
 * Each scope gets its own model file on the ML service side, so models
 * never collide.  Fallback logic runs client-side if the ML service is down.
 */

const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// ======================== Per-user predictions ============================

/**
 * Train on a user's history and get personalised forecasts.
 *
 * @param {string}  userId      MongoDB _id of the user
 * @param {Array}   historyData Array of carbon entry documents
 * @param {string}  [scope]     "user" | "department" | "college"
 * @param {string}  [scopeId]   MongoDB _id of the scope entity
 * @returns {Promise<Object>}   Prediction result with nextWeek, nextMonth, etc.
 */
async function getPredictions(userId, historyData, scope = 'user', scopeId = null) {
  try {
    const payload = {
      user_id: userId,
      history: historyData,
      scope,
      scope_id: scopeId || userId,
    };
    const { data } = await axios.post(`${ML_SERVICE_URL}/predict`, payload, { timeout: 10000 });
    return data;
  } catch (error) {
    console.error('ML prediction error:', error.message);
    return fallbackPrediction(historyData);
  }
}

// =================== Entity (dept/college) training ========================

/**
 * Batch-train a model for a department or college.
 * Call this when a faculty or admin wants to pre-train models.
 *
 * @param {string} scope    "department" | "college"
 * @param {string} scopeId  MongoDB _id of the department or college
 * @param {Array}  history  Aggregated carbon entries for that entity
 * @returns {Promise<Object>} Training result (metrics, feature importance)
 */
async function trainEntityModel(scope, scopeId, history) {
  try {
    const { data } = await axios.post(`${ML_SERVICE_URL}/train-entity`, {
      scope,
      scope_id: scopeId,
      history,
    }, { timeout: 30000 });
    return data;
  } catch (error) {
    console.error('Entity model training error:', error.message);
    return { trained: false, error: error.message };
  }
}

// ================= Entity (dept/college) prediction ========================

/**
 * Get forecasts from a pre-trained entity model (no retraining).
 *
 * @param {string} scope       "department" | "college" | "user"
 * @param {string} scopeId     MongoDB _id of the scope entity
 * @param {Object} [latestEntry] Optional latest entry for forecast baseline
 * @returns {Promise<Object>}  Prediction result
 */
async function predictEntityModel(scope, scopeId, latestEntry = null) {
  try {
    const payload = { scope, scope_id: scopeId };
    if (latestEntry) payload.latest_entry = latestEntry;
    const { data } = await axios.post(`${ML_SERVICE_URL}/predict-entity`, payload, { timeout: 10000 });
    return data;
  } catch (error) {
    console.error('Entity prediction error:', error.message);
    return {
      nextWeek: 0,
      nextMonth: 0,
      dailyForecast: [],
      confidence: 0,
      method: 'entity_fallback',
    };
  }
}

// =========================== SHAP explanation =============================

/**
 * Get a SHAP-style explanation of an emission breakdown.
 *
 * @param {Object} breakdown  Per-category values
 * @param {number} total      Total emissions
 * @param {string} [scope]    "user" | "department" | "college"
 * @param {string} [scopeId]  MongoDB _id of the scope entity
 * @returns {Promise<Object>} Explanation with contributions, top factors, etc.
 */
async function getShapExplanation(breakdown, total, scope = 'user', scopeId = 'anonymous') {
  try {
    const { data } = await axios.post(`${ML_SERVICE_URL}/explain`, {
      breakdown,
      total,
      scope,
      scope_id: scopeId,
    }, { timeout: 10000 });
    return data;
  } catch (error) {
    console.error('SHAP explanation error:', error.message);
    return fallbackExplanation(breakdown, total);
  }
}

// ========================== Digital twin ===================================

/**
 * Run a digital-twin scenario simulation.
 *
 * @param {Object} baseline  Current emission data
 * @param {Object} changes   Desired changes to simulate
 * @returns {Promise<Object|null>} Simulation result or null on failure
 */
async function getDigitalTwinSimulation(baseline, changes) {
  try {
    const { data } = await axios.post(`${ML_SERVICE_URL}/simulate`, {
      baseline,
      changes,
    }, { timeout: 10000 });
    return data;
  } catch (error) {
    console.error('Digital twin error:', error.message);
    return null;
  }
}

// ========================== Fallback logic ================================

function fallbackPrediction(history) {
  if (!history || history.length === 0) {
    return { nextWeek: 0, nextMonth: 0, confidence: 0 };
  }
  const avg = history.reduce((s, e) => s + e.totalEmissions, 0) / history.length;
  return {
    nextWeek: Math.round(avg * 7 * 100) / 100,
    nextMonth: Math.round(avg * 30 * 100) / 100,
    confidence: 0.6,
    method: 'fallback_average',
  };
}

function fallbackExplanation(breakdown, total) {
  const contributions = {};
  Object.entries(breakdown).forEach(([key, val]) => {
    contributions[key] = total > 0 ? Math.round((val / total) * 10000) / 100 : 0;
  });
  const sorted = Object.entries(contributions).sort((a, b) => b[1] - a[1]);
  return {
    contributions,
    topFactors: sorted.slice(0, 3).map(([name, pct]) => ({ name, percentage: pct })),
    explanation: sorted.map(([name, pct]) => `${name}: ${pct}%`).join(', '),
    method: 'fallback_percentage',
  };
}

module.exports = {
  getPredictions,
  getShapExplanation,
  getDigitalTwinSimulation,
  trainEntityModel,
  predictEntityModel,
};
