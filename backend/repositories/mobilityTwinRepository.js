/**
 * Mobility Twin repository (Phase 3A).
 *
 * Maps the Mongo `MobilityTwin` model to the `public.mobility_twins` table.
 * One twin per user (mobility_twins.user_id UNIQUE).
 *
 * Field mapping (Mongo -> PostgreSQL):
 *   user                -> user_id (profiles.id uuid, UNIQUE)
 *   baseline            -> baseline (jsonb)
 *   vehicleProfile      -> vehicle_profile (jsonb)
 *   scenarios           -> scenarios (jsonb array)
 *   modelMetadata       -> model_metadata (jsonb)
 *   derivedAt           -> derived_at
 *   timestamps          -> created_at / updated_at
 *
 * NOTE: the Phase-1 draft called this table `mobility_simulations`; the APPLIED
 * live schema (migration 001) is `mobility_twins`. Use `mobility_twins`.
 *
 * Ownership is always the authenticated profile id. Live Twin routes are NOT
 * switched to this repository in Phase 3A — this is the data-access foundation
 * only.
 */
const { client } = require('./supabaseClient');

const TWIN_COLUMNS =
  'id, user_id, baseline, vehicle_profile, scenarios, model_metadata, derived_at, created_at, updated_at';

function tenancyError(msg) {
  const e = new Error(msg);
  e.name = 'TenancyError';
  e.status = 403;
  return e;
}

/** Fetch the authenticated user's twin (one per user). */
async function findByOwner(tenant) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  const { data, error } = await client()
    .from('mobility_twins')
    .select(TWIN_COLUMNS)
    .eq('user_id', tenant.profileId)
    .limit(1);
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

/** Fetch a twin by id, scoped to the authenticated owner. */
async function findById(tenant, twinId) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  if (!twinId) return null;
  const { data, error } = await client()
    .from('mobility_twins')
    .select(TWIN_COLUMNS)
    .eq('id', twinId)
    .eq('user_id', tenant.profileId)
    .limit(1);
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

/**
 * Upsert the authenticated user's twin. Ownership/profileId is always the
 * authenticated user; a caller cannot create a twin for another user.
 */
async function upsert(tenant, input = {}) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  const existing = await findByOwner(tenant);
  const row = {
    user_id: tenant.profileId,
    baseline: input.baseline ?? existing?.baseline ?? {},
    vehicle_profile: input.vehicleProfile ?? existing?.vehicle_profile ?? {},
    scenarios: input.scenarios ?? existing?.scenarios ?? [],
    model_metadata: input.modelMetadata ?? existing?.model_metadata ?? {},
    derived_at: input.derivedAt ?? existing?.derived_at ?? new Date().toISOString(),
  };
  const { data, error } = await client()
    .from('mobility_twins')
    .upsert(row, { onConflict: 'user_id' })
    .select(TWIN_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/** Delete the authenticated user's twin (scoped to owner). */
async function remove(tenant) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  const { error } = await client().from('mobility_twins').delete().eq('user_id', tenant.profileId);
  if (error) throw error;
  return true;
}

module.exports = { findByOwner, findById, upsert, remove };
