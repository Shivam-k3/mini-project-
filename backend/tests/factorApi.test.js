/**
 * Factor API tests — exercises the request adapter behind GET /api/factors/*
 *
 * resolveFactorRequest() is the pure, DB-independent function that the
 * /api/factors/resolve route calls. These tests assert the shape and values it
 * returns for the range of client-supplied inputs, plus the /api/factors/modes
 * contract (KNOWN_MODES, occupancy split flags, dataset version).
 *
 * No database required: catalog lookups short-circuit to the static dataset
 * when mongoose is not connected, so all expected values are deterministic.
 *
 * Run: npm test  (from backend/)
 */
const test = require('node:test');
const assert = require('node:assert');

const {
  resolveFactorRequest,
  FactorRequestError,
  KNOWN_MODES,
  isOccupancySplitMode,
  describeLevel,
  GRID_KG_PER_KWH,
  FUEL_KG_PER_LITER,
  FACTOR_DATASET,
} = require('../utils/factorResolver');

// ---------------------------------------------------------------------------
// /api/factors/resolve — happy paths
// ---------------------------------------------------------------------------
test('resolve returns a fully-typed envelope for a generic car', async () => {
  const r = await resolveFactorRequest({ mode: 'car' });
  assert.strictEqual(r.mode, 'car');
  assert.ok(Number.isFinite(r.factorKgPerKm));
  assert.strictEqual(r.factorLevel, 'generic-mode');
  assert.strictEqual(r.factorLevelLabel, 'Generic mode');
  assert.ok(typeof r.factorSource === 'string' && r.factorSource.length > 0);
  assert.ok(typeof r.sourceUrl === 'string');
  assert.strictEqual(r.methodology.length > 0, true);
  assert.strictEqual(r.occupancySplit, true);
  assert.strictEqual(r.perPassenger, false);
  assert.strictEqual(r.datasetVersion, FACTOR_DATASET.version);
  assert.strictEqual(r.confidence, FACTOR_DATASET.modes.car.confidence_level || 'low');
});

test('resolve carries source provenance (name + url + year) through', async () => {
  const r = await resolveFactorRequest({ mode: 'metro' });
  assert.strictEqual(r.factorLevel, 'generic-mode');
  assert.strictEqual(r.factorSource, FACTOR_DATASET.modes.metro.source);
  assert.strictEqual(r.sourceUrl, FACTOR_DATASET.modes.metro.source_url || '');
  assert.strictEqual(r.sourceYear, FACTOR_DATASET.modes.metro.source_year ?? null);
  assert.strictEqual(r.methodology.length > 0, true);
});

test('category-level resolution is reported as category', async () => {
  const r = await resolveFactorRequest({
    mode: 'car',
    vehicleCategory: 'hatchback',
    fuelType: 'petrol',
  });
  assert.strictEqual(r.factorLevel, 'category');
  assert.strictEqual(r.factorLevelLabel, 'Category-level');
  assert.strictEqual(r.factorKgPerKm, FACTOR_DATASET.vehicle_categories
    .find((c) => c.mode === 'car' && c.vehicle_category === 'hatchback' && c.fuel_type === 'petrol')
    .co2_kg_per_km);
});

test('declared CO2 g/km is the highest-priority and marked vehicle-specific', async () => {
  const r = await resolveFactorRequest({
    mode: 'car',
    vehicleCategory: 'suv',
    fuelType: 'petrol',
    declaredCo2GPerKm: 128,
  });
  assert.strictEqual(r.factorLevel, 'vehicle-specific');
  assert.strictEqual(r.factorLevelLabel, 'Vehicle-specific');
  assert.strictEqual(r.factorKgPerKm, 0.128);
  assert.strictEqual(r.confidence, 'high');
});

test('fuel-efficiency derivation (kg/L ÷ km/L) resolves to 0.154 for 15 km/L petrol', async () => {
  const r = await resolveFactorRequest({
    mode: 'car',
    fuelType: 'petrol',
    fuelEfficiencyKmPerL: 15,
  });
  assert.strictEqual(r.factorLevel, 'efficiency-derived');
  assert.strictEqual(r.factorLevelLabel, 'Fuel-efficiency derived');
  assert.ok(Math.abs(r.factorKgPerKm - (FUEL_KG_PER_LITER.petrol / 15)) < 1e-9);
});

