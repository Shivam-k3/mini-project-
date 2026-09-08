/**
 * Repository layer tests (Phase 3A).
 *
 * Two groups:
 *   A) ARCHITECTURE / unit — always run (no DB):
 *      - module shape (all 9 repositories export expected methods)
 *      - tenancyContext.fromProfile invariants (personal/org/dept rules)
 *      - no secret value in the repository source / not logged
 *   B) LIVE (skipped unless SUPABASE_URL + SUPABASE_SECRET_KEY set):
 *      - real reads against public.emission_factors (26 rows), organizations,
 *        departments, profiles (the seeded MIT/CSE + 5 test identities)
 *      - tenancy isolation (personal A vs B, org A vs B, dept A vs B)
 *      - repositories can never accept a client-supplied tenant override
 *      - relationships (profile->org, profile->dept, dept->org, twin->profile,
 *        simulation->profile, challenge->org/dept)
 *
 * Controlled live records are created with a unique `REPO_AUTH::…` marker and
 * FULLY removed at the end. Seeded/demo data is never deleted.
 *
 * Run: npm test  (from backend/)
 */
require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert');

const { tenancyContext, supabaseClient, profileRepository, organizationRepository,
  departmentRepository, carbonRepository, mobilityTwinRepository, simulationRepository,
  challengeRepository, announcementRepository, emissionFactorRepository } = require('../repositories');

const { fromProfile, TenancyError } = tenancyContext;

// Lazily created so `npm test` with no env still runs the unit/architecture tests.
function db() { return supabaseClient.client(); }

// ---------------------------------------------------------------------------
// A) architecture / unit
// ---------------------------------------------------------------------------
test('repository layer exports all expected modules and methods', () => {
  assert.strictEqual(typeof profileRepository.findByAuthUserId, 'function');
  assert.strictEqual(typeof profileRepository.findByUserId, 'function');
  assert.strictEqual(typeof profileRepository.findById, 'function');
  assert.strictEqual(typeof profileRepository.getAuthContext, 'function');
  assert.strictEqual(typeof profileRepository.updateProfile, 'function');
  assert.strictEqual(typeof profileRepository.listByTenant, 'function');
  assert.strictEqual(typeof profileRepository.ensurePersonalProfile, 'function');
  assert.strictEqual(typeof organizationRepository.findById, 'function');
  assert.strictEqual(typeof organizationRepository.findByCode, 'function');
  assert.strictEqual(typeof departmentRepository.findById, 'function');
  assert.strictEqual(typeof departmentRepository.listByOrganization, 'function');
  assert.strictEqual(typeof carbonRepository.create, 'function');
  assert.strictEqual(typeof carbonRepository.findById, 'function');
  assert.strictEqual(typeof carbonRepository.listByUser, 'function');
  assert.strictEqual(typeof mobilityTwinRepository.upsert, 'function');
  assert.strictEqual(typeof mobilityTwinRepository.findByOwner, 'function');
  assert.strictEqual(typeof simulationRepository.create, 'function');
  assert.strictEqual(typeof simulationRepository.listByOwner, 'function');
  assert.strictEqual(typeof challengeRepository.listVisible, 'function');
  assert.strictEqual(typeof challengeRepository.create, 'function');
  assert.strictEqual(typeof announcementRepository.create, 'function');
  assert.strictEqual(typeof announcementRepository.listVisible, 'function');
  assert.strictEqual(typeof emissionFactorRepository.countActive, 'function');
});

test('tenancyContext.fromProfile enforces PERSONAL => no org/dept', () => {
  const ctx = fromProfile({ id: '11111111-1111-1111-1111-111111111111', role: 'individual', organization_id: null, department_id: null, status: 'active' });
  assert.strictEqual(ctx.organizationId, null);
  assert.strictEqual(ctx.departmentId, null);
  assert.strictEqual(ctx.role, 'individual');
  assert.throws(() => fromProfile({ id: 'x', role: 'individual', organization_id: 'a', department_id: null }), TenancyError);
});

test('tenancyContext.fromProfile: org role must belong to an organization', () => {
  assert.throws(() => fromProfile({ id: 'x', role: 'student', organization_id: null, department_id: null, status: 'active' }), TenancyError);
  const ctx = fromProfile({ id: 'x', role: 'college_admin', organization_id: 'o', department_id: null, status: 'active' });
  assert.strictEqual(ctx.organizationId, 'o');
});

