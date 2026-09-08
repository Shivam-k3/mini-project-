/**
 * Organization repository (Phase 3A).
 *
 * Mirrors the former Mongo `College`. Organizations are tenant roots; their
 * codes are globally unique (organizations.code UNIQUE). Reads are used to
 * display org names / codes in /me and admin UIs. Writes remain in the
 * college/super-admin routes (Express), matching the current Mongo behavior.
 */
const { client } = require('./supabaseClient');

const ORG_COLUMNS = 'id, name, code, address, license, status, created_at, updated_at';

/** Lookup an organization by id. */
async function findById(orgId) {
  if (!orgId) return null;
  const { data, error } = await client().from('organizations').select(ORG_COLUMNS).eq('id', orgId).limit(1);
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

/** Lookup an organization by its unique code (e.g. "MIT"). */
async function findByCode(code) {
  if (!code) return null;
  const { data, error } = await client().from('organizations').select(ORG_COLUMNS).eq('code', code).limit(1);
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

/** List organizations (read-only catalog). */
async function list(opts = {}) {
  let q = client().from('organizations').select(ORG_COLUMNS).order('name');
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** Create an organization (admin route). Returns the created row. */
async function create(input) {
  const { data, error } = await client().from('organizations').insert({
    name: input.name,
    code: input.code,
    address: input.address || '',
    license: input.license || {},
    status: input.status || 'active',
  }).select().single();
  if (error) throw error;
  return data;
}

/** Update an organization (admin route). */
async function update(orgId, changes) {
  const allowed = {};
  for (const k of ['name', 'code', 'address', 'license', 'status']) {
    if (changes && Object.prototype.hasOwnProperty.call(changes, k)) allowed[k] = changes[k];
  }
  if (Object.keys(allowed).length === 0) return findById(orgId);
  const { data, error } = await client().from('organizations').update(allowed).eq('id', orgId).select().single();
  if (error) throw error;
  return data;
}

module.exports = { findById, findByCode, list, create, update };
