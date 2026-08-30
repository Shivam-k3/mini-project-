/**
 * Backend unit tests — emission factor resolution + trip engine.
 * Pure-function tests; no database required.
 *
 * Run: npm test  (from backend/)
 */
const test = require('node:test');
const assert = require('node:assert');

const {
  resolveTripFactor,
  isOccupancySplitMode,
  describeLevel,
  GRID_KG_PER_KWH,
} = require('../utils/factorResolver');
const { calculateTrips, clampOccupants } = require('../utils/tripEngine');

// ---------------------------------------------------------------------------
// factorResolver
// ---------------------------------------------------------------------------
test('generic mode factors', async () => {
  const car = await resolveTripFactor({ mode: 'car' });
  assert.strictEqual(car.level, 'generic-mode');
  assert.strictEqual(car.factorKgPerKm, 0.21);

  const metro = await resolveTripFactor({ mode: 'metro' });
  assert.strictEqual(metro.factorKgPerKm, 0.041);

  const walk = await resolveTripFactor({ mode: 'walk' });
  assert.strictEqual(walk.factorKgPerKm, 0);
});

test('category-level factor for petrol hatchback', async () => {
  const r = await resolveTripFactor({ mode: 'car', vehicle: { category: 'hatchback', fuelType: 'petrol' } });
  assert.strictEqual(r.level, 'category');
  assert.strictEqual(r.factorKgPerKm, 0.145);
});

test('efficiency-derived beats category when mileage declared', async () => {
  // petrol 2.31 kg/L / 15 km/L = 0.154
  const r = await resolveTripFactor({
    mode: 'car',
    vehicle: { fuelType: 'petrol', fuelEfficiencyKmpl: 15 },
  });
  assert.strictEqual(r.level, 'efficiency-derived');
  assert.ok(Math.abs(r.factorKgPerKm - 0.154) < 1e-9);
});

test('EV uses declared consumption x grid', async () => {
  const r = await resolveTripFactor({
    mode: 'ev',
    vehicle: { electricityConsumptionKwhPerKm: 0.15 },
  });
  assert.ok(Math.abs(r.factorKgPerKm - 0.15 * GRID_KG_PER_KWH) < 1e-9);
});

test('declared CO2 wins over everything', async () => {
  const r = await resolveTripFactor({
    mode: 'car',
    vehicle: { declaredCo2GPerKm: 99, category: 'suv', fuelType: 'petrol' },
  });
  assert.strictEqual(r.level, 'vehicle-specific');
  assert.strictEqual(r.factorKgPerKm, 0.099);
});

test('describeLevel returns human strings', () => {
  assert.ok(describeLevel({ level: 'category' }).length > 3);
});

// ---------------------------------------------------------------------------
// tripEngine
// ---------------------------------------------------------------------------
test('clampOccupants bounds 1..8', () => {
  assert.strictEqual(clampOccupants(0), 1);
  assert.strictEqual(clampOccupants(100), 8);
  assert.strictEqual(clampOccupants(3), 3);
});

test('solo car trip: personal == household', async () => {
  const r = await calculateTrips([{ mode: 'car', distanceKm: 10, occupants: 1, tripFrequency: 1 }]);
  assert.strictEqual(r.transportPersonal, 2.1);
  assert.strictEqual(r.transportHousehold, 2.1);
});

test('carpool splits emissions among occupants', async () => {
  const r = await calculateTrips([{ mode: 'car', distanceKm: 10, occupants: 4, tripFrequency: 1 }]);
  assert.ok(Math.abs(r.transportPersonal - 0.53) < 0.01); // 2.1 / 4 = 0.525 → rounded
  assert.strictEqual(r.transportHousehold, 2.1);
});

test('bus is per-passenger already (no split)', async () => {
  const solo = await calculateTrips([{ mode: 'bus', distanceKm: 10, occupants: 1 }]);
  const shared = await calculateTrips([{ mode: 'bus', distanceKm: 10, occupants: 6 }]);
  assert.strictEqual(solo.transportPersonal, shared.transportPersonal);
});

test('mode breakdown aggregates per mode', async () => {
  const r = await calculateTrips([
    { mode: 'car', distanceKm: 10, occupants: 1 },
    { mode: 'metro', distanceKm: 20 },
    { mode: 'walk', distanceKm: 2 },
  ]);
  assert.strictEqual(r.modeBreakdown.car, 2.1);
  assert.strictEqual(r.modeBreakdown.metro, 0.82);
  assert.strictEqual(r.modeBreakdown.walk, 0);
});

test('tripFrequency multiplies distance', async () => {
  const r = await calculateTrips([{ mode: 'car', distanceKm: 5, occupants: 1, tripFrequency: 2 }]);
  assert.strictEqual(r.transportPersonal, 2.1);
});

test('zero/negative distances are ignored', async () => {
  const r = await calculateTrips([
    { mode: 'car', distanceKm: 0 },
    { mode: 'car', distanceKm: -5 },
    { mode: 'car', distanceKm: 10, occupants: 1 },
  ]);
  assert.strictEqual(r.transportPersonal, 2.1);
});

test('split modes are exactly car/motorcycle/auto_rickshaw/ev', () => {
  assert.ok(isOccupancySplitMode('car'));
  assert.ok(isOccupancySplitMode('motorcycle'));
  assert.ok(isOccupancySplitMode('auto_rickshaw'));
  assert.ok(isOccupancySplitMode('ev'));
  assert.ok(!isOccupancySplitMode('bus'));
  assert.ok(!isOccupancySplitMode('flight'));
});

test('tripDetails carries vehicle through for persistence', async () => {
  const vehicle = { category: 'hatchback', fuelType: 'petrol', fuelEfficiencyKmpl: 15 };
  const r = await calculateTrips([{ mode: 'car', distanceKm: 10, occupants: 1, vehicle }]);
  assert.deepStrictEqual(r.tripDetails[0].vehicle, vehicle);
});

test('tripDetails vehicle stays aligned when a zero-distance trip is dropped', async () => {
  // calculateTrips filters zero/negative distances, so tripDetails indices do
  // not match the input array — vehicle must travel with its own trip.
  const r = await calculateTrips([
    { mode: 'car', distanceKm: 0, vehicle: { category: 'suv' } },
    { mode: 'car', distanceKm: 10, occupants: 1, vehicle: { category: 'hatchback' } },
  ]);
  assert.strictEqual(r.tripDetails.length, 1);
  assert.strictEqual(r.tripDetails[0].vehicle.category, 'hatchback');
});

test('tripDetails vehicle defaults to an empty object when absent', async () => {
  const r = await calculateTrips([{ mode: 'metro', distanceKm: 5 }]);
  assert.deepStrictEqual(r.tripDetails[0].vehicle, {});
});

test('tripDetails exposes factor provenance for each trip', async () => {
  const r = await calculateTrips([
    { mode: 'car', distanceKm: 10, occupants: 2, vehicle: { category: 'hatchback', fuelType: 'petrol' } },
  ]);
  const [t] = r.tripDetails;
  assert.strictEqual(t.factorLevel, 'category');
  assert.strictEqual(t.factorKgPerKm, 0.145);
  assert.ok(Math.abs(t.tripTotalEmission - 1.45) < 1e-9);
  assert.ok(Math.abs(t.personalAllocatedEmission - 0.725) < 1e-9);
});