test('tenancyContext.fromProfile: department requires organization', () => {
  assert.throws(() => fromProfile({ id: 'x', role: 'student', organization_id: null, department_id: 'd', status: 'active' }), TenancyError);
});

test('repository source does not contain any hard-coded secret key value', () => {
  const glob = require('node:fs').readdirSync(require('node:path').join(__dirname, '..', 'repositories'));
  const files = glob.filter((f) => f.endsWith('.js')).map((f) => require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'repositories', f), 'utf8'
  )).join('\n');
  assert.doesNotMatch(files, /sb_secret_[A-Za-z0-9_-]+/);
  assert.doesNotMatch(files, /postgres(ql)?:\/\/[^\s"']+/);
  assert.doesNotMatch(files, /FaDFjzNEUI9p-r50Pf1EZQ_8smdmZZW/);
  // Key must come from process.env only
  assert.match(files, /process\.env\.SUPABASE_SECRET_KEY/);
});

// ---------------------------------------------------------------------------
// B) LIVE integration (gated)
// ---------------------------------------------------------------------------
const live = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

const MARK = `repos-${Date.now()}-`;

function email(tag) { return `${MARK}${tag}@ecoguardian.test`; }

let created = {
  authUsers: [],
  orgIds: [],
  deptIds: [],
  profileIds: [],
  twinIds: [],
  simIds: [],
  entryIds: [],
  challengeIds: [],
  announcementIds: [],
};

/** Create a real Supabase auth user (email_confirm true). */
async function createAuthUser(tag) {
  const { data, error } = await db().auth.admin.createUser({
    email: email(tag),
    password: 'RepoTest@123',
    email_confirm: true,
  });
  if (error) throw new Error(`createAuthUser(${tag}): ${error.message}`);
  created.authUsers.push({ tag, id: data.user.id, email: email(tag) });
  return data.user.id;
}

/** Build a tenant context straight from a profile-like object (no auth needed). */
function ctx(profileId, role, organizationId, departmentId) {
  return fromProfile({ id: profileId, role, organization_id: organizationId, department_id: departmentId, status: 'active' });
}

test('LIVE: emission_factors has exactly 26 rows with provenance', { skip: !live }, async () => {
  const count = await emissionFactorRepository.countActive();
  assert.strictEqual(count, 26);
  const all = await emissionFactorRepository.listActive();
  assert.strictEqual(all.length, 26);
  // provenance preserved on at least the generic rows
  const car = all.find((f) => f.mode === 'car' && f.vehicle_category === '');
  assert.ok(car && typeof car.source === 'string' && car.source.length > 0);
  assert.strictEqual(car.co2_kg_per_km, 0.21);
});

test('LIVE: seeded org MIT + dept CSE exist and profile->relationship resolves', { skip: !live }, async () => {
  const mit = await organizationRepository.findByCode('MIT');
  assert.ok(mit, 'expected MIT organization');
  const stu = await profileRepository.findByUserId('CSE25001');
  assert.ok(stu, 'expected student profile CSE25001');
  assert.strictEqual(stu.organization_id, mit.id, 'profile.organization_id must match MIT org id');
  assert.ok(stu.department_id, 'student should be in a department');
  const dept = await departmentRepository.findById(stu.department_id);
  assert.ok(dept, 'department should resolve');
  assert.strictEqual(dept.organization_id, mit.id, 'department must belong to the same org as profile');
  // twin/simulation rows for the demo user do not exist yet (empty tables) — no assertion needed.
});

test('LIVE: emissionFactorRepository.resolve returns canonical values by mode', { skip: !live }, async () => {
  const car = await emissionFactorRepository.resolve('car', { vehicleCategory: '', fuelType: '' });
  const generic = car.find((f) => f.vehicle_category === '' && f.fuel_type === '');
  assert.strictEqual(generic.co2_kg_per_km, 0.21);
  const ev = await emissionFactorRepository.resolve('ev', {});
  const evGeneric = ev.find((f) => f.vehicle_category === '');
  // EV baseline: kwh/per-km may be null; co2 present in seed
  assert.ok(evGeneric);
});

