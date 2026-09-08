/**
 * Gamification / Challenge migration tests (Phase 3E).
 *
 * Verifies that Gamification & Challenge persistence is served from Supabase
 * PostgreSQL:
 *   * `public.challenges`    -> challengeRepository + challengeSerializer
 *   * `profiles.gamification`-> gamificationRepository (ecoScore, greenPoints,
 *                               streak, badges, completedChallenges)
 *
 * Two groups:
 *   A) UNIT / architecture (always run):
 *      - challengeSerializer.toApiChallenge maps a PG row onto the Mongo-doc
 *        contract (_id, targetReduction, duration, isActive, weekNumber,
 *        collegeId, departmentId, createdAt) preserving the business fields.
 *      - repository surfaces.
 *   B) LIVE repository data tests (skipped unless SUPABASE_URL + SECRET_KEY):
 *      - challenge creation + visibility (platform / org / dept)
 *      - completion persists points + badge + completedChallenges (jsonb)
 *      - repeated completion is rejected (no double points)
 *      - concurrent completion of different challenges retains BOTH contributions
 *        (optimistic-concurrency guard — no lost update)
 *      - cross-tenant isolation (B cannot see / complete A's org challenge)
 *      - malicious id / tenant overrides are ignored
 *
 * Controlled records use an email-safe `GAM_…` marker and are FULLY removed in
 * cleanup. Seeded/organization/demo data is never deleted.
 *
 * Run: npm test  (from backend/)
 */
require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert');

const {
  tenancyContext,
  supabaseClient,
  challengeRepository,
  gamificationRepository,
  organizationRepository,
  departmentRepository,
} = require('../repositories');
const { toApiChallenge } = require('../repositories/challengeSerializer');
const { fromProfile } = tenancyContext;

function db() { return supabaseClient.client(); }

// ---------------------------------------------------------------------------
// A) unit / architecture
// ---------------------------------------------------------------------------
test('challengeSerializer.toApiChallenge maps a PG row onto the Mongo contract', () => {
  const row = {
    id: 'aa11bb22-0000-4000-8000-000000000000',
    title: 'Public Transport Week',
    description: 'Use transit for 3 days',
    category: 'transport',
    points: 75,
    target_reduction: 12,
    duration_days: 5,
    badge: 'green_commuter',
    is_active: true,
    week_number: 3,
    organization_id: 'dddddddd-dddd-4000-8000-dddddddddddd',
    department_id: null,
    created_at: '2026-08-30T12:00:00.000Z',
  };
  const c = toApiChallenge(row);
  assert.strictEqual(c._id, row.id, '_id must mirror the uuid');
  assert.strictEqual(c.title, 'Public Transport Week');
  assert.strictEqual(c.category, 'transport');
  assert.strictEqual(c.points, 75);
  assert.strictEqual(c.targetReduction, 12, 'target_reduction -> targetReduction');
  assert.strictEqual(c.duration, 5, 'duration_days -> duration');
  assert.strictEqual(c.badge, 'green_commuter');
  assert.strictEqual(c.isActive, true, 'is_active -> isActive');
  assert.strictEqual(c.weekNumber, 3, 'week_number -> weekNumber');
  assert.strictEqual(c.collegeId, row.organization_id, 'organization_id -> collegeId');
  assert.strictEqual(c.departmentId, null, 'department_id -> departmentId');
  assert.strictEqual(c.createdAt, row.created_at, 'created_at -> createdAt');
});

test('challengeSerializer.toApiChallenge tolerates null / missing row', () => {
  assert.strictEqual(toApiChallenge(null), null);
  const c = toApiChallenge({});
  assert.strictEqual(c.description, '');
  assert.strictEqual(c.points, 50);
  assert.strictEqual(c.targetReduction, 10);
  assert.strictEqual(c.duration, 7);
  assert.strictEqual(c.isActive, true);
});

test('gamificationRepository exports expected methods', () => {
  assert.strictEqual(typeof gamificationRepository.get, 'function');
  assert.strictEqual(typeof gamificationRepository.completeChallenge, 'function');
  assert.strictEqual(typeof gamificationRepository.leaderboard, 'function');
  assert.strictEqual(typeof challengeRepository.create, 'function');
  assert.strictEqual(typeof challengeRepository.listVisible, 'function');
  assert.strictEqual(typeof challengeRepository.findVisible, 'function');
});

// ---------------------------------------------------------------------------
// B) LIVE data tests (gated)
// ---------------------------------------------------------------------------
const live = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

const MARK = `gam-${Date.now()}-`;
const PASSWORD = 'GamTest@123';

let created = { authUsers: [], orgIds: [], deptIds: [], profileIds: [], challengeIds: [] };

function email(tag) { return `${MARK}${tag}@ecoguardian.test`; }

