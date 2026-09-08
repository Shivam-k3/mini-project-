/**
 * Twin Engine — derives a user's Mobility Twin from their CarbonEntry history.
 *
 * The twin is always DERIVED (never manually edited):
 *   1. Baseline: average daily personal transport emissions over the last
 *      WINDOW_DAYS entries with data, plus per-mode breakdown and weekly km.
 *   2. Vehicle profile: the most frequent vehicle-annotated trip.
 *   3. Model metadata: synced from the ML service's scoped prediction.
 *
 * Replacement analysis is computed locally from the emission-factor dataset —
 * using the USER'S OWN weekly km and vehicle — so suggestions are personalised,
 * not generic averages.
 */

const { carbonRepository, mobilityTwinRepository } = require('../repositories');
const { toApiEntry } = require('../repositories/carbonSerializer');
const { toApiTwin } = require('../repositories/twinSerializer');
const { calculateTrips } = require('./tripEngine');
const { resolveTripFactor, describeLevel } = require('./factorResolver');
const { getPredictions } = require('./mlService');

const WINDOW_DAYS = 28;
const SPLIT_MODES = ['car', 'motorcycle', 'auto_rickshaw', 'ev'];
const VEHICLE_MODES = ['car', 'ev', 'motorcycle', 'auto_rickshaw'];

// ---------------------------------------------------------------------------
// Baseline derivation
// ---------------------------------------------------------------------------
async function _entryPersonalKg(entry) {
  // Prefer stored occupancy-allocated value; recompute for legacy entries.
  if (typeof entry.transportPersonal === 'number') return entry.transportPersonal;
  if (Array.isArray(entry.trips) && entry.trips.length > 0) {
    const r = await calculateTrips(entry.trips);
    return r.transportPersonal;
  }
  // Legacy lifestyle shape: aggregate transport km map (occupancy unknown → treat as personal)
  const t = entry.transport || {};
  let total = 0;
  for (const [mode, km] of Object.entries(t)) {
    const f = await resolveTripFactor({ mode });
    total += Number(km || 0) * f.factorKgPerKm;
  }
  return total;
}

async function _entryModeBreakdown(entry) {
  if (entry.modeBreakdown && typeof entry.modeBreakdown === 'object' && Object.keys(entry.modeBreakdown).length) {
    return entry.modeBreakdown;
  }
  if (Array.isArray(entry.trips) && entry.trips.length > 0) {
    return (await calculateTrips(entry.trips)).modeBreakdown;
  }
  const t = entry.transport || {};
  const out = {};
  for (const [mode, km] of Object.entries(t)) {
    if (mode === 'carOccupants') continue;
    const f = await resolveTripFactor({ mode });
    out[mode] = (out[mode] || 0) + Number(km || 0) * f.factorKgPerKm;
  }
  return out;
}

function _entryWeeklyKmByMode(entry) {
  const km = {};
  if (Array.isArray(entry.trips)) {
    for (const trip of entry.trips) {
      km[trip.mode] = (km[trip.mode] || 0) + Number(trip.distanceKm || 0);
    }
  } else {
    for (const [mode, v] of Object.entries(entry.transport || {})) {
      if (mode === 'carOccupants') continue;
      km[mode] = (km[mode] || 0) + Number(v || 0);
    }
  }
  return km;
}

async function _deriveBaseline(entries) {
  if (!entries.length) {
    return {
      windowDays: WINDOW_DAYS, entryCount: 0,
      dailyPersonalKg: 0, weeklyPersonalKg: 0, monthlyPersonalKg: 0,
      modeBreakdown: {}, weeklyKmByMode: {}, occupancyProfile: {},
      dataQuality: 'no_data',
    };
  }

  let totalKg = 0;
  const kgByMode = {};
  const kmByMode = {};
  const occSum = {};
  const occCount = {};

  for (const entry of entries) {
    totalKg += await _entryPersonalKg(entry);
    const mb = await _entryModeBreakdown(entry);
    for (const [mode, kg] of Object.entries(mb)) {
      kgByMode[mode] = (kgByMode[mode] || 0) + kg;
    }
    for (const [mode, km] of Object.entries(_entryWeeklyKmByMode(entry))) {
      kmByMode[mode] = (kmByMode[mode] || 0) + km;
    }
    for (const trip of entry.trips || []) {
      if (SPLIT_MODES.includes(trip.mode)) {
        occSum[trip.mode] = (occSum[trip.mode] || 0) + Number(trip.occupants || 1);
        occCount[trip.mode] = (occCount[trip.mode] || 0) + 1;
      }
    }
  }

  const n = entries.length;
  const dailyPersonalKg = Math.round((totalKg / n) * 100) / 100;

  const modeBreakdown = {};
  for (const [mode, kg] of Object.entries(kgByMode)) {
    modeBreakdown[mode] = Math.round((kg / n) * 1000) / 1000;
  }
  const weeklyKm = {};
  for (const [mode, km] of Object.entries(kmByMode)) {
    weeklyKm[mode] = Math.round(((km / n) * 7) * 10) / 10;
  }
  const occupancyProfile = {};
  for (const mode of SPLIT_MODES) {
    if (occCount[mode]) occupancyProfile[mode] = Math.round((occSum[mode] / occCount[mode]) * 10) / 10;
  }

  const dataQuality = n >= 20 ? 'good' : n >= 8 ? 'moderate' : 'sparse';

  return {
    windowDays: WINDOW_DAYS,
    entryCount: n,
    dailyPersonalKg,
    weeklyPersonalKg: Math.round(dailyPersonalKg * 7 * 100) / 100,
    monthlyPersonalKg: Math.round(dailyPersonalKg * 30 * 100) / 100,
    modeBreakdown,
    weeklyKmByMode: weeklyKm,
    occupancyProfile,
    dataQuality,
  };
}

