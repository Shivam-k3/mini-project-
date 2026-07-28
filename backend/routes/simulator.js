const express = require('express');
const CarbonEntry = require('../models/CarbonEntry');
const Simulation = require('../models/Simulation');
const { protect } = require('../middleware/auth');
const { simulateScenario } = require('../utils/emissionFactors');
const { getDigitalTwinSimulation } = require('../utils/mlService');

const router = express.Router();

const PRESET_SCENARIOS = [
  {
    id: 'car-to-metro',
    name: 'Switch Car to Metro',
    description: 'Replace 10km daily car commute with metro',
    changes: { transportMode: 'metro', transportKm: 10, replaceMode: 'car' },
  },
  {
    id: 'reduce-electricity',
    name: 'Reduce Electricity by 20%',
    description: 'Cut electricity consumption by 20%',
    changes: { electricityReduction: 20 },
  },
  {
    id: 'go-vegetarian',
    name: 'Become Vegetarian',
    description: 'Switch from non-vegetarian to vegetarian diet',
    changes: { foodHabit: 'vegetarian' },
  },
  {
    id: 'install-solar',
    name: 'Install Solar Panels',
    description: 'Install solar panels for 85% electricity reduction',
    changes: { solarPanels: true },
  },
  {
    id: 'ev-instead-car',
    name: 'Switch to Electric Vehicle',
    description: 'Replace car with EV for daily commute',
    changes: { transportMode: 'ev', transportKm: 20, replaceMode: 'car' },
  },
  {
    id: 'public-transit',
    name: 'Use Public Transit',
    description: 'Replace car commute with bus',
    changes: { transportMode: 'bus', transportKm: 15, replaceMode: 'car' },
  },
];

router.get('/scenarios', protect, (req, res) => {
  res.json(PRESET_SCENARIOS);
});

router.post('/simulate', protect, async (req, res) => {
  const { changes, name } = req.body;

  const latestEntry = await CarbonEntry.findOne({ user: req.user._id }).sort({ date: -1 });
  const baseline = latestEntry ? latestEntry.toObject() : {
    transport: { bike: 0, bus: 0, metro: 0, car: 10, ev: 0, flight: 0 },
    electricity: 15,
    water: 150,
    foodHabit: 'nonVegetarian',
    shoppingFrequency: 'medium',
    wasteGeneration: 'medium',
    fuel: { petrol: 0, diesel: 0, lpg: 0 },
    solarPanels: false,
  };

  const result = simulateScenario(baseline, changes);

  // Optionally enhance with ML service (yearly projections, confidence)
  const mlResult = await getDigitalTwinSimulation(baseline, changes);
  if (mlResult) {
    result.mlPrediction = mlResult;
    // Override local fields with ML's more detailed values
    result.yearlySavings = mlResult.yearlySavings;
    result.treesEquivalent = mlResult.treesEquivalent;
    result.impactScore = mlResult.impactScore;
  }

  const simulation = await Simulation.create({
    user: req.user._id,
    name: name || 'Custom Simulation',
    baseline,
    changes,
    results: {
      baselineTotal: result.baseline.total,
      scenarioTotal: result.scenario.total,
      reduction: result.reduction,
      reductionPercent: result.reductionPercent,
    },
  });

  res.json({
    ...result,
    simulationId: simulation._id,
    comparison: {
      labels: ['Baseline', 'Scenario'],
      baseline: Object.values(result.baseline.breakdown),
      scenario: Object.values(result.scenario.breakdown),
      categories: Object.keys(result.baseline.breakdown),
    },
  });
});

router.get('/history', protect, async (req, res) => {
  const simulations = await Simulation.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20);
  res.json(simulations);
});

module.exports = router;
