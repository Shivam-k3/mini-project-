// Trip-engine parity test: JS tripEngine/factorResolver vs Python emission_utils.calculate_trips
// Covers factor resolution levels (vehicle-specific / category / efficiency-derived / generic),
// EV grid math, occupancy allocation, per-passenger public transport, and clamping.
const { calculateTrips, clampOccupants } = require('../backend/utils/tripEngine');
const { execFileSync } = require('child_process');
const path = require('path');

const CASES = [
  [{ mode: 'car', distanceKm: 10 }],
  [{ mode: 'car', distanceKm: 10, occupants: 3 }],
  [{ mode: 'car', distanceKm: 10, vehicle: { declaredCo2GPerKm: 120 } }],
  [{ mode: 'car', distanceKm: 10, vehicle: { category: 'suv', fuelType: 'petrol' } }],
  [{ mode: 'car', distanceKm: 10, vehicle: { fuelType: 'petrol', fuelEfficiencyKmpl: 16 } }],
  [{ mode: 'ev', distanceKm: 10 }],
  [{ mode: 'ev', distanceKm: 10, vehicle: { electricityConsumptionKwhPerKm: 0.18 } }],
  [{ mode: 'metro', distanceKm: 12, occupants: 3 }],
  [
    { mode: 'bus', distanceKm: 8, tripFrequency: 2 },
    { mode: 'motorcycle', distanceKm: 15, occupants: 2 },
  ],
  [{ mode: 'walk', distanceKm: 3 }, { mode: 'bicycle', distanceKm: 7 }],
  [{ mode: 'car', distanceKm: 6, occupants: 3, purpose: 'school' }],
  [{ mode: 'car', distanceKm: 16, occupants: 99 }],
];

const EXPECTED = [
  { personal: 2.1, household: 2.1, level: 'generic-mode' },
  { personal: 0.7, household: 2.1, level: 'generic-mode' },
  { personal: 1.2, household: 1.2, level: 'vehicle-specific' },
  { personal: 2.0, household: 2.0, level: 'category' },
  { personal: 1.44, household: 1.44, level: 'efficiency-derived' },
  { personal: 1.07, household: 1.07, level: 'generic-mode' },
  { personal: 1.29, household: 1.29, level: 'vehicle-specific' },
  { personal: 0.49, household: 0.49, level: 'generic-mode' },
  { personal: 2.27, household: 3.12, level: null }, // bus 1.424 + moto raw 1.695 = 3.119 -> 3.12
  { personal: 0, household: 0, level: 'generic-mode' },
  { personal: 0.42, household: 1.26, level: 'generic-mode' },
  { personal: 0.42, household: 3.36, level: 'generic-mode' }, // 16*0.21=3.36 raw; /8 = 0.42
];

const pyScript = path.join(__dirname, 'trip_parity_check.py');
const pyResults = JSON.parse(
  execFileSync(process.env.PYTHON || 'C:\\Users\\Asus\\sem 3 mini\\ml-service\\venv\\Scripts\\python.exe',
    [pyScript], { encoding: 'utf-8' })
);

let pass = 0;
let fail = 0;
const check = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log('FAIL:', msg); } };

(async () => {
  for (let i = 0; i < CASES.length; i++) {
    const js = await calculateTrips(CASES[i]);
    const py = pyResults[i];
    const exp = EXPECTED[i];

    // JS vs Python parity
    check(Math.abs(js.transportPersonal - py.transportPersonal) < 0.001,
      `case ${i + 1} personal parity js=${js.transportPersonal} py=${py.transportPersonal}`);
    check(Math.abs(js.transportHousehold - py.transportHousehold) < 0.001,
      `case ${i + 1} household parity js=${js.transportHousehold} py=${py.transportHousehold}`);
    for (const k of Object.keys(js.modeBreakdown)) {
      check(Math.abs((py.modeBreakdown[k] || 0) - js.modeBreakdown[k]) < 0.001,
        `case ${i + 1} modeBreakdown.${k} parity`);
    }

    // Expected values (JS side)
    if (exp.level) {
      check(js.tripDetails[0].factorLevel === exp.level,
        `case ${i + 1} level js=${js.tripDetails[0].factorLevel} expected=${exp.level}`);
      check(py.tripDetails[0].factorLevel === exp.level,
        `case ${i + 1} python level py=${py.tripDetails[0].factorLevel}`);
    }
    check(Math.abs(js.transportPersonal - exp.personal) < 0.005,
      `case ${i + 1} personal value js=${js.transportPersonal} expected=${exp.personal}`);
    check(Math.abs(js.transportHousehold - exp.household) < 0.005,
      `case ${i + 1} household value js=${js.transportHousehold} expected=${exp.household}`);
  }

  // Clamp behaviour (JS)
  check(clampOccupants(99) === 8 && clampOccupants(0) === 1 && clampOccupants('x') === 1, 'clamp JS');
  // Per-passenger sanity: metro with 8 occupants equals solo metro
  const soloMetro = await calculateTrips([{ mode: 'metro', distanceKm: 12 }]);
  const fullMetro = await calculateTrips([{ mode: 'metro', distanceKm: 12, occupants: 8 }]);
  check(soloMetro.transportPersonal === fullMetro.transportPersonal, 'metro not split by occupants');

  console.log(`\nTRIP PARITY RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