// ---------------------------------------------------------------------------
// Vehicle profile extraction
// ---------------------------------------------------------------------------
async function _deriveVehicleProfile(entries) {
  const counts = new Map();
  for (const entry of entries) {
    for (const trip of entry.trips || []) {
      if (!VEHICLE_MODES.includes(trip.mode)) continue;
      const v = trip.vehicle || {};
      const key = JSON.stringify([trip.mode, v.manufacturer || '', v.model || '', v.category || '', v.fuelType || '']);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  if (!counts.size) return {};
  const bestKey = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const [mode, manufacturer, model, category, fuelType] = JSON.parse(bestKey);

  const resolved = await resolveTripFactor({
    mode,
    vehicle: {
      manufacturer: manufacturer || undefined,
      model: model || undefined,
      category: category || undefined,
      fuelType: fuelType || undefined,
    },
  });

  return {
    mode,
    manufacturer: manufacturer || undefined,
    model: model || undefined,
    variant: undefined,
    category: category || undefined,
    fuelType: fuelType || undefined,
    factorLevel: resolved.level,
    co2GPerKm: Math.round(resolved.factorKgPerKm * 1000 * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Personalised replacement analysis (local, factor-based)
// ---------------------------------------------------------------------------
async function buildReplacementOptions(twin) {
  const { baseline, vehicleProfile } = twin;
  const options = [];

  const carKmWeek = baseline.weeklyKmByMode.car || 0;
  const evKmWeek = baseline.weeklyKmByMode.ev || 0;
  const motoKmWeek = baseline.weeklyKmByMode.motorcycle || 0;
  const autoKmWeek = baseline.weeklyKmByMode.auto_rickshaw || 0;

  const carOcc = baseline.occupancyProfile.car || 1;

  // --- Option A: shift solo car km to metro --------------------------------
  if (carKmWeek > 5) {
    const carF = await resolveTripFactor({ mode: 'car', occupants: carOcc, vehicle: vehicleProfile.mode === 'car' ? vehicleProfile : {} });
    const metroF = await resolveTripFactor({ mode: 'metro' });
    const shifted = carKmWeek;
    const saving = (carF.factorKgPerKm - metroF.factorKgPerKm) * shifted;
    options.push({
      id: 'car_to_metro',
      title: `Shift ${Math.round(shifted)} km/week of car travel to metro`,
      currentKgPerWeek: Math.round(carF.factorKgPerKm * shifted * 100) / 100,
      scenarioKgPerWeek: Math.round(metroF.factorKgPerKm * shifted * 100) / 100,
      weeklySavingKg: Math.round(saving * 100) / 100,
      yearlySavingKg: Math.round(saving * 52 * 10) / 10,
      basis: `${describeLevel(carF)} vs ${describeLevel(metroF)} at your own distances`,
    });
  }

  // --- Option B: carpool the solo car km -----------------------------------
  if (carKmWeek > 5 && carOcc < 4) {
    const soloF = await resolveTripFactor({ mode: 'car', occupants: carOcc, vehicle: vehicleProfile.mode === 'car' ? vehicleProfile : {} });
    const poolF = await resolveTripFactor({ mode: 'car', occupants: Math.min(4, carOcc + 2), vehicle: vehicleProfile.mode === 'car' ? vehicleProfile : {} });
    const saving = (soloF.factorKgPerKm - poolF.factorKgPerKm) * carKmWeek;
    options.push({
      id: 'carpool_plus2',
      title: `Carpool with ${Math.min(4, carOcc + 2) - 1} others instead of ${carOcc === 1 ? 'driving solo' : `${carOcc} occupants`}`,
      currentKgPerWeek: Math.round(soloF.factorKgPerKm * carKmWeek * 100) / 100,
      scenarioKgPerWeek: Math.round(poolF.factorKgPerKm * carKmWeek * 100) / 100,
      weeklySavingKg: Math.round(saving * 100) / 100,
      yearlySavingKg: Math.round(saving * 52 * 10) / 10,
      basis: 'Same vehicle, occupancy-allocated per-person share',
    });
  }

  // --- Option C: replace petrol vehicle with an EV --------------------------
  const petrolModes = ['car', 'motorcycle'].filter(
    (m) => (vehicleProfile.mode === m && vehicleProfile.fuelType !== 'electric') ||
           (m === 'car' && !vehicleProfile.mode && carKmWeek > 0) ||
           (m === 'motorcycle' && !vehicleProfile.mode && motoKmWeek > 0)
  );
  if (petrolModes.length) {
    const mode = petrolModes[0];
    const kmWeek = mode === 'car' ? carKmWeek : motoKmWeek;
    if (kmWeek > 3) {
      const curF = await resolveTripFactor({ mode, occupants: 1, vehicle: vehicleProfile.mode === mode ? vehicleProfile : {} });
      const evF = await resolveTripFactor({ mode: 'ev', vehicle: {} }); // default consumption × grid
      const saving = (curF.factorKgPerKm - evF.factorKgPerKm) * kmWeek;
      if (saving > 0) {
        options.push({
          id: `ev_replace_${mode}`,
          title: `Replace your ${vehicleProfile.model || mode} with an EV for ${Math.round(kmWeek)} km/week`,
          currentKgPerWeek: Math.round(curF.factorKgPerKm * kmWeek * 100) / 100,
          scenarioKgPerWeek: Math.round(evF.factorKgPerKm * kmWeek * 100) / 100,
          weeklySavingKg: Math.round(saving * 100) / 100,
          yearlySavingKg: Math.round(saving * 52 * 10) / 10,
          basis: `${describeLevel(curF)} vs EV at India grid intensity (CEA v19)`,
        });
      }
    }
  }

  // --- Option D: auto-rickshaw to bus ---------------------------------------
  if (autoKmWeek > 5) {
    const autoF = await resolveTripFactor({ mode: 'auto_rickshaw', occupants: baseline.occupancyProfile.auto_rickshaw || 1 });
    const busF = await resolveTripFactor({ mode: 'bus' });
    const saving = (autoF.factorKgPerKm - busF.factorKgPerKm) * autoKmWeek;
    if (saving > 0) {
      options.push({
        id: 'auto_to_bus',
        title: `Shift ${Math.round(autoKmWeek)} km/week of auto trips to bus`,
        currentKgPerWeek: Math.round(autoF.factorKgPerKm * autoKmWeek * 100) / 100,
        scenarioKgPerWeek: Math.round(busF.factorKgPerKm * autoKmWeek * 100) / 100,
        weeklySavingKg: Math.round(saving * 100) / 100,
        yearlySavingKg: Math.round(saving * 52 * 10) / 10,
        basis: `${describeLevel(autoF)} vs ${describeLevel(busF)}`,
      });
    }
  }

  options.sort((a, b) => b.yearlySavingKg - a.yearlySavingKg);
  return options;
}

// ---------------------------------------------------------------------------
// Main derivation
// ---------------------------------------------------------------------------
async function deriveTwin(tenant, mongoUserId) {
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);

  // Carbon entries now live in Supabase PostgreSQL (Phase 3B). Fetch them from
  // the carbon repository, then map each row to the camelCase form the baseline
  // helpers below were written against. This preserves the derivation algorithm
  // exactly — only the data source changed (the user's entries now live in PG).
  const rows = await carbonRepository.listByUser(tenant, {
    from: since.toISOString(),
    limit: WINDOW_DAYS,
  });
  const entries = rows.map(toApiEntry);

  const baseline = await _deriveBaseline(entries);
  const vehicleProfile = await _deriveVehicleProfile(entries);

  // Sync ML metadata (non-fatal if ML service is down). Keep the Mongo user id
  // as the ML scope id so existing model linkage is unchanged.
  let modelMetadata = { scope: 'user', scopeId: String(mongoUserId), modelVersion: '3.0.0' };
  try {
    const history = entries.map((e) => ({ ...e, _id: String(e._id), user: String(mongoUserId) }));
    const pred = await getPredictions(String(mongoUserId), history, 'user', String(mongoUserId));
    modelMetadata = {
      scope: 'user',
      scopeId: String(mongoUserId),
      modelVersion: pred.modelVersion || '3.0.0',
      sampleCount: pred.nSamples || entries.length,
      predictionMethod: pred.method || null,
      syncedAt: new Date(),
    };
  } catch (e) {
    modelMetadata.syncedAt = new Date();
  }

  // Persist via the Supabase repository. The upsert is keyed on user_id
  // (UNIQUE) so re-derivation replaces baseline/vehicle/model metadata while
  // preserving the user's saved scenarios.
  const saved = await mobilityTwinRepository.upsert(tenant, {
    baseline,
    vehicleProfile,
    modelMetadata,
    derivedAt: new Date(),
  });

  return toApiTwin(saved);
}

async function getOrCreateTwin(tenant, mongoUserId) {
  let twin = await mobilityTwinRepository.findByOwner(tenant);
  if (!twin) twin = await deriveTwin(tenant, mongoUserId);
  else twin = toApiTwin(twin);
  return twin;
}

module.exports = {
  deriveTwin,
  getOrCreateTwin,
  buildReplacementOptions,
  WINDOW_DAYS,
};