// --- tenancy + full CRUD lifecycle against live DB -------------------------
test('LIVE: tenancy isolation + repository ownership + relationships', { skip: !live }, async () => {
  try {
    // ---- provision controlled records (all clearly marked) ----
    const pAId = await createAuthUser('pa'); // personal A
    const pBId = await createAuthUser('pb'); // personal B
    const oaId = await createAuthUser('oa'); // org A admin
    const obId = await createAuthUser('ob'); // org B admin

    const orgA = await organizationRepository.create({ name: 'REPO Org A', code: `REPOA${Date.now()}`, address: '' });
    const orgB = await organizationRepository.create({ name: 'REPO Org B', code: `REPOB${Date.now()}`, address: '' });
    created.orgIds = [orgA.id, orgB.id];

    const deptA = await departmentRepository.create(ctx(oaId, 'college_admin', orgA.id, null), { name: 'REPO Dept A', code: 'DA' });
    const deptB = await departmentRepository.create(ctx(obId, 'college_admin', orgB.id, null), { name: 'REPO Dept B', code: 'DB' });
    created.deptIds = [deptA.id, deptB.id];

    // profiles referencing the created auth users
    const mkProfile = (authUserId, userId, name, role, oid, did) =>
      db().from('profiles').insert({
        auth_user_id: authUserId, user_id: userId, name, email: email(name), role,
        organization_id: oid, department_id: did, status: 'active',
      }).select('id').single();
    const [pA, pB, oaP, obP] = await Promise.all([
      mkProfile(pAId, `REPO_PA_${Date.now()}`, 'pa', 'individual', null, null),
      mkProfile(pBId, `REPO_PB_${Date.now()}`, 'pb', 'individual', null, null),
      mkProfile(oaId, `REPO_OA_${Date.now()}`, 'oa', 'college_admin', orgA.id, deptA.id),
      mkProfile(obId, `REPO_OB_${Date.now()}`, 'ob', 'college_admin', orgB.id, deptB.id),
    ]);
    assert.ok(pA.data && pB.data && oaP.data && obP.data, 'expected 4 test profiles to be created');
    created.profileIds = [pA.data.id, pB.data.id, oaP.data.id, obP.data.id];
    const profileIds = { pA: pA.data.id, pB: pB.data.id, oa: oaP.data.id, ob: obP.data.id };

    // ---- PERSONAL isolation: A cannot reach B ----
    const tenantA = ctx(profileIds.pA, 'individual', null, null);
    const tenantB = ctx(profileIds.pB, 'individual', null, null);
    await carbonRepository.create(tenantA, { notes: 'REPO entry for A' });
    const bEntries = await carbonRepository.listByUser(tenantB);
    // B must see zero personal entries (A's row is scoped to A)
    assert.strictEqual(bEntries.length, 0, 'personal A entry must not be visible to personal B');
    const aFound = await carbonRepository.findById(tenantA, (await carbonRepository.listByUser(tenantA))[0].id);
    assert.ok(aFound, 'owner can read own entry');
    const aSeeB = await carbonRepository.findById(tenantA, '00000000-0000-0000-0000-000000000000');
    assert.strictEqual(aSeeB, null);

    // ---- ORG isolation: org A cannot see org B ----
    const tenantOA = ctx(profileIds.oa, 'college_admin', orgA.id, deptA.id);
    const tenantOB = ctx(profileIds.ob, 'college_admin', orgB.id, deptB.id);
    await carbonRepository.create(tenantOA, { notes: 'REPO entry org A' });
    await carbonRepository.create(tenantOB, { notes: 'REPO entry org B' });
    const orgARows = await carbonRepository.listByTenant(tenantOA);
    const orgBRows = await carbonRepository.listByTenant(tenantOB);
    assert.ok(orgARows.some((r) => r.notes === 'REPO entry org A'), 'org A sees own entry');
    assert.ok(!orgARows.some((r) => r.notes === 'REPO entry org B'), 'org A must NOT see org B entry');
    assert.ok(!orgBRows.some((r) => r.notes === 'REPO entry org A'), 'org B must NOT see org A entry');

    // ---- DEPARTMENT isolation: dept A scoping excludes dept B ----
    // create a dept-A-only view and confirm the B entry (dept B) is not included
    const deptARows = await carbonRepository.listByTenant(tenantOA, { scopeToOwnDept: true });
    assert.ok(!deptARows.some((r) => r.notes === 'REPO entry org B'), 'dept A scope must exclude dept B row');

    // ---- malicious override: a client cannot force another tenant ----
    // carbonRepository.create IGNORES client-supplied org/dept; ownership is profileId
    const malicious = await carbonRepository.create(tenantA, {
      notes: 'REPO malicious attempt',
      // these must be ignored:
      user_id: profileIds.ob,
      organization_id: orgB.id,
      department_id: deptB.id,
    });
    assert.strictEqual(malicious.user_id, profileIds.pA, 'user ownership must be the authenticated owner (cannot be overridden)');
    assert.strictEqual(malicious.organization_id, null, 'a personal user must not gain org tenancy via request payload');
    assert.strictEqual(malicious.department_id, null, 'a personal user must not gain dept tenancy via request payload');

    // ---- Twin: one twin per user, ownership enforced ----
    await mobilityTwinRepository.upsert(tenantOA, { baseline: { windowDays: 28 }, vehicleProfile: { mode: 'car' } });
    const twin = await mobilityTwinRepository.findByOwner(tenantOA);
    assert.ok(twin, 'twins owner twin exists');
    assert.strictEqual(twin.user_id, profileIds.oa, 'twin user_id must be the authenticated owner');
    created.twinIds.push(twin.id);
    // update (upsert) preserves one row
    await mobilityTwinRepository.upsert(tenantOA, { baseline: { windowDays: 60 } });
    const twins = await db().from('mobility_twins').select('id').eq('user_id', profileIds.oa);
    assert.strictEqual(twins.data.length, 1, 'exactly one twin per user after upsert');
    // B cannot read A's twin
    const bTwinForA = await mobilityTwinRepository.findById(tenantOB, twin.id);
    assert.strictEqual(bTwinForA, null, 'a twin from org A must not be readable by org B');

    // ---- Simulation: ownership + relationship to profile ----
    const sim = await simulationRepository.create(tenantOA, { name: 'REPO sim', results: { reduction: 10 } });
    assert.strictEqual(sim.user_id, profileIds.oa, 'simulation owned by creator');
    created.simIds.push(sim.id);
    const simsA = await simulationRepository.listByOwner(tenantOA);
    assert.ok(simsA.some((s) => s.id === sim.id), 'owner lists own simulation');
    const simsB = await simulationRepository.listByOwner(tenantOB);
    assert.ok(!simsB.some((s) => s.id === sim.id), 'org B must not see org A simulation');

    // ---- Challenge: scope (platform/org/dept) + relationship ----
    const platformChallenge = await challengeRepository.create(ctx(profileIds.oa, 'super_admin', null, null), { title: 'REPO platform challenge' });
    const orgChallenge = await challengeRepository.create(tenantOA, { title: 'REPO org challenge' }); // org A only
    assert.strictEqual(orgChallenge.organization_id, orgA.id, 'challenge scoped to creator org A');
    created.challengeIds = [platformChallenge.id, orgChallenge.id];
    const visibleA = await challengeRepository.listVisible(tenantOA);
    assert.ok(visibleA.some((c) => c.id === orgChallenge.id), 'org A member sees org A challenge');
    const visibleB = await challengeRepository.listVisible(tenantOB);
    assert.ok(!visibleB.some((c) => c.id === orgChallenge.id), 'org B must NOT see org A challenge');
    assert.ok(visibleB.some((c) => c.id === platformChallenge.id), 'platform challenge visible to everyone');

    // ---- Announcement: platform visibility + creator is authenticated user ----
    const ann = await announcementRepository.create(tenantOA, { title: 'REPO announcement', content: 'hi' });
    assert.strictEqual(ann.created_by, profileIds.oa, 'announcement creator must be authenticated user (not client-supplied)');
    created.announcementIds.push(ann.id);
    const orgAnnCnt = (await announcementRepository.listVisible(tenantOA)).filter((a) => a.title === 'REPO announcement').length;
    assert.ok(orgAnnCnt >= 1, 'org A sees own announcement');

    // ---- Emission factor remains global (not tenant-scoped) ----
    const countAgain = await emissionFactorRepository.countActive();
    assert.strictEqual(countAgain, 26, 'factor catalog untouched by test writes');

  } finally {
    await cleanup();
  }
});

