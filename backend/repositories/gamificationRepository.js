/**
 * Gamification repository (Phase 3E).
 *
 * Gamification state for an authenticated actor lives in
 * `public.profiles.gamification` (jsonb):
 *
 *     { ecoScore, greenPoints, streak, lastActiveDate, badges[], completedChallenges[] }
 *
 * `completedChallenges` stores the PostgreSQL `challenges.id` (uuid) values —
 * the same ids the API exposes as `_id` via the challenge serializer — matching
 * the Mongo `User.gamification.completedChallenges` contract.
 *
 * CONCURRENCY (lost-update protection)
 * ------------------------------------
 * A profile row CAN be mutated concurrently (carbon logging bumps ecoScore /
 * streak, challenge completion bumps greenPoints, etc.). Replacing the whole
 * `gamification` jsonb with a read-modify-write would silently drop whichever
 * change commits last. Instead this repository performs every mutation as an
 * ADDITIVE change under an optimistic-concurrency guard:
 *
 *   1. read the profile (its gamification + `updated_at`)
 *   2. compute the new gamification from the just-read snapshot
 *   3. UPDATE ... WHERE id = :profile AND updated_at = :snapshot
 *   4. if 0 rows matched, another actor committed first -> re-read and re-apply
 *      (the change is additive, so re-applying never double-counts or drops the
 *      concurrent contribution; the loop caps iterations) and return the fresh
 *      row.
 *
 * `profiles_set_updated_at` (before update trigger) bumps `updated_at` on every
 * write, so the guard is reliable. No schema change is required.
 *
 * completion is idempotent: completing an already-completed challenge returns
 * `{ status: 'already_completed' }` and never re-awards points/badges.
 */
const { client } = require('./supabaseClient');
const { fromProfile } = require('./tenancyContext');
const profileRepository = require('./profileRepository');

const GAM_COLUMNS = 'id, updated_at, gamification';
const MAX_CONCURRENCY_TRIES = 5;

function tenancyError(msg) {
  const e = new Error(msg);
  e.name = 'TenancyError';
  e.status = 403;
  return e;
}

function readGamification(profile) {
  const g = profile?.gamification;
  return g && typeof g === 'object' && !Array.isArray(g) ? g : {};
}

function normalizeCompleted(gamification) {
  const list = gamification.completedChallenges;
  return Array.isArray(list) ? list.map((c) => String(c)) : [];
}

function normalizeBadges(gamification) {
  return Array.isArray(gamification.badges) ? gamification.badges.slice() : [];
}

/** Build the additive gamification snapshot after completing `challenge`. */
function applyCompletion(gamification, challenge) {
  const next = {
    ...gamification,
    ecoScore: Number(gamification.ecoScore) || 0,
    greenPoints: (Number(gamification.greenPoints) || 0) + (Number(challenge.points) || 0),
    streak: Number(gamification.streak) || 0,
  };
  const badges = normalizeBadges(gamification);
  if (challenge.badge && !badges.includes(challenge.badge)) badges.push(challenge.badge);
  next.badges = badges;
  next.completedChallenges = normalizeCompleted(gamification).concat(String(challenge.id));
  return next;
}

/**
 * Fetch the authenticated actor's gamification (+ profile id + updated_at).
 * @param {object} tenant
 * @returns {Promise<{ profileId: string, gamification: object, updated_at: string|null }>}
 */
async function get(tenant) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  const { data, error } = await client()
    .from('profiles')
    .select(GAM_COLUMNS)
    .eq('id', tenant.profileId)
    .limit(1);
  if (error) throw error;
  const row = data && data.length ? data[0] : null;
  if (!row) throw tenancyError('Authenticated profile not found');
  return { profileId: row.id, gamification: readGamification(row), updated_at: row.updated_at || null };
}

/**
 * Complete a challenge atomically under an optimistic-concurrency guard.
 *
 * @param {object} tenant - authenticated tenant context
 * @param {object} challenge - the PG challenge row being completed
 *   ({ id, points, badge } at minimum)
 * @returns {Promise<{ status: 'completed'|'already_completed', pointsEarned, badge,
 *   gamification: object }>}
 */
