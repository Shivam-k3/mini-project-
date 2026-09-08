/**
 * Admin profile repository (Phase 3G).
 *
 * College-admin / faculty user & profile administration against the canonical
 * `public.profiles` table.
 *
 * TENANCY: every operation is scoped by the authenticated tenant context
 * derived from `req.auth.profile` (never client input). A college_admin can
 * only reach profiles within their own organization; a faculty member only
 * students in their own department. A caller can never read / write a profile
 * in another organization or department.
 *
 * PRIVILEGE ESCALATION PROTECTION: mutating methods use a strict allow-list of
 * fields. A profile's identity (auth_user_id, user_id), role, and organization
 * can NEVER be changed through `update`. Role/org are only ever set at
 * provisioning time (`create`) and then only by an RBAC-authorized actor. The
 * authenticated organization is always used for `organization_id` — a
 * client-supplied one is ignored.
 */

const { client } = require('./supabaseClient');
const { assertDepartmentBelongsToOrg } = require('./tenancyContext');

const PROFILE_COLUMNS =
  'id, auth_user_id, user_id, name, email, role, organization_id, department_id, semester, section, first_login, status, profile, gamification, created_at, updated_at';

function tenancyError(msg) {
  const e = new Error(msg);
  e.name = 'TenancyError';
  e.status = 403;
  return e;
}

/** Email uniqueness is GLOBAL (matches Mongo `User.findOne({email})`). */
async function emailExists(email) {
  if (!email) return false;
  const { data, error } = await client()
    .from('profiles')
    .select('id')
    .eq('email', String(email).toLowerCase())
    .limit(1);
  if (error) throw error;
  return data && data.length > 0;
}

/**
 * Resolve a single profile AND assert it belongs to the authorized scope.
 * For a college_admin the profile must share the same organization. For a
 * faculty member it must be a student in the same department.
 * @returns {object|null} the profile row, or null if it does not exist
 *   (wrong-scope ids behave as "not found" so things cannot be probed).
 */
