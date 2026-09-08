const express = require('express');
const { protect } = require('../middleware/auth');
const { calculateTrips } = require('../utils/tripEngine');
const { getDigitalTwinSimulation } = require('../utils/mlService');
const { carbonRepository, simulationRepository, tenancyContext } = require('../repositories');
const { toApiEntry } = require('../repositories/carbonSerializer');
const { toApiSimulation } = require('../repositories/simulationSerializer');

const router = express.Router();

/**
 * Tenant context for the authenticated request. Built exclusively from the
 * verified Supabase profile (req.auth.profile) — never from request JSON/query,
 * so user_id cannot be client-controlled.
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

    const tenant = authTenant(req);

    // Latest entry now comes from Supabase PostgreSQL (Phase 3B). Order by date
    // descending (newest first), exactly matching the previous Mongo query.
    const latestRows = await carbonRepository.listByUser(tenant, { limit: 1 });
    const latestEntry = latestRows.length ? toApiEntry(latestRows[0]) : null;

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

      const simulation = await simulationRepository.create(tenant, {
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
        simulationId: simulation.id,
      });
    }

    // No trips to simulate against. The API is transportation-only: it never
    // fabricates a lifestyle baseline, so it cannot run without a logged trip.
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
    const tenant = authTenant(req);
    const simulations = await simulationRepository.listByOwner(tenant, { limit: 20 });
    res.json(simulations.map(toApiSimulation));
  } catch (error) {
    console.error('Simulation history error:', error);
    res.status(500).json({ message: 'Failed to load simulation history' });
  }
});

module.exports = router;
