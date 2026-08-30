/**
 * Hierarchical emission-factor resolver.
 *
 * Priority (spec §7):
 *   1. vehicle-specific : user-declared CO2 g/km  OR  exact catalog match
 *   2. category         : vehicle_category + fuel_type catalog row
 *      (with an efficiency-derived intermediate when only km/L is known)
 *   3. generic-mode     : mode-level default factor
 *
 * EVs are handled separately (spec §10): kWh/km x grid emission factor,
 * never petrol/diesel fuel efficiency.
 *
 * The canonical dataset lives in config/emission-factors.json and is seeded
 * into the EmissionFactor collection. Catalog (DB) hits take precedence over
 * the static dataset so super admins can curate factors without a deploy;
 * if the DB is unavailable the static dataset keeps the platform working.
 */
const path = require('path');
const mongoose = require('mongoose');
const EmissionFactor = require('../models/EmissionFactor');

const FACTOR_DATASET = require(path.join(__dirname, '..', '..', 'config', 'emission-factors.json'));

const ZERO_EMISSION_MODES = new Set(['bicycle', 'walk']);
const OCCUPANCY_SPLIT_MODES = new Set(['car', 'motorcycle', 'auto_rickshaw', 'ev']);

const GRID_KG_PER_KWH = FACTOR_DATASET.grid_electricity.factor_kg_per_kwh;
const FUEL_KG_PER_LITER = FACTOR_DATASET.fuel_combustion_kg_per_liter;
const EV_DEFAULT_KWH_PER_KM = FACTOR_DATASET.ev_default_consumption_kwh_per_km;

const norm = (v) => String(v || '').toLowerCase().trim();

function sourceMeta(row) {
  return {
    name: row?.source || '',
    url: row?.source_url || '',
    year: row?.source_year || null,
    region: row?.region || FACTOR_DATASET.grid_electricity.region,
    confidence: row?.confidence_level || 'low',
  };
}

const USER_DECLARED_SOURCE = {
  name: 'User-declared vehicle CO\u2082 (from registration/certification documents)',
  url: '',
  year: null,
  region: 'IN',
  confidence: 'high',
};

function result(factorKgPerKm, level, source, methodology) {
  return {
    factorKgPerKm: Math.round(factorKgPerKm * 10000) / 10000,
    level,
    source,
    methodology,
  };
}

/**
 * How a catalog/dataset row's kg CO2/km was arrived at. Rows carrying
 * `kwh_per_km` are electric and go through the grid intensity (spec §10);
 * everything else stores kg CO2/km directly.
 */
function rowMethodology(row, tier) {
  if (row.kwh_per_km != null) {
    return `${row.kwh_per_km} kWh/km × ${GRID_KG_PER_KWH} kgCO₂/kWh grid intensity (${tier})`;
  }
  return `${row.co2_kg_per_km} kgCO₂/km taken directly from the ${tier} factor`;
}

/* ── Static-dataset lookups (fallback tier) ───────────────────────── */

function staticGeneric(mode) {
  const row = FACTOR_DATASET.modes[mode];
  if (!row) return null;
  const perPassenger = row.per_passenger ? ', already expressed per passenger' : '';
  return result(
    row.co2_kg_per_km,
    'generic-mode',
    sourceMeta(row),
    `Mode-level default for ${mode}: ${row.co2_kg_per_km} kgCO₂/km${perPassenger}`
  );
}

function staticCategory(mode, category, fuelType) {
  const row = FACTOR_DATASET.vehicle_categories.find(
    (c) => c.mode === mode && c.vehicle_category === norm(category) && c.fuel_type === norm(fuelType)
  );
  if (!row) return null;
  const factor = row.kwh_per_km != null ? row.kwh_per_km * GRID_KG_PER_KWH : row.co2_kg_per_km;
  return result(factor, 'category', sourceMeta(row), rowMethodology(row, `${row.vehicle_category}/${row.fuel_type} category`));
}

/* ── Catalog (DB) lookups ─────────────────────────────────────────── */

async function catalogExact(mode, vehicle) {
  if (mongoose.connection.readyState !== 1) return null;
  try {
    const row = await EmissionFactor.findOne({
      mode,
      manufacturer: norm(vehicle.manufacturer),
      model: norm(vehicle.model),
      variant: norm(vehicle.variant),
      active: true,
    }).lean();
    if (!row) return null;
    const factor = row.kwh_per_km != null ? row.kwh_per_km * GRID_KG_PER_KWH : row.co2_kg_per_km;
    const label = [row.manufacturer, row.model, row.variant].filter(Boolean).join(' ');
    return result(factor, 'vehicle-specific', sourceMeta(row), rowMethodology(row, `curated catalog entry for ${label}`));
  } catch {
    return null;
  }
}

