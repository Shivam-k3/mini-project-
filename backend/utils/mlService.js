const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

async function getPredictions(userId, historyData) {
  try {
    const { data } = await axios.post(`${ML_SERVICE_URL}/predict`, {
      user_id: userId,
      history: historyData,
    }, { timeout: 10000 });
    return data;
  } catch (error) {
    console.error('ML prediction error:', error.message);
    return fallbackPrediction(historyData);
  }
}

async function getShapExplanation(breakdown, total) {
  try {
    const { data } = await axios.post(`${ML_SERVICE_URL}/explain`, {
      breakdown,
      total,
    }, { timeout: 10000 });
    return data;
  } catch (error) {
    console.error('SHAP explanation error:', error.message);
    return fallbackExplanation(breakdown, total);
  }
}

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

module.exports = { getPredictions, getShapExplanation, getDigitalTwinSimulation };