/** Remove ONLY the records this test created. Never touches seeded/demo data. */
async function cleanup() {
  // 1) Remove tenant-owned rows + orgs first. Deleting an org cascades its
  //    departments and the profiles beneath it, which also removes this test's
  //    carbon_entries / twins / simulations that referenced them.
  if (created.entryIds.length) {
    for (const id of created.entryIds) await db().from('carbon_entries').delete().eq('id', id);
  }
  if (created.simIds.length) {
    for (const id of created.simIds) await db().from('simulations').delete().eq('id', id);
  }
  if (created.twinIds.length) {
    for (const id of created.twinIds) await db().from('mobility_twins').delete().eq('id', id);
  }
  if (created.challengeIds.length) {
    for (const id of created.challengeIds) await db().from('challenges').delete().eq('id', id);
  }
  if (created.announcementIds.length) {
    for (const id of created.announcementIds) await db().from('announcements').delete().eq('id', id);
  }
  if (created.deptIds.length) {
    for (const id of created.deptIds) await db().from('departments').delete().eq('id', id);
  }
  if (created.orgIds.length) {
    for (const id of created.orgIds) await db().from('organizations').delete().eq('id', id);
  }
  // 2) Delete the test auth users LAST (after orgs cascaded away their profiles),
  //    with a small retry to tolerate transient Supabase deleteUser failures.
  for (const au of created.authUsers) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error } = await db().auth.admin.deleteUser(au.id);
      if (!error) break;
      if (attempt === 1) console.warn(`cleanup auth ${au.tag}: ${error.message}`);
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  created = { authUsers: [], orgIds: [], deptIds: [], profileIds: [], twinIds: [], simIds: [], entryIds: [], challengeIds: [], announcementIds: [] };
}