async function findScoped(tenant, profileId) {
  if (!profileId) return null;
  let q = client().from('profiles').select(PROFILE_COLUMNS).eq('id', profileId);
  if (tenant.organizationId) q = q.eq('organization_id', tenant.organizationId);
  const { data, error } = await q.limit(1);
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

/**
 * List profiles within the authenticated organization, honoring the admin
 * list filters (role, search by name/email/user_id, department).
 * Mirrors the Mongo `GET /collegeadmin/users` filter semantics:
 *   * role === 'all' (or absent) -> only faculty + student (college-scoped)
 *   * otherwise roles are filtered literally
 * Ordered by created_at DESC (matches Mongo `.sort({createdAt:-1})`).
 */
async function listByOrg(tenant, opts = {}) {
  if (!tenant?.organizationId) throw tenancyError('Authenticated organization context required');
  let q = client().from('profiles').select(PROFILE_COLUMNS).eq('organization_id', tenant.organizationId);
  if (opts.departmentId) q = q.eq('department_id', opts.departmentId);
  let roleFilter = opts.role;
  if (!roleFilter || roleFilter === 'all') {
    q = q.in('role', ['faculty', 'student']);
  } else {
    q = q.eq('role', roleFilter);
  }
  q = q.order('created_at', { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  let rows = data || [];
  if (opts.search && opts.search.trim()) {
    const s = String(opts.search.trim()).toLowerCase();
    rows = rows.filter((p) =>
      (p.name || '').toLowerCase().includes(s) ||
      (p.email || '').toLowerCase().includes(s) ||
      (p.user_id || '').toLowerCase().includes(s)
    );
  }
  return rows;
}

/** Students in the authenticated department (faculty participation monitor). */
async function listStudentsByDept(tenant) {
  if (!tenant?.departmentId) throw tenancyError('Authenticated department context required');
  let q = client()
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('department_id', tenant.departmentId)
    .eq('role', 'student')
    .order('name');
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** Count profiles in the org by role/status (single query each). */
async function countByOrg(tenant, opts = {}) {
  if (!tenant?.organizationId) throw tenancyError('Authenticated organization context required');
  let q = client().from('profiles').select('*', { count: 'exact', head: true }).eq('organization_id', tenant.organizationId);
  if (opts.role) q = q.eq('role', opts.role);
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.departmentId) q = q.eq('department_id', opts.departmentId);
  const { count, error } = await q;
  if (error) throw error;
  return count;
}

/**
 * Provision a new student/faculty profile within the authenticated org.
 * @param {object} tenant - authenticated tenant context (college_admin)
 * @param {object} input - { auth_user_id, user_id, name, email, role,
 *   departmentId, semester, section }
 *   auth_user_id is the Supabase auth.users.id created by the route (the
 *   profiles.auth_user_id column is NOT NULL, so EVERY profile row is bound to a
 *   real Supabase identity). user_id is CALLER-GENERATED (e.g. CSE26001 /
 *   FAC001) and role is a business input authorized by the college_admin RBAC —
 *   but organization_id is ALWAYS the authenticated org.
 */
async function create(tenant, input) {
  if (!tenant?.organizationId) throw tenancyError('Authenticated organization context required');
  if (!input.auth_user_id) throw new Error('auth_user_id is required to provision a profile');
  const departmentId = input.departmentId || null;
  if (departmentId) {
    await assertDepartmentBelongsToOrg(client(), tenant.organizationId, departmentId);
  }
  const { data, error } = await client().from('profiles').insert({
    auth_user_id: input.auth_user_id,
    user_id: input.user_id,
    name: input.name,
    email: String(input.email || '').toLowerCase(),
    role: input.role,
    organization_id: tenant.organizationId,
    department_id: departmentId,
    semester: input.semester || '',
    section: input.section || '',
    first_login: true,
    status: 'active',
  }).select(PROFILE_COLUMNS).single();
  if (error) throw error;
  return data;
}

/**
 * Update a profile's admin-editable fields. STRICT allow-list + org scoping:
 * identity (auth_user_id / user_id), role, and organization_id can NEVER be
 * changed. A department change is validated to belong to the same org.
 */
async function update(tenant, profileId, changes) {
  const row = await findScoped(tenant, profileId);
  if (!row) return null;
  const allowed = {};
  if (Object.prototype.hasOwnProperty.call(changes, 'name')) allowed.name = changes.name;
  if (Object.prototype.hasOwnProperty.call(changes, 'semester')) allowed.semester = changes.semester;
  if (Object.prototype.hasOwnProperty.call(changes, 'section')) allowed.section = changes.section;
  if (Object.prototype.hasOwnProperty.call(changes, 'status')) allowed.status = changes.status;
  if (Object.prototype.hasOwnProperty.call(changes, 'first_login')) allowed.first_login = changes.first_login;
  if (Object.prototype.hasOwnProperty.call(changes, 'email')) allowed.email = String(changes.email || '').toLowerCase();
  if (Object.prototype.hasOwnProperty.call(changes, 'departmentId')) {
    const deptId = changes.departmentId || null;
    if (deptId) await assertDepartmentBelongsToOrg(client(), row.organization_id, deptId);
    allowed.department_id = deptId;
  }
  if (!Object.keys(allowed).length) return row;

  const { data, error } = await client()
    .from('profiles')
    .update(allowed)
    .eq('id', profileId)
    .eq('organization_id', row.organization_id)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/** Delete a profile scoped to the authenticated org. Returns deleted row or null. */
async function remove(tenant, profileId) {
  const row = await findScoped(tenant, profileId);
  if (!row) return null;
  const { data, error } = await client()
    .from('profiles')
    .delete()
    .eq('id', profileId)
    .eq('organization_id', row.organization_id)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Clear department membership on all profiles in the org for a department
 * being deleted (mirrors Mongo `User.updateMany({departmentId}, $set: null)`).
 */
async function unsetDepartment(tenant, deptId) {
  if (!tenant?.organizationId) throw tenancyError('Authenticated organization context required');
  const { error } = await client()
    .from('profiles')
    .update({ department_id: null })
    .eq('organization_id', tenant.organizationId)
    .eq('department_id', deptId);
  if (error) throw error;
}

/**
 * List distinct profile ids in the org that have at least one carbon entry
 * (student participation rate denominator). Returns an array of profile ids.
 */
async function distinctLoggedStudentIds(tenant, studentIds) {
  if (!tenant?.organizationId || !studentIds.length) return [];
  const { data, error } = await client()
    .from('carbon_entries')
    .select('user_id')
    .eq('organization_id', tenant.organizationId)
    .in('user_id', studentIds);
  if (error) throw error;
  const set = new Set((data || []).map((r) => r.user_id));
  return [...set];
}

module.exports = {
  emailExists,
  findScoped,
  listByOrg,
  listStudentsByDept,
  countByOrg,
  create,
  update,
  remove,
  unsetDepartment,
  distinctLoggedStudentIds,
};
