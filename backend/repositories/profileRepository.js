/**
 * Profile repository (Phase 3A).
 *
 * `public.profiles` is the canonical application identity layer:
 *
 *     auth.users.id -> profiles.auth_user_id -> profiles.user_id -> Mongo User
 *
 * This repository exposes read/update for profiles used across the business
 * layer. It enforces profile ownership: a profile can only ever be read/updated
 * by (a) the matching authenticated profile id (self), or (b) an authorized
 * actor operating within the same tenant. Callers pass tenant context derived
 * from the authenticated profile (never client input).
 */
const { client } = require('./supabaseClient');
const { fromProfile } = require('./tenancyContext');

const PROFILE_COLUMNS =
  'id, auth_user_id, user_id, name, email, role, organization_id, department_id, semester, section, first_login, status, profile, gamification, created_at, updated_at';

/**
 * Lookup a profile by its Supabase auth user id (auth.users.id). NULL if the
 * matching profile does not exist.
 */
async function findByAuthUserId(authUserId) {
  if (!authUserId) return null;
  const { data, error } = await client()
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('auth_user_id', authUserId)
    .limit(1);
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

/** Lookup a profile by its application user_id (e.g. "CSE25001"). */
async function findByUserId(userId) {
  if (!userId) return null;
  const { data, error } = await client()
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', userId)
    .limit(1);
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

/** Lookup a profile by its PostgreSQL profile id (profiles.id). */
async function findById(profileId) {
  if (!profileId) return null;
  const { data, error } = await client()
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', profileId)
    .limit(1);
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

/**
 * Idempotent, race-safe find-or-create for a PERSONAL profile bound to a real
 * Supabase auth identity.
 *
 * This is the first-login provisioning path for accounts that authenticate
 * through Supabase OAuth (e.g. Google): a valid `auth.users` row exists but
 * there is no `public.profiles` row yet, so the app cannot recognize the user.
 * If a profile already exists (returning user, or a concurrent first-login
 * already created it) it is returned untouched — role / org / dept / data are
 * never overwritten. When missing, a personal profile is created:
 *
 *   role='individual', organization_id=NULL, department_id=NULL,
 *   auth_user_id = authUserId, first_login=false (matches /register).
 *
 * The individual `user_id` (IND0001, IND0002, ...) follows the same sequential
 * convention as POST /auth/register. The insert is exercised against both
 * unique constraints (`auth_user_id`, `user_id`, `email`); on `user_id`
 * collision with a concurrent insert we re-derive the next sequence and retry,
 * and on `auth_user_id`/`email` conflict (another session won the race) we
 * simply return the now-existing row.
 *
 * @param {string} authUserId         - Supabase auth.users.id (verified token sub).
 * @param {{email?: string, name?: string}} [identity] - display identity from the
 *                                        OAuth provider / auth user metadata.
 * @returns {Promise<{ profile: object|null, created: boolean }>}
 */
async function ensurePersonalProfile(authUserId, identity = {}) {
  if (!authUserId) return { profile: null, created: false };

  const existing = await findByAuthUserId(authUserId);
  if (existing) return { profile: existing, created: false };

  const email = String(identity.email || '').toLowerCase();
  const name = String(identity.name || '').trim() || (email ? email.split('@')[0] : 'User');

  for (let attempt = 0; attempt < 5; attempt++) {
    const userId = await nextIndividualUserId();
    const { data, error } = await client()
      .from('profiles')
      .insert({
        auth_user_id: authUserId,
        user_id: userId,
        name,
        email: email || `${authUserId}@ecoguardian.local`,
        role: 'individual',
        organization_id: null,
        department_id: null,
        semester: '',
        section: '',
        first_login: false,
        status: 'active',
        profile: {},
        gamification: {},
      })
      .select(PROFILE_COLUMNS)
      .single();
    if (!error && data) return { profile: data, created: true };

    // A concurrent insert may have won the race (auth_user_id/email key) —
    // treat that as success and return the existing row.
    const raced = await findByAuthUserId(authUserId);
    if (raced) return { profile: raced, created: false };
    // Otherwise the sequential user_id collided with a concurrent insert by a
    // different user; loop re-derives the next sequence and retries.
  }

  throw new Error('Failed to provision personal profile');
}

/** Derive the next sequential individual identifier (IND0001, IND0002, ...). */
async function nextIndividualUserId() {
  let nextSeq = 1;
  try {
    const { data: last, error } = await client()
      .from('profiles')
      .select('user_id')
      .ilike('user_id', 'IND%')
      .order('created_at', { ascending: false })
      .limit(1);
    if (!error && last && last.length) {
      const m = /^IND(\d+)$/.exec(last[0].user_id || '');
      nextSeq = m ? (parseInt(m[1], 10) || 0) + 1 : 1;
    }
  } catch { nextSeq = 1; }
  return `IND${String(nextSeq).padStart(4, '0')}`;
}

/**
 * Fetch the authenticated actor's own profile and build a validated tenant
 * context from it. This is the canonical way routes obtain the tenancy
 * information for downstream repository calls.
 * @param {string} authUserId - Supabase auth.users.id from the verified token.
 * @returns {{ profile, tenant }}
 */
async function getAuthContext(authUserId) {
  const profile = await findByAuthUserId(authUserId);
  if (!profile) return { profile: null, tenant: null };
  return { profile, tenant: fromProfile(profile) };
}

/**
 * Update a profile's mutable fields (self-update).
 * Only the authenticated profile may update its own row (ownership is asserted
 * by matching profileId). Explicit allow-list so no caller can re-scope an org /
 * department / role or change identity via an update.
 */
async function updateProfile(tenant, changes) {
  if (!tenant || !tenant.profileId) {
    const { fromProfile } = require('./tenancyContext');
    const e = new Error('Authenticated tenant context required');
    e.name = 'TenancyError'; e.status = 403; throw e;
  }
  const allowed = {};
  for (const k of ['name', 'semester', 'section', 'first_login', 'profile', 'gamification']) {
    if (changes && Object.prototype.hasOwnProperty.call(changes, k)) allowed[k] = changes[k];
  }
  if (Object.keys(allowed).length === 0) return findById(tenant.profileId);

  const { data, error } = await client()
    .from('profiles')
    .update(allowed)
    .eq('id', tenant.profileId)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * List profiles within a tenant scope (organization, optionally a department).
 * Used by college/faculty/super-admin aggregation. The scope is taken from the
 * authenticated tenant context, never from a request body.
 */
async function listByTenant(tenant, opts = {}) {
  if (!tenant || !tenant.organizationId) {
    const e = new Error('Authenticated organization context required');
    e.name = 'TenancyError'; e.status = 403; throw e;
  }
  let q = client().from('profiles').select(PROFILE_COLUMNS).eq('organization_id', tenant.organizationId);
  if (opts.departmentId) q = q.eq('department_id', opts.departmentId);
  else if (tenant.departmentId) q = q.eq('department_id', tenant.departmentId);
  if (opts.role) q = q.eq('role', opts.role);
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

module.exports = {
  findByAuthUserId,
  findByUserId,
  findById,
  getAuthContext,
  updateProfile,
  listByTenant,
  ensurePersonalProfile,
};
