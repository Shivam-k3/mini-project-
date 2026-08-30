/**
 * Emission-factor resolution API (spec §7-§10).
 *
 * The backend resolver is the single source of truth for scientific constants.
 * Clients (Calculator live preview, Simulator) ask this endpoint *which* factor
 * applies to a mode/vehicle combination instead of shipping their own copy of
 * the dataset.
 *
 * Read-only by design: there is no write verb here, so a client can REQUEST a
 * resolution but can never DEFINE a factor. Curating the dataset stays with the
 * seeder (config/emission-factors.json -> EmissionFactor collection) and the
 * super-admin surface.
 */
const express = require('express');
const { protect } = require('../middleware/auth');
const { resolveFactorRequest, isOccupancySplitMode, KNOWN_MODES, FACTOR_DATASET } = require('../utils/factorResolver');

const router = express.Router();

/**
 * @route  GET /api/factors/resolve
 * @desc   Resolve the authoritative emission factor for one mode/vehicle.
 * @query  mode (required), manufacturer, model, variant, vehicleCategory,
 *         fuelType, fuelEfficiencyKmPerL, energyConsumptionKwhPerKm,
 *         declaredCo2GPerKm
 * @access Private
 */
router.get('/resolve', protect, async (req, res) => {
  try {
    res.json(await resolveFactorRequest(req.query));
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ message: err.message });
    console.error('Factor resolve error:', err.message);
    res.status(500).json({ message: 'Failed to resolve emission factor' });
  }
});

/**
 * @route  GET /api/factors/modes
 * @desc   Supported travel modes and which of them split emissions among
 *         occupants — lets the UI build its selectors from the dataset rather
 *         than a hardcoded list.
 * @access Private
 */
router.get('/modes', protect, (req, res) => {
  res.json({
    datasetVersion: FACTOR_DATASET.version,
    modes: KNOWN_MODES.map((mode) => ({
      mode,
      occupancySplit: isOccupancySplitMode(mode),
      perPassenger: Boolean(FACTOR_DATASET.modes[mode]?.per_passenger),
    })),
  });
});

module.exports = router;
