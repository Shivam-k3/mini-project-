/**
 * Emission factor repository (Phase 3A).
 *
 * Reads the canonical factor registry from `public.emission_factors` (26 rows).
 * This is a GLOBAL, read-only catalog — it has NO tenant ownership, matching the
 * Mongo `EmissionFactor` model and the platform's emission-resolution logic.
 *
 * The 3-tier lookup hierarchy (exact / category / generic) mirrors Mongo and the
 * `utils/factorResolver` static dataset. We do NOT re-implement factor
 * **calculation** here — that stays in factorResolver/tripEngine/ML. This
 * repository only reads the registry so the calculation layer can be fed from
 * PostgreSQL when routes are migrated (Phase 3B+).
 *
 * Provenance is preserved on every row (source, source_url, source_year,
 * region, confidence_level).
 */
const { client } = require('./supabaseClient');

const FACTOR_COLUMNS =
  'id, mode, manufacturer, model, variant, vehicle_category, fuel_type, co2_kg_per_km, kwh_per_km, source, source_url, source_year, region, confidence_level, active, dataset_version';

/** Count all active factor rows (expect 26). */
async function countActive() {
  const { count, error } = await client().from('emission_factors').select('*', { count: 'exact', head: true }).eq('active', true);
  if (error) throw error;
  return count;
}

/** All active factors. */
async function listActive() {
  const { data, error } = await client().from('emission_factors').select(FACTOR_COLUMNS).eq('active', true).order('mode');
  if (error) throw error;
  return data || [];
}

/** Factors for a specific mode (generic + category + exact rows). */
async function listByMode(mode) {
  const { data, error } = await client().from('emission_factors').select(FACTOR_COLUMNS).eq('mode', mode).eq('active', true);
  if (error) throw error;
  return data || [];
}

/**
 * Resolve the factor row for a mode + optional category/fuel. Implements the
 * read portion of the 3-tier lookup from PostgreSQL (used only by tests /
 * future integration, not the current live resolver).
 * Precedence: vehicle-specific (manufacturer != '') > category > generic (one
 * row with empty category/fuel). Returns an array so callers can apply their
 * own ordering; returns [] when nothing matches.
 */
async function resolve(mode, opts = {}) {
  let q = client()
    .from('emission_factors')
    .select(FACTOR_COLUMNS)
    .eq('mode', mode)
    .eq('active', true);
  if (opts.manufacturer) q = q.eq('manufacturer', opts.manufacturer);
  if (opts.vehicleCategory) q = q.eq('vehicle_category', opts.vehicleCategory);
  if (opts.fuelType) q = q.eq('fuel_type', opts.fuelType);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

module.exports = { countActive, listActive, listByMode, resolve };