async function completeChallenge(tenant, challenge) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  if (!challenge?.id) throw new Error('Challenge id is required to complete');

  for (let attempt = 0; attempt < MAX_CONCURRENCY_TRIES; attempt++) {
    const row = await profileRepository.findById(tenant.profileId);
    if (!row) throw tenancyError('Authenticated profile not found');

    const gamification = readGamification(row);
    const completed = normalizeCompleted(gamification);
    if (completed.includes(String(challenge.id))) {
      return {
        status: 'already_completed',
        pointsEarned: 0,
        badge: null,
        gamification,
      };
    }

    const next = applyCompletion(gamification, challenge);
    const { data, error } = await client()
      .from('profiles')
      .update({ gamification: next })
      .eq('id', tenant.profileId)
      .eq('updated_at', row.updated_at)
      .select(GAM_COLUMNS);
    if (error) throw error;

    if (data && data.length) {
      return {
        status: 'completed',
        pointsEarned: Number(challenge.points) || 0,
        badge: challenge.badge || null,
        gamification: readGamification(data[0]),
      };
    }
    // 0 rows matched -> a concurrent write bumped updated_at; loop re-reads and
    // re-applies the (additive) change against the fresh snapshot.
  }
  throw new Error('Could not complete challenge after concurrent retries');
}

/**
 * Generic concurrency-safe gamification mutation.
 *
 * Reads the actor's `profiles.gamification` + `updated_at`, computes the new
 * gamification via `updater(gamificationSnapshot)`, then applies it with an
 * optimistic-concurrency guard (UPDATE ... WHERE id AND updated_at = snapshot).
 * If another actor commits first (0 rows matched), it re-reads and re-applies —
 * the updater must be ADDITIVE/idempotent so re-applying never drops or double
 * counts a concurrent contribution.
 *
 * @param {object} tenant - authenticated tenant context (requires profileId)
 * @param {(gamification: object) => object|Promise<object>} updater
 *   Receives the current gamification object; returns the NEXT gamification object.
 * @returns {Promise<{ profileId, gamification, updated_at }>}
 */
async function mutate(tenant, updater) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');

  for (let attempt = 0; attempt < MAX_CONCURRENCY_TRIES; attempt++) {
    const row = await profileRepository.findById(tenant.profileId);
    if (!row) throw tenancyError('Authenticated profile not found');

    const gamification = readGamification(row);
    const next = await updater({ ...gamification });

    const { data, error } = await client()
      .from('profiles')
      .update({ gamification: next })
      .eq('id', tenant.profileId)
      .eq('updated_at', row.updated_at)
      .select(GAM_COLUMNS);
    if (error) throw error;

    if (data && data.length) {
      return {
        profileId: data[0].id,
        gamification: readGamification(data[0]),
        updated_at: data[0].updated_at || null,
      };
    }
  }
  throw new Error('Could not update gamification after concurrent retries');
}

/**
 * Platform/leaderboard rank of profiles within the caller's boundary:
 *   * organization member ranks against their organization (student/individual)
 *   * individual (no org) ranks against the platform-wide individual pool
 * Ordered by greenPoints descending (missing -> 0).
 *
 * @param {object} tenant
 * @param {object} [opts] - { limit }
 * @returns {Promise<Array<{ rank, name, ecoScore, greenPoints, streak }>>}
 */
async function leaderboard(tenant, opts = {}) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  const limit = opts.limit || 20;

  let q = client()
    .from('profiles')
    .select('name, gamification')
    .order('gamification->>greenPoints', { ascending: false })
    .limit(limit);

  if (tenant.organizationId) {
    q = q
      .eq('organization_id', tenant.organizationId)
      .in('role', ['student', 'individual']);
  } else {
    q = q.eq('role', 'individual').is('organization_id', null);
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data || []).map((u, i) => {
    const g = readGamification(u);
    return {
      rank: i + 1,
      name: u.name,
      ecoScore: Number(g.ecoScore) || 0,
      greenPoints: Number(g.greenPoints) || 0,
      streak: Number(g.streak) || 0,
    };
  });
}

module.exports = { get, completeChallenge, leaderboard, readGamification, mutate };