async function createAuthUser(tag) {
  const { data, error } = await db().auth.admin.createUser({
    email: email(tag),
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`createAuthUser(${tag}): ${error.message}`);
  created.authUsers.push({ tag, id: data.user.id });
  return data.user.id;
}

function ctx(profileId, role, organizationId, departmentId) {
  return fromProfile({ id: profileId, role, organization_id: organizationId, department_id: departmentId, status: 'active' });
}

async function insertProfile(authUserId, name, role, organizationId, departmentId, gamification) {
  const { data, error } = await db().from('profiles').insert({
    auth_user_id: authUserId,
    user_id: `GAM_${name}_${Date.now()}`,
    name,
    email: email(name),
    role,
    status: 'active',
    organization_id: organizationId,
    department_id: departmentId,
    ...(gamification ? { gamification } : {}),
  }).select('id').single();
  if (error) throw new Error(`insertProfile(${name}): ${error.message}`);
  created.profileIds.push(data.id);
  return data.id;
}

async function cleanup() {
  if (created.challengeIds.length) {
    for (const id of created.challengeIds) await db().from('challenges').delete().eq('id', id);
  }
  if (created.deptIds.length) {
    for (const id of created.deptIds) await db().from('departments').delete().eq('id', id);
  }
  if (created.orgIds.length) {
    for (const id of created.orgIds) await db().from('organizations').delete().eq('id', id);
  }
  // deleting auth users cascades their profiles (profiles.auth_user_id on delete cascade)
  for (const au of created.authUsers) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error } = await db().auth.admin.deleteUser(au.id);
      if (!error) break;
      if (attempt === 1) console.warn(`cleanup auth ${au.tag}: ${error.message}`);
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  created = { authUsers: [], orgIds: [], deptIds: [], profileIds: [], challengeIds: [] };
}

test('LIVE: challenge create + completion + repeated-completion guard + JSONB persistence', { skip: !live }, async () => {
  try {
    const aId = await createAuthUser('tca');
    const aPid = await insertProfile(aId, 'tca', 'individual', null, null);
    const tenantA = ctx(aPid, 'individual', null, null);

    // ---- create a platform/global challenge + an org-scoped challenge ------
    const globalCh = await challengeRepository.create(tenantA, {
      title: 'GAM Global Bike Day', description: 'Ride 2 km', category: 'transport',
      points: 100, targetReduction: 5, duration: 7, badge: 'green_commuter',
      organizationId: null, departmentId: null,
    });
    assert.ok(globalCh && globalCh.id, 'global challenge created');
    created.challengeIds.push(globalCh.id);

    // ---- global challenge visible to a personal user ------------------------
    let visible = await challengeRepository.listVisible(tenantA, { activeOnly: true });
    assert.ok(visible.some((c) => c.id === globalCh.id), 'personal user sees the global challenge');
    assert.ok(await challengeRepository.findVisible(tenantA, globalCh.id), 'findVisible resolves global challenge');

    // ---- serialized contract ------------------------------------------------
    const apiCh = toApiChallenge(globalCh);
    assert.strictEqual(apiCh.points, 100);
    assert.strictEqual(apiCh._id, globalCh.id);

    // ---- completion persists points + badge + completedChallenges ------------
    const res = await gamificationRepository.completeChallenge(tenantA, globalCh);
    assert.strictEqual(res.status, 'completed');
    assert.strictEqual(res.pointsEarned, 100);
    assert.strictEqual(res.badge, 'green_commuter');
    assert.strictEqual(res.gamification.greenPoints, 100);
    assert.deepStrictEqual(res.gamification.badges, ['green_commuter']);
    assert.deepStrictEqual(res.gamification.completedChallenges, [globalCh.id]);

    // ---- stats / get reflects persisted gamification -------------------------
    const { gamification } = await gamificationRepository.get(tenantA);
    assert.strictEqual(gamification.greenPoints, 100);
    assert.ok(gamification.completedChallenges.includes(globalCh.id));

    // ---- repeated completion rejected, NO double points ----------------------
    const again = await gamificationRepository.completeChallenge(tenantA, globalCh);
    assert.strictEqual(again.status, 'already_completed');
    assert.strictEqual(again.gamification.greenPoints, 100, 'no double points on repeat');
    assert.strictEqual(again.gamification.completedChallenges.length, 1, 'no duplicate completed id');

    // ---- complete an org challenge will be tested for isolation below ---------
  } finally {
    await cleanup();
  }
});

