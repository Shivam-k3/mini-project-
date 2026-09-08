/**
 * Carbon entries repository (Phase 3A).
 *
 * Maps the Mongo `CarbonEntry` model to the `public.carbon_entries` table.
 *
 * Field mapping (Mongo -> PostgreSQL):
 *   user                  -> user_id (profiles.id uuid)
 *   date                  -> date
 *   trips[]               -> trips (jsonb)
 *   transportPersonal     -> transport_personal
 *   transportHousehold    -> transport_household
 *   modeBreakdown (Map)   -> mode_breakdown (jsonb)
 *   totalEmissions        -> total_emissions
 *   notes                 -> notes
 *   (legacy v2 fields)    -> legacy (jsonb, archival; not in ML pipeline)
 *   createdAt/updatedAt   -> created_at / updated_at
 *
 * TENANCY: carbon_entries `organization_id`/`department_id` are DENORMALIZED
 * from the authenticated profile at write time. They are never accepted from a
 * request body. Reads scope by user ownership; organization/dept aggregation
 * always uses the tenant context derived from the authenticated profile.
 */
const { client } = require('./supabaseClient');
const { assertDepartmentBelongsToOrg } = require('./tenancyContext');

const ENTRY_COLUMNS =
  'id, user_id, date, organization_id, department_id, trips, transport_personal, transport_household, mode_breakdown, total_emissions, legacy, notes, created_at, updated_at';

/** Fetch one entry, scoped to the authenticated owner. */
async function findById(tenant, entryId) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  if (!entryId) return null;
  const { data, error } = await client()
    .from('carbon_entries')
    .select(ENTRY_COLUMNS)
    .eq('id', entryId)
    .eq('user_id', tenant.profileId)
    .limit(1);
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

/**
 * List a user's entries. Ownership is always the authenticated profile id —
 * a client cannot ask for another user's entries. Defaults to NEWEST-first
 * (matching the Mongo `.sort({ date: -1 })` the report/simulator/twin rely on);
 * pass `ascending: true` for oldest-first.
 */
async function listByUser(tenant, opts = {}) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  let q = client().from('carbon_entries').select(ENTRY_COLUMNS).eq('user_id', tenant.profileId);
  if (opts.from) q = q.gte('date', opts.from);
  if (opts.to) q = q.lte('date', opts.to);
  q = q.order('date', { ascending: opts.ascending === true });
  if (opts.limit) q = q.limit(opts.limit);
  if (opts.offset) q = q.range(opts.offset, opts.offset + (opts.limit || 30) - 1);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/**
 * Count the authenticated user's entries. Used for pagination and for the
 * badge logic (which needs the real entry count after carbon moves to PG).
 */
async function countByUser(tenant, opts = {}) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  let q = client().from('carbon_entries').select('*', { count: 'exact', head: true }).eq('user_id', tenant.profileId);
  if (opts.from) q = q.gte('date', opts.from);
  if (opts.to) q = q.lte('date', opts.to);
  const { count, error } = await q;
  if (error) throw error;
  return count;
}

/**
 * Org/department aggregation (college/faculty/super-admin). Always scoped by
 * the authenticated tenant context; a caller cannot view another org's rows.
 */
