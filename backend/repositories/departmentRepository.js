/**
 * Department repository (Phase 3A).
 *
 * Mirrors the former Mongo `Department` (collegeId -> organization_id). A
 * department belongs to exactly one organization; its code is unique WITHIN
 * that organization (departments_org_code_key). Reads expose org/department
 * names for /me and admin UIs. Department membership is always resolved against
 * the authenticated tenant context — never from client input.
 */
const { client } = require('./supabaseClient');
const { fromProfile, assertDepartmentBelongsToOrg } = require('./tenancyContext');

const DEPT_COLUMNS = 'id, organization_id, name, code, created_at, updated_at';

/** Lookup a department by id. */
async function findById(deptId) {
  if (!deptId) return null;
  const { data, error } = await client().from('departments').select(DEPT_COLUMNS).eq('id', deptId).limit(1);
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

/** List departments belonging to an organization (id derived from tenant context). */
async function listByOrganization(tenant) {
  if (!tenant?.organizationId) {
    const e = new Error('Authenticated organization context required');
    e.name = 'TenancyError'; e.status = 403; throw e;
  }
  const { data, error } = await client()
    .from('departments')
    .select(DEPT_COLUMNS)
    .eq('organization_id', tenant.organizationId)
    .order('name');
  if (error) throw error;
  return data || [];
}

/** List departments visible to the actor (their own org, or all for platform roles). */
async function list(tenant, opts = {}) {
  let q = client().from('departments').select(DEPT_COLUMNS).order('name');
  if (tenant?.organizationId) q = q.eq('organization_id', tenant.organizationId);
  else if (opts.organizationId) q = q.eq('organization_id', opts.organizationId);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** Create a department under the authenticated organization. */
async function create(tenant, input) {
  if (!tenant?.organizationId) {
    const e = new Error('Authenticated organization context required');
    e.name = 'TenancyError'; e.status = 403; throw e;
  }
  // The department must belong to the AUTHENTICATED org, never a client-supplied one.
  const { data, error } = await client().from('departments').insert({
    organization_id: tenant.organizationId,
    name: input.name,
    code: input.code,
  }).select().single();
  if (error) throw error;
  return data;
}

/**
 * Resolve ONE department that belongs to the authenticated organization.
 * A department id from another org (or a fabricated id) behaves as "not
 * found" — it can never be observed or mutated across the boundary.
 */
async function findScoped(tenant, deptId) {
  if (!deptId) return null;
  let q = client().from('departments').select(DEPT_COLUMNS).eq('id', deptId);
  if (tenant?.organizationId) q = q.eq('organization_id', tenant.organizationId);
  const { data, error } = await q.limit(1);
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

/** Update a department scoped to the authenticated org. Returns row or null. */
async function update(tenant, deptId, changes) {
  if (!tenant?.organizationId) {
    const e = new Error('Authenticated organization context required');
    e.name = 'TenancyError'; e.status = 403; throw e;
  }
  const row = await findScoped(tenant, deptId);
  if (!row) return null;
  const allowed = {};
  if (changes && Object.prototype.hasOwnProperty.call(changes, 'name')) allowed.name = changes.name;
  if (changes && Object.prototype.hasOwnProperty.call(changes, 'code')) allowed.code = changes.code;
  if (!Object.keys(allowed).length) return row;
  const { data, error } = await client()
    .from('departments')
    .update(allowed)
    .eq('id', deptId)
    .eq('organization_id', tenant.organizationId)
    .select(DEPT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/** Delete a department scoped to the authenticated org. Returns row or null. */
async function remove(tenant, deptId) {
  if (!tenant?.organizationId) {
    const e = new Error('Authenticated organization context required');
    e.name = 'TenancyError'; e.status = 403; throw e;
  }
  const row = await findScoped(tenant, deptId);
  if (!row) return null;
  const { data, error } = await client()
    .from('departments')
    .delete()
    .eq('id', deptId)
    .eq('organization_id', tenant.organizationId)
    .select(DEPT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

module.exports = { findById, listByOrganization, list, create, findScoped, update, remove, assertDepartmentBelongsToOrg, fromProfile };
