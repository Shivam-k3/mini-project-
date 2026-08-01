// Standard CO2 emission factors (kg CO2 per unit)
const EMISSION_FACTORS = {
  transport: {
    bike: 0,
    bus: 0.089,        // kg CO2 per km
    metro: 0.041,
    car: 0.21,
    ev: 0.05,
    flight: 0.255,     // kg CO2 per km
  },
  electricity: 0.475,  // kg CO2 per kWh (grid average)
  water: 0.0003,       // kg CO2 per liter
  food: {
    vegetarian: 2.5,   // kg CO2 per day
    nonVegetarian: 7.2,
    vegan: 1.5,
  },
  shopping: {
    low: 0.5,          // kg CO2 per day
    medium: 2.0,
    high: 5.0,
  },
  waste: {
    low: 0.3,
    medium: 1.0,
    high: 2.5,
  },
  fuel: {
    petrol: 2.31,      // kg CO2 per liter
    diesel: 2.68,
    lpg: 1.51,
  },
  solar: {
    reductionFactor: 0.85, // 85% reduction when solar installed
  },
};

function getVehicleOccupants(transport) {
  const raw = Number(transport?.carOccupants);
  return Math.max(1, Math.min(8, Number.isFinite(raw) && raw >= 1 ? Math.round(raw) : 1));
}

function calculateEmissions(data) {
  const breakdown = {
    transport: 0,
    electricity: 0,
    water: 0,
    food: 0,
    shopping: 0,
    waste: 0,
    fuel: 0,
  };
  const householdBreakdown = { ...breakdown };

  // Transport — occupancy-aware allocation:
  // car/EV emissions are split equally among occupants (personal share),
  // while the raw trip total is preserved for household accounting.
  // Bus/metro/flight factors are already per-passenger (DEFRA).
  if (data.transport) {
    const occupants = getVehicleOccupants(data.transport);
    Object.entries(data.transport).forEach(([mode, km]) => {
      const factor = EMISSION_FACTORS.transport[mode];
      if (factor === undefined) return; // skips carOccupants metadata key
      const tripTotal = km * factor;
      householdBreakdown.transport += tripTotal;
      breakdown.transport += (mode === 'car' || mode === 'ev')
        ? tripTotal / occupants
        : tripTotal;
    });
  }

  // Electricity
  if (data.electricity) {
    breakdown.electricity = data.electricity * EMISSION_FACTORS.electricity;
    householdBreakdown.electricity = breakdown.electricity;
    if (data.solarPanels) {
      breakdown.electricity *= (1 - EMISSION_FACTORS.solar.reductionFactor);
      householdBreakdown.electricity = breakdown.electricity;
    }
  }

  // Water
  if (data.water) {
    breakdown.water = data.water * EMISSION_FACTORS.water;
    householdBreakdown.water = breakdown.water;
  }

  // Food
  if (data.foodHabit && EMISSION_FACTORS.food[data.foodHabit]) {
    breakdown.food = EMISSION_FACTORS.food[data.foodHabit];
    householdBreakdown.food = breakdown.food;
  }

  // Shopping
  if (data.shoppingFrequency && EMISSION_FACTORS.shopping[data.shoppingFrequency]) {
    breakdown.shopping = EMISSION_FACTORS.shopping[data.shoppingFrequency];
    householdBreakdown.shopping = breakdown.shopping;
  }

  // Waste
  if (data.wasteGeneration && EMISSION_FACTORS.waste[data.wasteGeneration]) {
    breakdown.waste = EMISSION_FACTORS.waste[data.wasteGeneration];
    householdBreakdown.waste = breakdown.waste;
  }

  // Fuel
  if (data.fuel) {
    Object.entries(data.fuel).forEach(([type, liters]) => {
      if (EMISSION_FACTORS.fuel[type] !== undefined) {
        breakdown.fuel += liters * EMISSION_FACTORS.fuel[type];
        householdBreakdown.fuel = breakdown.fuel;
      }
    });
  }

  const round2 = (v) => Math.round(v * 100) / 100;
  const total = round2(Object.values(breakdown).reduce((sum, val) => sum + val, 0));
  const householdTotal = round2(Object.values(householdBreakdown).reduce((sum, val) => sum + val, 0));

  return {
    total,
    breakdown: Object.fromEntries(
      Object.entries(breakdown).map(([k, v]) => [k, round2(v)])
    ),
    householdTotal,
    householdBreakdown: Object.fromEntries(
      Object.entries(householdBreakdown).map(([k, v]) => [k, round2(v)])
    ),
  };
}

function simulateScenario(baseline, changes) {
  const modified = { ...baseline, ...changes };

  if (changes.transportMode && changes.transportKm) {
    modified.transport = { ...baseline.transport };
    modified.transport[changes.transportMode] = changes.transportKm;
    if (changes.replaceMode) {
      modified.transport[changes.replaceMode] = 0;
    }
  }

  // Carpool / occupancy change: adjust occupants on the vehicle trips
  if (changes.carOccupants) {
    modified.transport = { ...(baseline.transport || {}) };
    modified.transport.carOccupants = getVehicleOccupants({ carOccupants: changes.carOccupants });
  }

  if (changes.electricityReduction) {
    modified.electricity = baseline.electricity * (1 - changes.electricityReduction / 100);
  }

  if (changes.foodHabit) {
    modified.foodHabit = changes.foodHabit;
  }

  if (changes.solarPanels) {
    modified.solarPanels = true;
  }

  const baselineResult = calculateEmissions(baseline);
  const scenarioResult = calculateEmissions(modified);

  const reduction = Math.round((baselineResult.total - scenarioResult.total) * 100) / 100;
  const reductionPercent = baselineResult.total > 0
    ? Math.round(((baselineResult.total - scenarioResult.total) / baselineResult.total) * 10000) / 100
    : 0;

  return {
    baseline: baselineResult,
    scenario: scenarioResult,
    reduction,
    reductionPercent,
    yearlySavings: Math.round(reduction * 365 * 100) / 100,
    treesEquivalent: Math.round(reduction * 365 / 21),
    impactScore: Math.min(100, Math.round(reductionPercent * 1.5)),
  };
}

function calculateEcoScore(totalEmissions, streak = 0) {
  // Lower emissions = higher score (based on ~20kg/day average)
  const dailyAvg = 20;
  let score = Math.max(0, Math.min(100, Math.round((1 - totalEmissions / dailyAvg) * 100)));
  score = Math.min(100, score + Math.min(streak * 2, 20));
  return score;
}

module.exports = {
  EMISSION_FACTORS,
  calculateEmissions,
  simulateScenario,
  calculateEcoScore,
  getVehicleOccupants,
};