async function listByTenant(tenant, opts = {}) {
  if (!tenant?.organizationId) throw tenancyError('Authenticated organization context required');
  let q = client().from('carbon_entries').select(ENTRY_COLUMNS).eq('organization_id', tenant.organizationId);
  if (opts.departmentId) q = q.eq('department_id', opts.departmentId);
  else if (tenant.departmentId && opts.scopeToOwnDept) q = q.eq('department_id', tenant.departmentId);
  if (opts.from) q = q.gte('date', opts.from);
  if (opts.to) q = q.lte('date', opts.to);
  q = q.order('date', { ascending: false });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/**
 * Create a carbon entry. The denormalized tenant fields (organization_id /
 * department_id) are derived from the authenticated tenant context. Any
 * organization_id/department_id supplied by a caller is ignored.
 */
async function create(tenant, input) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  const organizationId = tenant.organizationId || null;
  const departmentId = tenant.departmentId || null;
  if (departmentId) {
    await assertDepartmentBelongsToOrg(client(), organizationId, departmentId);
  }

  const { data, error } = await client().from('carbon_entries').insert({
    user_id: tenant.profileId,
    date: input.date || new Date().toISOString(),
    organization_id: organizationId,
    department_id: departmentId,
    trips: input.trips || [],
    transport_personal: input.transportPersonal ?? 0,
    transport_household: input.transportHousehold ?? 0,
    mode_breakdown: input.modeBreakdown || {},
    total_emissions: input.totalEmissions ?? 0,
    legacy: input.legacy || {},
    notes: input.notes || '',
  }).select(ENTRY_COLUMNS).single();
  if (error) throw error;
  return data;
}

/**
 * Update an entry, scoped to the authenticated owner. Tenant fields can never
 * be changed through this method (a caller cannot move a row across tenants).
 */
async function update(tenant, entryId, changes) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  const allowed = {};
  for (const k of ['trips', 'transport_personal', 'transport_household', 'mode_breakdown', 'total_emissions', 'legacy', 'notes', 'date']) {
    if (changes && Object.prototype.hasOwnProperty.call(changes, k)) allowed[k] = changes[k];
  }
  if (Object.keys(allowed).length === 0) return findById(tenant, entryId);
  const { data, error } = await client()
    .from('carbon_entries')
    .update(allowed)
    .eq('id', entryId)
    .eq('user_id', tenant.profileId)
    .select(ENTRY_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/** Delete an entry, scoped to the authenticated owner. */
async function remove(tenant, entryId) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  if (!entryId) return false;
  const { error } = await client()
    .from('carbon_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', tenant.profileId);
  if (error) throw error;
  return true;
}

/**
 * Delete every carbon entry owned by `userId` within the authenticated
 * organization (admin delete-user cascade). Scoped so an admin can only delete
 * rows that already belong to their own org.
 * @returns {number} number of rows deleted
 */
async function removeForUser(tenant, userId) {
  if (!tenant?.organizationId) throw tenancyError('Authenticated organization context required');
  if (!userId) return 0;
  const { data, error } = await client()
    .from('carbon_entries')
    .delete()
    .eq('user_id', userId)
    .eq('organization_id', tenant.organizationId)
    .select('id');
  if (error) throw error;
  return (data || []).length;
}

function tenancyError(msg) {
  const e = new Error(msg);
  e.name = 'TenancyError';
  e.status = 403;
  return e;
}

/**
 * List ALL of the authenticated user's entries (no pagination), most recent
 * first. Used by the dashboard aggregates and the badge logic.
 */
async function listAllByUser(tenant, opts = {}) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  let q = client().from('carbon_entries').select(ENTRY_COLUMNS).eq('user_id', tenant.profileId);
  q = q.order('date', { ascending: false });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

module.exports = {
  findById,
  listByUser,
  listAllByUser,
  countByUser,
  listByTenant,
  listByUserIds,
  create,
  update,
  remove,
  removeForUser,
};

/**
 * Fetch carbon entries owned by a set of profile ids (used by college/faculty
 * aggregation). Scoped to the authenticated organization; a caller can never
 * include ids from another org's members. Returns rows newest-first with an
 * optional date window — the caller aggregates in JS to preserve the exact
 * emission semantics of the admin/faculty dashboards.
 */
async function listByUserIds(tenant, userIds, opts = {}) {
  if (!tenant?.organizationId) throw tenancyError('Authenticated organization context required');
  if (!userIds || !userIds.length) return [];
  let q = client()
    .from('carbon_entries')
    .select(ENTRY_COLUMNS)
    .eq('organization_id', tenant.organizationId)
    .in('user_id', userIds);
  if (opts.from) q = q.gte('date', opts.from);
  if (opts.to) q = q.lte('date', opts.to);
  q = q.order('date', { ascending: false });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
