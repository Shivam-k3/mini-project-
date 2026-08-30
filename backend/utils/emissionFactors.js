/**
 * Eco-score scoring for the gamification layer.
 *
 * The lifestyle emission calculator that used to live here (electricity, water,
 * food, shopping, waste, fuel litres) has been removed: EcoGuardian is a
 * transportation-only platform (spec §37). Trip emissions are computed by
 * utils/tripEngine.js, and per-trip factors are resolved by
 * utils/factorResolver.js — which is the single source of truth for kg CO2/km.
 */

function calculateEcoScore(totalEmissions, streak = 0) {
  // Lower emissions = higher score (based on ~20kg/day average)
  const dailyAvg = 20;
  let score = Math.max(0, Math.min(100, Math.round((1 - totalEmissions / dailyAvg) * 100)));
  score = Math.min(100, score + Math.min(streak * 2, 20));
  return score;
}

module.exports = { calculateEcoScore };
