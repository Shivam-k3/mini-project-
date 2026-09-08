const { client } = require('../repositories/supabaseClient');
const { FACTOR_DATASET } = require('../utils/factorResolver');

/**
 * Transport-focused platform challenges (spec §34).
 * No food/water/waste/energy challenges.
 */
const challenges = [
  { title: 'Car-Free Day', description: 'Complete one full day using only active or public transport', category: 'transport', points: 40, badge: 'first_entry', weekNumber: 1 },
  { title: 'Public Transport Week', description: 'Use only bus/metro for your commute 5 days straight', category: 'transport', points: 60, badge: 'green_commuter', weekNumber: 1 },
  { title: 'Carpool Challenge', description: 'Share your car with at least 2 occupants for 3 days', category: 'transport', points: 50, badge: 'green_commuter', weekNumber: 2 },
  { title: 'Green Commute Challenge', description: 'Cycle or walk trips under 3 km for a week', category: 'transport', points: 45, badge: 'eco_hero', weekNumber: 2 },
  { title: 'Walk + Metro Combo', description: 'Replace short car trips with walking-to-metro chains', category: 'transport', points: 55, badge: 'challenge_champ', weekNumber: 3 },
  { title: 'Reduce Solo Trips', description: 'Cut solo car occupancy trips by half this week', category: 'transport', points: 65, badge: 'carbon_cut', weekNumber: 3 },
  { title: 'Efficient Vehicle Switch', description: 'Run a vehicle-replacement simulation in your Mobility Twin', category: 'transport', points: 35, badge: 'challenge_champ', weekNumber: 4 },
  { title: 'Eco Streak', description: 'Log mobility entries for 7 consecutive days', category: 'general', points: 70, badge: 'week_streak', weekNumber: 4 },
];

/**
 * Idempotent emission-factor seeding (Phase 3H: PostgreSQL).
 * - Upserts generic-mode and category-level rows (identified by empty manufacturer).
 * - NEVER deletes rows: super-admin-curated vehicle catalog entries survive.
 * Unique key: (mode, manufacturer, model, variant, vehicle_category, fuel_type).
 */
async function seedEmissionFactors() {
  if (!FACTOR_DATASET) {
    console.warn('emission-factors.json missing — skipping factor seed');
    return;
  }
  const version = FACTOR_DATASET.version;
  const rows = [];

  // Generic mode-level factors
  for (const [mode, row] of Object.entries(FACTOR_DATASET.modes)) {
    rows.push({
      mode,
      manufacturer: '',
      model: '',
      variant: '',
      vehicle_category: '',
      fuel_type: '',
      co2_kg_per_km: row.co2_kg_per_km,
      kwh_per_km: null,
      source: row.source || '',
      source_url: row.source_url || '',
      source_year: row.source_year || null,
      region: 'IN',
      confidence_level: row.confidence_level || 'low',
      active: true,
      dataset_version: version,
    });
  }

  // Category-level factors
  for (const row of FACTOR_DATASET.vehicle_categories) {
    rows.push({
      mode: row.mode,
      manufacturer: '',
      model: '',
      variant: '',
      vehicle_category: row.vehicle_category,
      fuel_type: row.fuel_type,
      co2_kg_per_km: row.co2_kg_per_km || 0,
      kwh_per_km: row.kwh_per_km || null,
      source: 'Indicative category default (see dataset honesty policy)',
      source_url: '',
      source_year: null,
      region: 'IN',
      confidence_level: row.confidence_level || 'low',
      active: true,
      dataset_version: version,
    });
  }

  // Grid electricity factor (kg CO2 per kWh, stored in co2_kg_per_km column)
  const grid = FACTOR_DATASET.grid_electricity;
  rows.push({
    mode: 'grid_electricity',
    manufacturer: '',
    model: '',
    variant: '',
    vehicle_category: '',
    fuel_type: '',
    co2_kg_per_km: grid.factor_kg_per_kwh,
    kwh_per_km: null,
    source: grid.source,
    source_url: grid.source_url,
    source_year: grid.source_year,
    region: grid.region,
    confidence_level: grid.confidence_level,
    active: true,
    dataset_version: version,
  });

  const { error } = await client()
    .from('emission_factors')
    .upsert(rows, { onConflict: 'mode,manufacturer,model,variant,vehicle_category,fuel_type' });
  if (error) throw new Error(`seedEmissionFactors: ${error.message}`);
  console.log(`Emission factors seeded/upserted (${rows.length} rows, dataset v${version})`);
}

/**
 * Platform-wide challenge catalog (organization_id NULL, department_id NULL).
 * Challenges belong to the platform, not to a tenant. Idempotent (upsert by
 * title) and deliberately never deleted, so the catalog survives a re-seed.
 */
async function seedPlatformChallenges() {
  const rows = challenges.map((ch) => ({
    title: ch.title,
    description: ch.description,
    category: ch.category,
    points: ch.points,
    target_reduction: ch.targetReduction || 10,
    duration_days: ch.duration || 7,
    badge: ch.badge || '',
    is_active: true,
    week_number: ch.weekNumber || null,
    organization_id: null,
    department_id: null,
  }));
  const { error } = await client()
    .from('challenges')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`seedPlatformChallenges: ${error.message}`);
  console.log(`${rows.length} platform-wide transport challenges seeded/upserted`);
}

/**
 * Seed the PostgreSQL datastore (idempotent, non-destructive):
 *   * emission factors (curated catalog + generic tiers)
 *   * platform-wide challenge catalog
 *
 * Demo identities (Supabase Auth + profiles) are NOT created here — use:
 *   node scripts/provisionSupabaseAuth.js
 */
async function seedHelper() {
  await seedEmissionFactors();
  await seedPlatformChallenges();
  console.log('Seeding complete. Demo identities: run `node scripts/provisionSupabaseAuth.js`.');
}

module.exports = seedHelper;
