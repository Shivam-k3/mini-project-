/**
 * Simulation repository (Phase 3A).
 *
 * Maps the Mongo `Simulation` model to the `public.simulations` table.
 *
 * Field mapping (Mongo -> PostgreSQL):
 *   user        -> user_id (profiles.id uuid)
 *   name        -> name
 *   baseline    -> baseline (jsonb)
 *   changes     -> changes (jsonb)
 *   results     -> results (jsonb)
 *   createdAt   -> created_at
 *
 * NOTE: the Phase-1 draft called this table `mobility_simulations`; the APPLIED
 * live schema (migration 001) is `simulations`. Use `simulations`.
 *
 * Ownership is always the authenticated profile id. Live Simulator routes are
 * NOT switched to this repository in Phase 3A — this is the data-access
 * foundation only.
 */
const { client } = require('./supabaseClient');

const SIM_COLUMNS = 'id, user_id, name, baseline, changes, results, created_at';

function tenancyError(msg) {
  const e = new Error(msg);
  e.name = 'TenancyError';
  e.status = 403;
  return e;
}

/** List the authenticated user's simulations, most recent first. */
async function listByOwner(tenant, opts = {}) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  let q = client().from('simulations').select(SIM_COLUMNS).eq('user_id', tenant.profileId);
  q = q.order('created_at', { ascending: false });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** Fetch one simulation, scoped to the authenticated owner. */
async function findById(tenant, simId) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  if (!simId) return null;
  const { data, error } = await client()
    .from('simulations')
    .select(SIM_COLUMNS)
    .eq('id', simId)
    .eq('user_id', tenant.profileId)
    .limit(1);
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

/** Create a simulation owned by the authenticated user. */
async function create(tenant, input) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  const { data, error } = await client().from('simulations').insert({
    user_id: tenant.profileId,
    name: input.name,
    baseline: input.baseline || {},
    changes: input.changes || {},
    results: input.results || {},
  }).select(SIM_COLUMNS).single();
  if (error) throw error;
  return data;
}

/** Delete a simulation, scoped to the authenticated owner. */
async function remove(tenant, simId) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  if (!simId) return false;
  const { error } = await client().from('simulations').delete().eq('id', simId).eq('user_id', tenant.profileId);
  if (error) throw error;
  return true;
}

module.exports = { listByOwner, findById, create, remove };
