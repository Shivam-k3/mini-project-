/**
 * Challenge repository (Phase 3A).
 *
 * Maps the Mongo `Challenge` model to the `public.challenges` table.
 *
 * Field mapping (Mongo -> PostgreSQL):
 *   title            -> title
 *   description      -> description
 *   category         -> category
 *   points           -> points
 *   targetReduction  -> target_reduction
 *   duration         -> duration_days   (NOTE: renamed)
 *   badge            -> badge
 *   isActive         -> is_active
 *   weekNumber       -> week_number
 *   collegeId        -> organization_id (NOTE: renamed)
 *   departmentId     -> department_id
 *   createdAt        -> created_at
 *
 * SCOPES (organization_id / department_id tuple):
 *   NULL/NULL        -> platform/global
 *   org + NULL dept  -> organization
 *   org + dept       -> department-specific
 *
 * PROGRESS: the Phase-1 draft mentioned a `challenge_entries` table, but the
 * APPLIED live schema (migration 001) has NO such table. Challenge completion is
 * tracked on the profile via `profiles.gamification.completedChallenges`
 * (jsonb array), matching the Mongo `User.gamification.completedChallenges`.
 * Use that for progress; do not invent a challenge_entries table.
 *
 * Reads scope challenges to the authenticated tenant; writes remain in the
 * gamification/college routes in later phases.
 */
const { client } = require('./supabaseClient');

const CHALLENGE_COLUMNS =
  'id, title, description, category, points, target_reduction, duration_days, badge, is_active, week_number, organization_id, department_id, created_at';

function tenancyError(msg) {
  const e = new Error(msg);
  e.name = 'TenancyError';
  e.status = 403;
  return e;
}

/**
 * List challenges visible to the authenticated actor:
 *   * platform/global (organization_id IS NULL) always visible
 *   * organization challenges visible when org matches the actor's org
 *   * department challenges visible when dept matches the actor's dept
 */
async function listVisible(tenant, opts = {}) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  let q = client()
    .from('challenges')
    .select(CHALLENGE_COLUMNS)
    .or(`organization_id.is.null,organization_id.eq.${tenant.organizationId || '00000000-0000-0000-0000-000000000000'}`)
    .order('created_at', { ascending: false });
  if (opts.activeOnly) q = q.eq('is_active', true);
  if (opts.category) q = q.eq('category', opts.category);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data || [];
  // Filter department challenges so only the actor's own department (when set)
  // is exposed. Tenant users without a department only see platform + org.
  return rows.filter((c) => {
    if (!c.organization_id) return true; // platform
    if (c.organization_id !== tenant.organizationId) return false; // other org
    if (!c.department_id) return true; // org-wide
    return tenant.departmentId === c.department_id; // dept must match
  });
}

/** Fetch a single challenge (scoped to platform / the actor's org / dept). */
async function findVisible(tenant, challengeId) {
  const all = await listVisible(tenant);
  return all.find((c) => c.id === challengeId) || null;
}

/** List ALL challenges (admin/platform). Not tenant-scoped membership. */
async function listAll(opts = {}) {
  let q = client().from('challenges').select(CHALLENGE_COLUMNS).order('created_at', { ascending: false });
  if (opts.activeOnly) q = q.eq('is_active', true);
  if (opts.organizationId) q = q.eq('organization_id', opts.organizationId);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/**
 * Create a challenge. The scope (org/dept) is derived from the authenticated
 * tenant context when present; platform challenges are created without tenancy.
 * A caller cannot attach a challenge to an organization it does not belong to.
 */
async function create(tenant, input) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  const organizationId = input.organizationId ?? tenant.organizationId ?? null;
  const departmentId = input.departmentId ?? tenant.departmentId ?? null;
  if (departmentId && !organizationId) throw tenancyError('Department challenge requires an organization');

  const { data, error } = await client().from('challenges').insert({
    title: input.title,
    description: input.description || '',
    category: input.category || 'general',
    points: input.points ?? 50,
    target_reduction: input.targetReduction ?? 10,
    duration_days: input.duration ?? 7,
    badge: input.badge || '',
    is_active: input.isActive ?? true,
    week_number: input.weekNumber ?? null,
    organization_id: organizationId,
    department_id: departmentId,
  }).select(CHALLENGE_COLUMNS).single();
  if (error) throw error;
  return data;
}

module.exports = { listVisible, findVisible, listAll, create };