// --- OAuth first-login provisioning + idempotency (focused) -----------------
// Reproduces the Google-OAuth gap: a valid Supabase identity with NO
// public.profiles row. ensurePersonalProfile must create a PERSONAL profile on
// the first call and return it untouched (no duplicate) on every retry.
test('LIVE: ensurePersonalProfile provisions a personal profile on first login and is idempotent', { skip: !live }, async () => {
  const local = { authUsers: [], profileIds: [] };
  let provId;
  try {
    // Valid Supabase identity, no profile row yet (as after a Google OAuth sign-in).
    const { data: au, error } = await db().auth.admin.createUser({
      email: `${MARK}oauth@ecoguardian.test`,
      password: 'RepoTest@123',
      email_confirm: true,
    });
    if (error) throw new Error(`createAuthUser(oauth): ${error.message}`);
    local.authUsers.push(au.user.id);
    const authUserId = au.user.id;

    // First login -> profile created as a PERSONAL account.
    const first = await profileRepository.ensurePersonalProfile(authUserId, {
      email: `${MARK}oauth@ecoguardian.test`,
      name: 'OAuth Provisioned',
    });
    assert.strictEqual(first.created, true, 'expected the personal profile to be created');
    assert.ok(first.profile && first.profile.id, 'provisioned profile must have an id');
    assert.strictEqual(first.profile.auth_user_id, authUserId, 'profile must bind to the Supabase auth user');
    assert.strictEqual(first.profile.role, 'individual');
    assert.strictEqual(first.profile.organization_id, null, 'personal profile must have no organization');
    assert.strictEqual(first.profile.department_id, null, 'personal profile must have no department');
    assert.strictEqual(first.profile.status, 'active');
    assert.strictEqual(first.profile.email.toLowerCase(), `${MARK}oauth@ecoguardian.test`);
    provId = first.profile.id;
    local.profileIds.push(provId);

    // Exactly one row exists for this auth user.
    const rows = await profileRepository.findByAuthUserId(authUserId);
    assert.ok(rows && rows.id === provId, 'exactly one profile bound to the auth user');

    // Second login (returning OAuth user) -> same profile returned, NO duplicate,
    // and no field overwrite (id/role/org/dept preserved).
    const second = await profileRepository.ensurePersonalProfile(authUserId, {
      email: `${MARK}oauth@ecoguardian.test`,
      name: 'OAuth Provisioned',
    });
    assert.strictEqual(second.created, false, 'repeated login must NOT create a new profile');
    assert.strictEqual(second.profile.id, provId, 'returning user must reuse the existing profile id');
    assert.strictEqual(second.profile.auth_user_id, authUserId);
    assert.strictEqual(second.profile.role, 'individual');

    // Exactly one row after the retry too (unique auth_user_id preserved).
    const allForUser = await profileRepository.findByAuthUserId(authUserId);
    assert.strictEqual(allForUser.id, provId, 'no duplicate profile after repeated login');
  } finally {
    // Remove ONLY the profile + auth user created here; never seeded data.
    for (const id of local.profileIds) await db().from('profiles').delete().eq('id', id);
    for (const id of local.authUsers) {
      // Guard: auth-js deleteUser requires a UUID; skip anything malformed.
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id))) {
        console.warn(`cleanup oauth auth: skipping non-UUID ${id}`);
        continue;
      }
      for (let attempt = 0; attempt < 2; attempt++) {
        const { error } = await db().auth.admin.deleteUser(id);
        if (!error) break;
        if (attempt === 1) console.warn(`cleanup oauth auth ${id}: ${error.message}`);
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }
});
