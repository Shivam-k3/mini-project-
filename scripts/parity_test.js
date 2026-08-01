// Dual-calc parity test: JS emissionFactors vs Python emission_utils
const { calculateEmissions, simulateScenario, getVehicleOccupants } = require('../backend/utils/emissionFactors');
const { execFileSync } = require('child_process');
const path = require('path');

const cases = [
  { transport: { car: 10 }, electricity: 10, water: 150, foodHabit: 'nonVegetarian', shoppingFrequency: 'medium', wasteGeneration: 'medium', fuel: { petrol: 0, diesel: 0, lpg: 0 }, solarPanels: false },
  { transport: { car: 10, carOccupants: 3 }, electricity: 10, water: 150, foodHabit: 'nonVegetarian', shoppingFrequency: 'medium', wasteGeneration: 'medium', fuel: { petrol: 0, diesel: 0, lpg: 0 }, solarPanels: false },
  { transport: { car: 20, ev: 12, bus: 5, metro: 3, bike: 2, flight: 0, carOccupants: 4 }, electricity: 15, water: 200, foodHabit: 'vegan', shoppingFrequency: 'low', wasteGeneration: 'low', fuel: { petrol: 1.5, diesel: 0, lpg: 0.5 }, solarPanels: true },
  { transport: { ev: 30, carOccupants: 8 }, electricity: 0, water: 0, foodHabit: 'vegetarian', shoppingFrequency: 'high', wasteGeneration: 'high', fuel: {}, solarPanels: false },
  { transport: { car: 5, carOccupants: 0 }, electricity: 8, water: 100, foodHabit: 'nonVegetarian', shoppingFrequency: 'medium', wasteGeneration: 'medium', fuel: {}, solarPanels: false },
];

const pyScript = path.join(__dirname, 'parity_check.py');
const pyResults = JSON.parse(execFileSync('C:\\Users\\Asus\\sem 3 mini\\ml-service\\venv\\Scripts\\python.exe', [pyScript], { encoding: 'utf-8' }));

let pass = 0;
let fail = 0;
cases.forEach((c, i) => {
  const js = calculateEmissions(c);
  const py = pyResults[i];
  const fields = ['total', 'householdTotal'];
  const breaks = ['breakdown', 'householdBreakdown'];
  const errors = [];
  for (const f of fields) {
    if (Math.abs((js[f] || 0) - (py[f] || 0)) > 0.021) errors.push(`${f}: js=${js[f]} py=${py[f]}`);
  }
  for (const b of breaks) {
    for (const k of Object.keys(js[b] || {})) {
      if (Math.abs((js[b]?.[k] || 0) - (py[b]?.[k] || 0)) > 0.021) errors.push(`${b}.${k}: js=${js[b][k]} py=${py[b][k]}`);
    }
  }
  if (errors.length === 0) { pass++; } else { fail++; console.log(`CASE ${i + 1} MISMATCH:`, errors.join(' | ')); }
});

// Scenario checks (JS side)
const baseline = { transport: { car: 10, carOccupants: 1 }, electricity: 10, water: 150, foodHabit: 'nonVegetarian', shoppingFrequency: 'medium', wasteGeneration: 'medium', fuel: {}, solarPanels: false };
const carpool = simulateScenario(baseline, { carOccupants: 4 });
const soloCarTransport = carpool.baseline.breakdown.transport;
const carpoolTransport = carpool.scenario.breakdown.transport;
if (Math.abs(carpoolTransport - soloCarTransport / 4) > 0.011) { fail++; console.log('CARPOOL DIVISION WRONG:', soloCarTransport, carpoolTransport); } else { pass++; }
const transportOnlyReduction = (soloCarTransport - carpoolTransport) / soloCarTransport * 100;
if (transportOnlyReduction < 74 || transportOnlyReduction > 76) { fail++; console.log('CARPOOL TRANSPORT SAVING WRONG:', transportOnlyReduction); } else { pass++; }
if (Math.abs(carpool.scenario.total - 15.53) > 0.02) { fail++; console.log('CARPOOL TOTAL WRONG:', carpool.scenario.total); } else { pass++; }
if (carpool.scenario.breakdown.transport !== 0.53) { fail++; console.log('CARPOOL ROUNDED TRANSPORT WRONG:', carpool.scenario.breakdown.transport); } else { pass++; }

// Occupants clamp
if (getVehicleOccupants({ carOccupants: 0 }) !== 1 || getVehicleOccupants({ carOccupants: 99 }) !== 8 || getVehicleOccupants({}) !== 1) { fail++; console.log('CLAMP FAIL'); } else { pass++; }

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
