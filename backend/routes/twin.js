const express = require('express');
const MobilityTwin = require('../models/MobilityTwin');
const { protect } = require('../middleware/auth');
const { deriveTwin, getOrCreateTwin, buildReplacementOptions } = require('../utils/twinEngine');
const { getDigitalTwinSimulation } = require('../utils/mlService');

const router = express.Router();

/**
 * @route  GET /api/twin
 * @desc   Get the user's mobility twin (derived on first access)
 */
router.get('/', protect, async (req, res) => {
  try {
    const twin = await getOrCreateTwin(req.user._id);
    res.json({ twin, replacements: await buildReplacementOptions(twin) });
  } catch (err) {
    console.error('Twin fetch error:', err.message);
    res.status(500).json({ message: 'Failed to derive mobility twin' });
  }
});

/**
 * @route  POST /api/twin/refresh
 * @desc   Force re-derivation of the twin from recent entries
 */
router.post('/refresh', protect, async (req, res) => {
  try {
    const twin = await deriveTwin(req.user._id);
    res.json({ twin, replacements: await buildReplacementOptions(twin) });
  } catch (err) {
    console.error('Twin refresh error:', err.message);
    res.status(500).json({ message: 'Failed to refresh mobility twin' });
  }
});

/**
 * @route  GET /api/twin/replacements
 * @desc   Personalised vehicle/mode replacement options based on the twin
 */
router.get('/replacements', protect, async (req, res) => {
  try {
    const twin = await getOrCreateTwin(req.user._id);
    res.json({ replacements: await buildReplacementOptions(twin) });
  } catch (err) {
    console.error('Replacements error:', err.message);
    res.status(500).json({ message: 'Failed to build replacement options' });
  }
});

/**
 * @route  POST /api/twin/scenarios
 * @desc   Evaluate a what-if scenario against the twin's baseline and save it.
 *         Body: { name, changes } — changes follow the ML /simulate contract,
 *         e.g. { replaceMode: "car", newMode: "metro" } or { mode: "car", occupants: 4 }
 */
router.post('/scenarios', protect, async (req, res) => {
  try {
    const { name, changes } = req.body;
    if (!name || !changes || typeof changes !== 'object') {
      return res.status(400).json({ message: 'name and changes are required' });
    }

    const twin = await getOrCreateTwin(req.user._id);

    // Baseline in the shape the ML service understands.
    const latestEntries = await require('../models/CarbonEntry')
      .find({ user: req.user._id }).sort({ date: -1 }).limit(7).lean();

    const baseline = latestEntries.length && (latestEntries[0].trips?.length || latestEntries[0].transport)
      ? { ...latestEntries[0] }
      : { transport: {}, ...(twin.vehicleProfile.mode ? {} : {}) };

    const sim = await getDigitalTwinSimulation(baseline, changes);
    if (!sim) {
      return res.status(503).json({ message: 'ML service unavailable — scenario not saved' });
    }

    const bTotal = sim.baseline?.transportPersonal ?? sim.baseline?.total ?? 0;
    const sTotal = sim.scenario?.transportPersonal ?? sim.scenario?.total ?? 0;

    const result = {
      reductionKg: Math.round((bTotal - sTotal) * 100) / 100,
      reductionPercent: bTotal > 0 ? Math.round(((bTotal - sTotal) / bTotal) * 1000) / 10 : 0,
      yearlySavingsKg: Math.round((bTotal - sTotal) * 365 * 10) / 10,
      scenarioDailyKg: Math.round(sTotal * 100) / 100,
    };

    twin.scenarios.push({ name: String(name).slice(0, 80), changes, result });
    await twin.save();

    res.status(201).json({ scenario: twin.scenarios[twin.scenarios.length - 1], simulation: sim });
  } catch (err) {
    console.error('Scenario save error:', err.message);
    res.status(500).json({ message: 'Failed to save scenario' });
  }
});

/**
 * @route  DELETE /api/twin/scenarios/:scenarioId
 * @desc   Remove a saved scenario
 */
router.delete('/scenarios/:scenarioId', protect, async (req, res) => {
  try {
    const twin = await MobilityTwin.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { scenarios: { _id: req.params.scenarioId } } },
      { new: true }
    );
    if (!twin) return res.status(404).json({ message: 'Twin not found' });
    res.json({ scenarios: twin.scenarios });
  } catch (err) {
    console.error('Scenario delete error:', err.message);
    res.status(500).json({ message: 'Failed to delete scenario' });
  }
});

module.exports = router;
