const express = require('express');
const CarbonEntry = require('../models/CarbonEntry');
const Simulation = require('../models/Simulation');
const { protect } = require('../middleware/auth');
const { calculateTrips } = require('../utils/tripEngine');
const { getDigitalTwinSimulation } = require('../utils/mlService');

const router = express.Router();

// Mobility-only preset scenarios. `changes` follows the ML /simulate contract.
const PRESET_SCENARIOS = [
  {
    id: 'car-to-metro',
    name: 'Car → Metro',
    description: 'Shift your car km to the metro',
    changes: { replaceMode: 'car', newMode: 'metro' },
  },
  {
    id: 'car-to-bus',
    name: 'Car → Bus',
    description: 'Shift your car km to the bus',
    changes: { replaceMode: 'car', newMode: 'bus' },
  },
  {
    id: 'carpool-4',
    name: '4-Person Carpool',
    description: 'Split your car emissions among 4 occupants',
    changes: { mode: 'car', occupants: 4 },
  },
  {
    id: 'ev-swap',
    name: 'Switch to EV',
    description: 'Replace your petrol/diesel vehicle with an EV',
    changes: { vehicleSwap: { category: 'hatchback', fuelType: 'electric' } },
  },
  {
    id: 'moto-to-metro',
    name: 'Motorcycle → Metro',
    description: 'Shift your motorcycle km to the metro',
    changes: { replaceMode: 'motorcycle', newMode: 'metro' },
  },
  {
    id: 'auto-to-bus',
    name: 'Auto → Bus',
    description: 'Shift auto-rickshaw km to the bus',
    changes: { replaceMode: 'auto_rickshaw', newMode: 'bus' },
  },
];

router.get('/scenarios', protect, (req, res) => {
  res.json(PRESET_SCENARIOS);
});

router.post('/simulate', protect, async (req, res) => {
  try {
    const { changes, name } = req.body;
    if (!changes || typeof changes !== 'object') {
      return res.status(400).json({ message: 'changes object is required' });
    }

    const latestEntry = await CarbonEntry.findOne({ user: req.user._id }).sort({ date: -1 });

    // ---- Trips-aware simulation (v3) --------------------------------------
    if (latestEntry && Array.isArray(latestEntry.trips) && latestEntry.trips.length > 0) {
      const baselineTrips = latestEntry.trips.map((t) => t.toObject ? t.toObject() : { ...t });
      const baselineResult = await calculateTrips(baselineTrips);

      const mlResult = await getDigitalTwinSimulation(
        { trips: baselineTrips },
        changes
      );

      let scenarioTrips = baselineTrips;
      if (mlResult?.scenario?.tripDetails) {
        scenarioTrips = mlResult.scenario.tripDetails.map((t) => ({
          mode: t.mode,
          distanceKm: t.distanceKm,
          occupants: t.occupants,
          tripFrequency: t.tripFrequency || 1,
          purpose: t.purpose || 'commute',
          vehicle: t.vehicle || undefined,
        }));
      }
      const scenarioResult = await calculateTrips(scenarioTrips);

      const reduction = Math.round((baselineResult.transportPersonal - scenarioResult.transportPersonal) * 100) / 100;
      const reductionPercent = baselineResult.transportPersonal > 0
        ? Math.round((reduction / baselineResult.transportPersonal) * 1000) / 10
        : 0;

      const simulation = await Simulation.create({
        user: req.user._id,
        name: name || 'Mobility Scenario',
        baseline: { trips: baselineTrips },
        changes,
        results: {
          baselineTotal: baselineResult.transportPersonal,
          scenarioTotal: scenarioResult.transportPersonal,
          reduction,
          reductionPercent,
        },
      });

      return res.json({
        transportOnly: true,
        baseline: {
          transportPersonal: baselineResult.transportPersonal,
          breakdown: baselineResult.modeBreakdown,
          tripDetails: baselineResult.tripDetails,
        },
        scenario: {
          transportPersonal: scenarioResult.transportPersonal,
          breakdown: scenarioResult.modeBreakdown,
          tripDetails: scenarioResult.tripDetails,
        },
        reduction,
        reductionPercent,
        yearlySavings: mlResult?.yearlySavings ?? Math.round(reduction * 365 * 10) / 10,
        treesEquivalent: mlResult?.treesEquivalent ?? Math.round((reduction * 365) / 21),
        impactScore: mlResult?.impactScore ?? Math.min(100, Math.round(reductionPercent * 1.5)),
        simulationId: simulation._id,
      });
    }

    // No trips to simulate against. Previously this fell back to a fabricated
    // lifestyle baseline (electricity/water/food/shopping/waste), which
    // inflated the baseline denominator and diluted every reductionPercent.
    return res.status(400).json({
      message: 'Log at least one trip before running a simulation.',
    });
  } catch (error) {
    console.error('Simulation error:', error);
    res.status(500).json({ message: 'Simulation failed', error: error.message });
  }
});

router.get('/history', protect, async (req, res) => {
  try {
    const simulations = await Simulation.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(simulations);
  } catch (error) {
    console.error('Simulation history error:', error);
    res.status(500).json({ message: 'Failed to load simulation history' });
  }
});

module.exports = router;