test('EV resolves via grid intensity x consumption', async () => {
  const r = await resolveFactorRequest({
    mode: 'ev',
    energyConsumptionKwhPerKm: 0.15,
  });
  assert.ok(Math.abs(r.factorKgPerKm - (0.15 * GRID_KG_PER_KWH)) < 1e-9);
  assert.strictEqual(
    r.methodology.includes('grid'),
    true,
    'EV methodology should cite the grid intensity'
  );
});

test('zero-emission modes resolve to 0', async () => {
  const walk = await resolveFactorRequest({ mode: 'walk' });
  const bicycle = await resolveFactorRequest({ mode: 'bicycle' });
  assert.strictEqual(walk.factorKgPerKm, 0);
  assert.strictEqual(bicycle.factorKgPerKm, 0);
});

// ---------------------------------------------------------------------------
// /api/factors/resolve — validation/error handling
// ---------------------------------------------------------------------------
test('missing mode throws a 400 FactorRequestError', async () => {
  await assert.rejects(
    resolveFactorRequest({}),
    (err) => err instanceof FactorRequestError && err.status === 400
  );
});

test('unknown mode throws a 400 FactorRequestError listing supported modes', async () => {
  await assert.rejects(
    resolveFactorRequest({ mode: 'spaceship' }),
    (err) => err instanceof FactorRequestError
      && err.status === 400
      && err.message.includes(KNOWN_MODES.join(', '))
  );
});

test('non-positive numeric inputs are rejected as 400', async () => {
  await assert.rejects(
    resolveFactorRequest({ mode: 'car', declaredCo2GPerKm: -5 }),
    (err) => err instanceof FactorRequestError && err.status === 400
  );
  await assert.rejects(
    resolveFactorRequest({ mode: 'car', fuelEfficiencyKmPerL: 0 }),
    (err) => err instanceof FactorRequestError && err.status === 400
  );
});

// ---------------------------------------------------------------------------
// /api/factors/modes — supported modes + their split flags
// ---------------------------------------------------------------------------
test('KNOWN_MODES match the canonical dataset and include every trip mode', () => {
  assert.deepStrictEqual(
    [...KNOWN_MODES].sort(),
    Object.keys(FACTOR_DATASET.modes).sort()
  );
  for (const mode of ['car', 'motorcycle', 'auto_rickshaw', 'bus', 'metro', 'flight', 'ev', 'walk', 'bicycle']) {
    assert.ok(KNOWN_MODES.includes(mode), `expected known mode: ${mode}`);
  }
});

test('occupancy-split set is exactly the vehicle modes', () => {
  for (const m of ['car', 'motorcycle', 'auto_rickshaw', 'ev']) {
    assert.strictEqual(isOccupancySplitMode(m), true, `${m} should split`);
  }
  for (const m of ['bus', 'metro', 'flight', 'walk', 'bicycle']) {
    assert.strictEqual(isOccupancySplitMode(m), false, `${m} should NOT split`);
  }
});

test('per-passenger flag is true for bus/metro/flight', async () => {
  for (const m of ['bus', 'metro', 'flight']) {
    const r = await resolveFactorRequest({ mode: m });
    assert.strictEqual(r.perPassenger, true, `${m} is per-passenger`);
  }
});

test('describeLevel maps known levels and defaults unknown ones to generic', () => {
  assert.strictEqual(describeLevel('vehicle-specific'), 'Vehicle-specific');
  assert.strictEqual(describeLevel('category'), 'Category-level');
  assert.strictEqual(describeLevel('efficiency-derived'), 'Fuel-efficiency derived');
  assert.strictEqual(describeLevel('generic-mode'), 'Generic mode');
  assert.strictEqual(describeLevel('nonsense'), 'Generic mode');
});

test('dataset version and grid factor constant are coherent', () => {
  assert.strictEqual(FACTOR_DATASET.version, '3.0.0');
  assert.strictEqual(GRID_KG_PER_KWH, FACTOR_DATASET.grid_electricity.factor_kg_per_kwh);
});
