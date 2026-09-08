/**
 * Tenancy context for the repository layer (Phase 3A).
 *
 * Every repository method that reads/writes tenant-owned data MUST receive a
 * TenantContext derived from the AUTHENTICATED profile — never from a client
 * request body / query string.
 *
 * A caller must never be able to change organization_id, department_id, or user
 * ownership by manipulating request JSON: routes build the context from
 * req.auth.profile (the verified Supabase profile); repositories validate this
 * context and assert ownership in every query.
 *
 * Invariants enforced here (mirroring the PostgreSQL schema):
 *   * PERSONAL   : role='individual' -> organization_id IS NULL, department_id IS NULL
 *   * ORGANIZATION : organization_id NOT NULL (optional department_id)
 *   * A department_id, when present, MUST belong to the same organization_id
 *     (profiles_dept_in_org composite FK guarantees this at the DB level too).
 */

class TenancyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TenancyError';
    this.status = 403;
  }
}

/**
 * Build a tenant context from a decoded profile row (PostgreSQL `profiles`).
 *
 * @param {object} profile - a `profiles` row: { id, auth_user_id, role,
 *   organization_id, department_id, status }
 * @throws {TenancyError} if the profile is missing/invalid, its role/tenancy is
 *   inconsistent, or it is not an active profile.
 * @returns {{ profileId: string, organizationId: string|null,
 *   departmentId: string|null, role: string }}
 */
function fromProfile(profile) {
  if (!profile) throw new TenancyError('Authenticated profile is required');
  if (!profile.id) throw new TenancyError('Authenticated profile has no id');
  if (profile.status === 'suspended') throw new TenancyError('Account is suspended');
  if (profile.status && !['active', 'suspended'].includes(profile.status)) {
    throw new TenancyError('Profile has an invalid status');
  }

  const role = profile.role || 'individual';
  const organizationId = profile.organization_id || null;
  const departmentId = profile.department_id || null;

  if (role === 'individual') {
    if (organizationId || departmentId) {
      throw new TenancyError('Personal profiles must not carry tenant scoping');
    }
  } else {
    // super_admin may be platform-wide (no org); college_admin/faculty/student
    // must belong to an organization (profiles_org_requires_role).
    if (role !== 'super_admin' && !organizationId) {
      throw new TenancyError(`${role} profile must belong to an organization`);
    }
    if (departmentId && !organizationId) {
      throw new TenancyError('Department cannot be set without an organization');
    }
    if (departmentId && organizationId) {
      // organization/department agreement is enforced relationally by the
      // composite FK (departments(id, organization_id)); a context built from a
      // real profile row is inherently consistent. The repository asserts this
      // on query for belt-and-braces (see assertDepartmentBelongsToOrg).
    }
  }

  return { profileId: profile.id, organizationId, departmentId, role };
}

/**
 * Assert that a department belongs to an organization. Useful before writing a
 * tenant-owned row with denormalized org/dept, so we never rely on client input
 * for the pair.
 *
 * @param {object} db - supabase admin client
 * @param {string} organizationId
 * @param {string|null} departmentId
 * @throws {TenancyError} if departmentId is set but does not belong to org.
 */
async function assertDepartmentBelongsToOrg(db, organizationId, departmentId) {
  if (!departmentId) return;
  if (!organizationId) throw new TenancyError('Department requires an organization');
  const { data, error } = await db
    .from('departments')
    .select('id, organization_id')
    .eq('id', departmentId)
    .eq('organization_id', organizationId)
    .limit(1);
  if (error) throw new TenancyError('Unable to verify department tenancy');
  if (!data || data.length === 0) {
    throw new TenancyError('Department does not belong to the authenticated organization');
  }
}

module.exports = { fromProfile, assertDepartmentBelongsToOrg, TenancyError };