async function catalogCategory(mode, category, fuelType) {
  if (mongoose.connection.readyState !== 1) return null;
  try {
    const row = await EmissionFactor.findOne({
      mode,
      vehicle_category: norm(category),
      fuel_type: norm(fuelType),
      manufacturer: '',
      active: true,
    }).lean();
    if (!row) return null;
    const factor = row.kwh_per_km != null ? row.kwh_per_km * GRID_KG_PER_KWH : row.co2_kg_per_km;
    return result(
      factor,
      'category',
      sourceMeta(row),
      rowMethodology(row, `${row.vehicle_category}/${row.fuel_type} category`)
    );
  } catch {
    return null;
  }
}

/* ── Public API ───────────────────────────────────────────────────── */

/**
 * Resolve the emission factor for one trip.
 * @param {Object} trip - { mode, vehicle?: {manufacturer,model,variant,category,fuelType,fuelEfficiencyKmpl,electricityConsumptionKwhPerKm,declaredCo2GPerKm} }
 * @returns {Promise<{factorKgPerKm:number, level:string, source:Object}>}
 */
async function resolveTripFactor(trip) {
  const mode = norm(trip.mode);
  const vehicle = trip.vehicle || {};

  // Zero-emission modes short-circuit.
  if (ZERO_EMISSION_MODES.has(mode)) {
    return result(0, 'generic-mode', sourceMeta(FACTOR_DATASET.modes[mode] || {}),
      `${mode} has no tailpipe or fuel-cycle emissions — 0 kgCO₂/km`);
  }

  // Level 1a: user-declared certified CO2 g/km (highest integrity).
  const declared = Number(vehicle.declaredCo2GPerKm);
  if (Number.isFinite(declared) && declared > 0) {
    return result(declared / 1000, 'vehicle-specific', USER_DECLARED_SOURCE,
      `Declared vehicle figure ${declared} gCO₂/km ÷ 1000`);
  }

  // EV branch (spec §10): consumption x grid factor only.
  if (mode === 'ev' || norm(vehicle.fuelType) === 'electric') {
    const consumption = Number(vehicle.electricityConsumptionKwhPerKm);
    let kwhPerKm;
    let level;
    let source;
    let methodology;
    if (Number.isFinite(consumption) && consumption > 0) {
      kwhPerKm = consumption;
      level = 'vehicle-specific';
      source = {
        name: `User-declared efficiency ${kwhPerKm} kWh/km \u00d7 grid ${GRID_KG_PER_KWH} kgCO\u2082/kWh`,
        url: FACTOR_DATASET.grid_electricity.source_url,
        year: FACTOR_DATASET.grid_electricity.source_year,
        region: 'IN',
        confidence: 'medium',
      };
      methodology = `Declared ${kwhPerKm} kWh/km × ${GRID_KG_PER_KWH} kgCO₂/kWh grid intensity`;
    } else {
      const cat = await catalogCategory('car', vehicle.category, 'electric')
        || staticCategory('car', vehicle.category, 'electric');
      if (cat && vehicle.category) {
        return cat;
      }
      kwhPerKm = EV_DEFAULT_KWH_PER_KM;
      level = 'generic-mode';
      source = sourceMeta(FACTOR_DATASET.modes.ev);
      methodology = `Default EV consumption ${EV_DEFAULT_KWH_PER_KM} kWh/km × ${GRID_KG_PER_KWH} kgCO₂/kWh grid intensity`;
    }
    return result(kwhPerKm * GRID_KG_PER_KWH, level, source, methodology);
  }

  // Level 1b: exact catalog entry (manufacturer+model+variant).
  if (vehicle.manufacturer && vehicle.model) {
    const exact = await catalogExact(mode, vehicle);
    if (exact) return exact;
  }

  // Level 2: category + fuel type from catalog, else static dataset.
  if (vehicle.category && vehicle.fuelType) {
    const cat = await catalogCategory(mode, vehicle.category, vehicle.fuelType)
      || staticCategory(mode, vehicle.category, vehicle.fuelType);
    if (cat) return cat;
  }

  // Level 2.5: fuel-efficiency derivation (spec §9):
  //   CO2/km = combustion factor (kg/L) / efficiency (km/L)
  const efficiency = Number(vehicle.fuelEfficiencyKmpl);
  const fuelType = norm(vehicle.fuelType);
  if (Number.isFinite(efficiency) && efficiency > 0 && FUEL_KG_PER_LITER[fuelType]) {
    return result(
      FUEL_KG_PER_LITER[fuelType] / efficiency,
      'efficiency-derived',
      {
        name: `${FUEL_KG_PER_LITER[fuelType]} kgCO\u2082/L (${fuelType}) \u00f7 ${efficiency} km/L`,
        url: 'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
        year: 2024,
        region: 'IN',
        confidence: 'medium',
      },
      `${fuelType} combustion ${FUEL_KG_PER_LITER[fuelType]} kgCO₂/L ÷ declared ${efficiency} km/L fuel efficiency`
    );
  }

  // Level 3: generic mode factor.
  return staticGeneric(mode) || result(
    FACTOR_DATASET.modes.car.co2_kg_per_km,
    'generic-mode',
    sourceMeta({}),
    `Unrecognised mode "${mode}" — car mode default applied`
  );
}