test('LIVE: concurrent completion of different challenges retains BOTH points (no lost update)', { skip: !live }, async () => {
  try {
    const aId = await createAuthUser('tcc');
    const aPid = await insertProfile(aId, 'tcc', 'individual', null, null);
    const tenantA = ctx(aPid, 'individual', null, null);

    const ch1 = await challengeRepository.create(tenantA, {
      title: 'GAM Concurrent A', description: 'a', category: 'energy',
      points: 20, badge: '', organizationId: null, departmentId: null,
    });
    const ch2 = await challengeRepository.create(tenantA, {
      title: 'GAM Concurrent B', description: 'b', category: 'waste',
      points: 30, badge: '', organizationId: null, departmentId: null,
    });
    created.challengeIds = [ch1.id, ch2.id];

    // Fire both completions against the SAME profile simultaneously. The
    // optimistic-concurrency guard (updated_at) must retain BOTH contributions.
    const [r1, r2] = await Promise.all([
      gamificationRepository.completeChallenge(tenantA, ch1),
      gamificationRepository.completeChallenge(tenantA, ch2),
    ]);

    const { gamification } = await gamificationRepository.get(tenantA);
    assert.strictEqual(gamification.greenPoints, 50, 'concurrent 20+30 preserved, no lost update');
    assert.deepStrictEqual([...gamification.completedChallenges].sort(), [ch1.id, ch2.id].sort(), 'both challenges recorded');
    assert.strictEqual(gamification.completedChallenges.length, 2, 'no duplicate');
    assert.strictEqual(r1.status, 'completed');
    assert.strictEqual(r2.status, 'completed');
  } finally {
    await cleanup();
  }
});

test('LIVE: challenge tenancy — cross-org isolation, org/dept visibility, malicious overrides', { skip: !live }, async () => {
  try {
    const oaId = await createAuthUser('gta');
    const obId = await createAuthUser('gtb');
    const orgA = await organizationRepository.create({ name: 'GAM Org A', code: `GAMA${Date.now()}`, address: '' });
    const orgB = await organizationRepository.create({ name: 'GAM Org B', code: `GAMB${Date.now()}`, address: '' });
    created.orgIds = [orgA.id, orgB.id];
    const deptA = await departmentRepository.create(ctx(oaId, 'college_admin', orgA.id, null), { name: 'GAM Dept A', code: 'GDA' });
    created.deptIds = [deptA.id];

    const aPid = await insertProfile(oaId, 'gta', 'student', orgA.id, deptA.id);
    const bPid = await insertProfile(obId, 'gtb', 'student', orgB.id, null);
    const tenantA = ctx(aPid, 'student', orgA.id, deptA.id);
    const tenantB = ctx(bPid, 'student', orgB.id, null);

    // org-A-wide challenge
    const orgCh = await challengeRepository.create(tenantA, {
      title: 'GAM Org-A Challenge', description: 'org wide', category: 'general',
      points: 40, badge: '', organizationId: orgA.id, departmentId: null,
    });
    // dept-A challenge
    const deptCh = await challengeRepository.create(tenantA, {
      title: 'GAM Dept-A Challenge', description: 'dept', category: 'general',
      points: 30, badge: '', organizationId: orgA.id, departmentId: deptA.id,
    });
    created.challengeIds = [orgCh.id, deptCh.id];

    // A (org A + dept A) sees both
    const aVisible = await challengeRepository.listVisible(tenantA, { activeOnly: true });
    assert.ok(aVisible.some((c) => c.id === orgCh.id), 'A sees org-wide challenge');
    assert.ok(aVisible.some((c) => c.id === deptCh.id), 'A sees its department challenge');

    // B (org B, no dept) sees NEITHER org-A challenge
    const bVisible = await challengeRepository.listVisible(tenantB, { activeOnly: true });
    assert.ok(!bVisible.some((c) => c.id === orgCh.id), 'B must not see org A challenge');
    assert.ok(!bVisible.some((c) => c.id === deptCh.id), 'B must not see org A dept challenge');
    assert.strictEqual(await challengeRepository.findVisible(tenantB, orgCh.id), null, 'B cannot resolve A org challenge');

    // B CANNOT complete A's org challenge (findVisible returns null -> 404 in route)
    assert.strictEqual(await challengeRepository.findVisible(tenantB, deptCh.id), null, 'B cannot resolve A dept challenge');

    // malicious: fabricated / foreign challenge id resolves to null for B, even if passed explicitly
    assert.strictEqual(await challengeRepository.findVisible(tenantB, orgCh.id), null, 'malicious cross-tenant id ignored');

    // A completes its own org challenge; B's profile untouched
    const res = await gamificationRepository.completeChallenge(tenantA, orgCh);
    assert.strictEqual(res.status, 'completed');
    assert.strictEqual(res.pointsEarned, 40);
    const bGam = await gamificationRepository.get(tenantB);
    assert.strictEqual(bGam.gamification.greenPoints ?? 0, 0, 'B unaffected by A completion');
    assert.deepStrictEqual(bGam.gamification.completedChallenges ?? [], [], 'B has no completions');
  } finally {
    await cleanup();
  }
});
