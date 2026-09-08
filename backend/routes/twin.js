const express = require('express');
const { protect } = require('../middleware/auth');
const { deriveTwin, getOrCreateTwin, buildReplacementOptions } = require('../utils/twinEngine');
const { getDigitalTwinSimulation } = require('../utils/mlService');
const { carbonRepository, mobilityTwinRepository, tenancyContext } = require('../repositories');
const { toApiEntry } = require('../repositories/carbonSerializer');
const { withScenarioId } = require('../repositories/twinSerializer');

const router = express.Router();

/**
 * Tenant context for the authenticated request. Built exclusively from the
 * verified Supabase profile (req.auth.profile) — never from request JSON/query,
 * so user_id / organization_id / department_id cannot be client-controlled.
 */
function authTenant(req) {
  const profile = req.auth?.profile;
  if (!profile) {
    const e = new Error('Authenticated profile not available');
    e.status = 401;
    throw e;
  }
  return tenancyContext.fromProfile(profile);
}

/**
 * @route  GET /api/twin
 * @desc   Get the user's mobility twin (derived on first access)
 */
router.get('/', protect, async (req, res) => {
  try {
    const tenant = authTenant(req);
    const twin = await getOrCreateTwin(tenant, req.user._id);
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
    const tenant = authTenant(req);
    const twin = await deriveTwin(tenant, req.user._id);
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
    const tenant = authTenant(req);
    const twin = await getOrCreateTwin(tenant, req.user._id);
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

    const tenant = authTenant(req);
    const twin = await getOrCreateTwin(tenant, req.user._id);

    // Latest entries now come from Supabase PostgreSQL (Phase 3B), mapped to the
    // camelCase shape the ML /simulate baseline expects.
    const latestRows = await carbonRepository.listByUser(tenant, { limit: 7 });
    const latestEntries = latestRows.map(toApiEntry);

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

    // Save the scenario into the jsonb array. Each scenario keeps a unique `_id`
    // so the frontend (keyed by s._id) and DELETE-by-scenarioId keep working.
    const scenario = withScenarioId({ name: String(name).slice(0, 80), changes, result });
    const scenarios = [...(twin.scenarios || []), scenario];
    const saved = await mobilityTwinRepository.upsert(tenant, { scenarios });

    res.status(201).json({ scenario, simulation: sim });
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
    const tenant = authTenant(req);
    const twin = await getOrCreateTwin(tenant, req.user._id);
    if (!twin) return res.status(404).json({ message: 'Twin not found' });

    const scenarios = (twin.scenarios || []).filter((s) => String(s._id) !== String(req.params.scenarioId));
    await mobilityTwinRepository.upsert(tenant, { scenarios });

    res.json({ scenarios });
  } catch (err) {
    console.error('Scenario delete error:', err.message);
    res.status(500).json({ message: 'Failed to delete scenario' });
  }
});

module.exports = router;