/** Modes whose vehicle emissions are split among occupants (spec §13). */
function isOccupancySplitMode(mode) {
  return OCCUPANCY_SPLIT_MODES.has(norm(mode));
}

/**
 * UI-facing label for the resolved level (spec §7).
 * Accepts either the level string or a whole resolveTripFactor() result, since
 * callers hold the result object far more often than the bare level.
 */
function describeLevel(levelOrResult) {
  const level = typeof levelOrResult === 'string' ? levelOrResult : levelOrResult?.level;
  switch (level) {
    case 'vehicle-specific': return 'Vehicle-specific';
    case 'category': return 'Category-level';
    case 'efficiency-derived': return 'Fuel-efficiency derived';
    default: return 'Generic mode';
  }
}

/* ── Request adapter for GET /api/factors/resolve ──────────────────── */

/** Modes the platform recognises, straight from the canonical dataset. */
const KNOWN_MODES = Object.keys(FACTOR_DATASET.modes);

/** 400-class failure for a malformed factor-resolution request. */
class FactorRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FactorRequestError';
    this.status = 400;
  }
}

const asText = (v) => (v === undefined || v === null ? undefined : String(v).trim() || undefined);

function asPositiveNumber(label, v) {
  if (v === undefined || v === null || String(v).trim() === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new FactorRequestError(`${label} must be a positive number`);
  return n;
}

/**
 * Validate a client factor-resolution request and answer it from the resolver
 * above — the client asks *which* factor applies, it never supplies one
 * (spec §12). Read-only: nothing here writes to the factor dataset.
 *
 * @throws {FactorRequestError} on an unknown mode or a non-positive number.
 */
async function resolveFactorRequest(input = {}) {
  const mode = norm(input.mode);
  if (!mode) throw new FactorRequestError('mode is required');
  if (!KNOWN_MODES.includes(mode)) {
    throw new FactorRequestError(`Unknown mode "${mode}". Supported: ${KNOWN_MODES.join(', ')}`);
  }

  const vehicle = {
    manufacturer: asText(input.manufacturer),
    model: asText(input.model),
    variant: asText(input.variant),
    category: asText(input.vehicleCategory ?? input.category),
    fuelType: asText(input.fuelType),
    fuelEfficiencyKmpl: asPositiveNumber(
      'fuelEfficiencyKmPerL',
      input.fuelEfficiencyKmPerL ?? input.fuelEfficiencyKmpl
    ),
    electricityConsumptionKwhPerKm: asPositiveNumber(
      'energyConsumptionKwhPerKm',
      input.energyConsumptionKwhPerKm ?? input.electricityConsumptionKwhPerKm
    ),
    declaredCo2GPerKm: asPositiveNumber('declaredCo2GPerKm', input.declaredCo2GPerKm),
  };

  const resolved = await resolveTripFactor({ mode, vehicle });

  return {
    mode,
    factorKgPerKm: resolved.factorKgPerKm,
    factorLevel: resolved.level,
    factorLevelLabel: describeLevel(resolved.level),
    factorSource: resolved.source?.name || '',
    sourceUrl: resolved.source?.url || '',
    sourceYear: resolved.source?.year ?? null,
    methodology: resolved.methodology || '',
    region: resolved.source?.region || '',
    confidence: resolved.source?.confidence || 'low',
    occupancySplit: isOccupancySplitMode(mode),
    perPassenger: Boolean(FACTOR_DATASET.modes[mode]?.per_passenger),
    datasetVersion: FACTOR_DATASET.version,
  };
}

module.exports = {
  resolveTripFactor,
  resolveFactorRequest,
  FactorRequestError,
  KNOWN_MODES,
  isOccupancySplitMode,
  describeLevel,
  GRID_KG_PER_KWH,
  FUEL_KG_PER_LITER,
  EV_DEFAULT_KWH_PER_KM,
  FACTOR_DATASET,
};
