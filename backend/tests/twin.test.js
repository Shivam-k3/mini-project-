/**
 * Mobility Twin migration tests (Phase 3C).
 *
 * Verifies that the Mobility Twin data layer is served from Supabase
 * PostgreSQL (`public.mobility_twins`) via `mobilityTwinRepository` +
 * `twinSerializer`, preserving the API contract and one-twin-per-user.
 *
 * Two groups:
 *   A) UNIT / architecture (always run):
 *      - twinSerializer.toApiTwin maps a PG row onto the frontend contract
 *        (_id, baseline, vehicleProfile, scenarios, modelMetadata, derivedAt).
 *      - withScenarioId assigns a unique `_id` to saved scenarios (the
 *        frontend keys scenario lists by `s._id`, and DELETE uses it).
 *      - repository surface.
 *   B) LIVE repository data tests (skipped unless SUPABASE_URL + SECRET_KEY):
 *      - one twin per user (repeated upsert never duplicates)
 *      - first creation + update existing (merge preserves non-target fields)
 *      - re-derive-style upsert preserves saved scenarios
 *      - CRUD (findByOwner / findById / remove)
 *      - ownership: A cannot read/update/delete B's twin
 *      - malicious user_id / org / dept overrides are ignored
 *      - tenancy isolation
 *
 * Controlled records use an email-safe `TWIN_…` marker and are FULLY removed
 * in cleanup. Seeded/organization/demo data is never deleted.
 *
 * Run: npm test  (from backend/)
 */
require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert');

const { tenancyContext, supabaseClient, mobilityTwinRepository, organizationRepository, departmentRepository } = require('../repositories');
const { toApiTwin, withScenarioId } = require('../repositories/twinSerializer');
const { fromProfile } = tenancyContext;

function db() { return supabaseClient.client(); }

// ---------------------------------------------------------------------------
// A) unit / architecture
// ---------------------------------------------------------------------------
test('twinSerializer.toApiTwin maps a PG row onto the frontend contract', () => {
  const row = {
    id: 'aaaabbbb-0000-4000-8000-000000000000',
    user_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    baseline: { windowDays: 28, entryCount: 2, dailyPersonalKg: 1.5, modeBreakdown: { car: 1.5 }, dataQuality: 'sparse' },
    vehicle_profile: { mode: 'car', model: 'Alto', fuelType: 'petrol', co2GPerKm: 210 },
    scenarios: [{ _id: 'scn-1', name: 'Switch to metro', changes: { replaceMode: 'car' }, result: { reductionKg: 0.5 } }],
    model_metadata: { scope: 'user', scopeId: 'x', modelVersion: '3.0.0', predictionMethod: 'fallback_average' },
    derived_at: '2026-08-30T12:00:00.000Z',
    created_at: '2026-08-30T12:00:00.000Z',
    updated_at: '2026-08-30T12:00:00.000Z',
  };
  const twin = toApiTwin(row);
  assert.strictEqual(twin._id, row.id, '_id must mirror the uuid');
  assert.strictEqual(twin.user, row.user_id);
  assert.deepStrictEqual(twin.baseline, row.baseline);
  assert.deepStrictEqual(twin.vehicleProfile, row.vehicle_profile, 'vehicle_profile -> vehicleProfile');
  assert.deepStrictEqual(twin.modelMetadata, row.model_metadata, 'model_metadata -> modelMetadata');
  assert.strictEqual(twin.derivedAt, row.derived_at, 'derived_at -> derivedAt');
  assert.strictEqual(twin.scenarios.length, 1);
  assert.strictEqual(twin.scenarios[0]._id, 'scn-1', 'scenario _id preserved');
});

test('twinSerializer handles null / empty row', () => {
  assert.strictEqual(toApiTwin(null), null);
  const t = toApiTwin({});
  assert.strictEqual(t._id, undefined);
  assert.deepStrictEqual(t.baseline, {});
  assert.deepStrictEqual(t.vehicleProfile, {});
  assert.deepStrictEqual(t.scenarios, []);
});

test('withScenarioId assigns a unique _id and keeps an existing one', () => {
  const a = withScenarioId({ name: 'x', result: {} });
  const b = withScenarioId({ name: 'y', result: {} });
  assert.ok(a._id && b._id, 'scenarios get an _id');
  assert.notStrictEqual(a._id, b._id, 'two scenarios get distinct ids');
  assert.strictEqual(withScenarioId({ _id: 'keep-me', name: 'z' })._id, 'keep-me', 'existing _id is preserved');
});

test('mobilityTwinRepository exports expected methods', () => {
  assert.strictEqual(typeof mobilityTwinRepository.findByOwner, 'function');
  assert.strictEqual(typeof mobilityTwinRepository.findById, 'function');
  assert.strictEqual(typeof mobilityTwinRepository.upsert, 'function');
  assert.strictEqual(typeof mobilityTwinRepository.remove, 'function');
});

// ---------------------------------------------------------------------------
// B) LIVE data tests (gated)
// ---------------------------------------------------------------------------
const live = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

const MARK = `twin-${Date.now()}-`;
const PASSWORD = 'TwinTest@123';

let created = { authUsers: [], orgIds: [], deptIds: [], profileIds: [], twinIds: [] };

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

async function cleanup() {
  if (created.twinIds.length) {
    for (const id of created.twinIds) await db().from('mobility_twins').delete().eq('id', id);
  }
  if (created.deptIds.length) {
    for (const id of created.deptIds) await db().from('departments').delete().eq('id', id);
  }
  if (created.orgIds.length) {
    for (const id of created.orgIds) await db().from('organizations').delete().eq('id', id);
  }
  for (const au of created.authUsers) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error } = await db().auth.admin.deleteUser(au.id);
      if (!error) break;
      if (attempt === 1) console.warn(`cleanup auth ${au.tag}: ${error.message}`);
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  created = { authUsers: [], orgIds: [], deptIds: [], profileIds: [], twinIds: [] };
}

test('LIVE: one twin per user + upsert merge + CRUD + ownership', { skip: !live }, async () => {
  try {
    const pAId = await createAuthUser('pa');
    const pBId = await createAuthUser('pb');
    const mkProfile = (authUserId, name) =>
      db().from('profiles').insert({
        auth_user_id: authUserId, user_id: `TWIN_${name}_${Date.now()}`, name, email: email(name),
        role: 'individual', status: 'active', organization_id: null, department_id: null,
      }).select('id').single();
    const [pA, pB] = await Promise.all([mkProfile(pAId, 'pa'), mkProfile(pBId, 'pb')]);
    assert.ok(pA.data && pB.data, 'expected 2 test profiles');
    created.profileIds = [pA.data.id, pB.data.id];
    const tenantA = ctx(pA.data.id, 'individual', null, null);
    const tenantB = ctx(pB.data.id, 'individual', null, null);

    // ---- first creation + findById + findByOwner --------------------------
    const first = await mobilityTwinRepository.upsert(tenantA, { baseline: { windowDays: 28, entryCount: 1 } });
    assert.ok(first && first.id, 'twin created');
    assert.strictEqual(first.user_id, pA.data.id, 'twin owned by authenticated user');
    created.twinIds.push(first.id);

    const byOwner = await mobilityTwinRepository.findByOwner(tenantA);
    assert.strictEqual(byOwner.id, first.id, 'findByOwner returns the users twin');

    // ---- repeated upsert does NOT duplicate (user_id UNIQUE) --------------
    for (let i = 0; i < 3; i++) {
      await mobilityTwinRepository.upsert(tenantA, { baseline: { windowDays: 28, entryCount: i + 2 } });
    }
    const rowsA = await db().from('mobility_twins').select('id').eq('user_id', pA.data.id);
    assert.strictEqual(rowsA.data.length, 1, 'exactly one twin row per user after repeated upsert');

    // ---- update existing merges: change vehicle, keep baseline/scenarios ---
    const withScen = await mobilityTwinRepository.upsert(tenantA, {
      scenarios: [{ _id: 'scn-A', name: 'S1', changes: {}, result: { reductionKg: 1 } }],
    });
    assert.strictEqual(withScen.scenarios.length, 1, 'scenarios persisted');
    const merged = await mobilityTwinRepository.upsert(tenantA, {
      vehicleProfile: { mode: 'car', model: 'Alto', fuelType: 'petrol' },
    });
    assert.deepStrictEqual(merged.vehicle_profile, { mode: 'car', model: 'Alto', fuelType: 'petrol' }, 'vehicle updated');
    assert.strictEqual(merged.scenarios.length, 1, 'scenarios preserved across vehicle update');
    assert.strictEqual(merged.baseline.entryCount, 4, 'baseline preserved when not supplied');

    // ---- user A cannot read B twin (ownership) ----------------------------
    const bTwinForA = await mobilityTwinRepository.findById(tenantB, first.id);
    assert.strictEqual(bTwinForA, null, 'user B must not read user A twin by id');
    const bByOwner = await mobilityTwinRepository.findByOwner(tenantB);
    assert.strictEqual(bByOwner, null, 'user B has no twin of their own');

    // ---- user A cannot remove B twin / B removes only own ------------------
    // (remove() is scoped to the caller's profileId, so it can never touch A's row)
    await mobilityTwinRepository.remove(tenantB);
    const aStillThere = await mobilityTwinRepository.findByOwner(tenantA);
    assert.ok(aStillThere, 'user A twin untouched by user B remove');

    // ---- malicious override: user_id / org / dept ignored ------------------
    const orgProbe = await organizationRepository.create({ name: 'TWIN Org X', code: `TWINX${Date.now()}`, address: '' });
    created.orgIds.push(orgProbe.id);
    const m = await mobilityTwinRepository.upsert(tenantA, {
      baseline: { windowDays: 28 },
      user_id: pB.data.id,           // must be ignored
      organization_id: orgProbe.id,  // must be ignored
      department_id: '00000000-0000-0000-0000-000000000000', // must be ignored
    });
    assert.strictEqual(m.user_id, pA.data.id, 'twin ownership must be the authenticated user (cannot be overridden)');

    // ---- remove own twin ---------------------------------------------------
    await mobilityTwinRepository.remove(tenantA);
    assert.strictEqual(await mobilityTwinRepository.findByOwner(tenantA), null, 'owner can remove own twin');
    created.twinIds = [];
  } finally {
    await cleanup();
  }
});

test('LIVE: twin org/dept tenancy isolation at the data layer', { skip: !live }, async () => {
  try {
    const oaId = await createAuthUser('oa');
    const obId = await createAuthUser('ob');
    const orgA = await organizationRepository.create({ name: 'TWIN Org A', code: `TWINA${Date.now()}`, address: '' });
    const orgB = await organizationRepository.create({ name: 'TWIN Org B', code: `TWINB${Date.now()}`, address: '' });
    created.orgIds = [orgA.id, orgB.id];
    const deptA = await departmentRepository.create(ctx(oaId, 'college_admin', orgA.id, null), { name: 'TWIN Dept A', code: 'TDA' });
    const deptB = await departmentRepository.create(ctx(obId, 'college_admin', orgB.id, null), { name: 'TWIN Dept B', code: 'TDB' });
    created.deptIds = [deptA.id, deptB.id];

    const mk = (authUserId, name, oid, did) =>
      db().from('profiles').insert({
        auth_user_id: authUserId, user_id: `TWIN_${name}_${Date.now()}`, name, email: email(name),
        role: 'college_admin', organization_id: oid, department_id: did, status: 'active',
      }).select('id').single();
    const [oaP, obP] = await Promise.all([mk(oaId, 'oa', orgA.id, deptA.id), mk(obId, 'ob', orgB.id, deptB.id)]);
    created.profileIds = [oaP.data.id, obP.data.id];
    const tenantA = ctx(oaP.data.id, 'college_admin', orgA.id, deptA.id);
    const tenantB = ctx(obP.data.id, 'college_admin', orgB.id, deptB.id);

    const twinA = await mobilityTwinRepository.upsert(tenantA, { baseline: { windowDays: 28, entryCount: 1 } });
    created.twinIds.push(twinA.id);

    // an org-B caller must not be able to read org-A twin by id
    const aTwinSeenByB = await mobilityTwinRepository.findById(tenantB, twinA.id);
    assert.strictEqual(aTwinSeenByB, null, 'org B member must not read org A twin');
    assert.strictEqual(await mobilityTwinRepository.findByOwner(tenantB), null, 'org B member has no own twin');

    // org-B upsert/remove never touches org-A row
    await mobilityTwinRepository.upsert(tenantB, { baseline: { windowDays: 7 } });
    await mobilityTwinRepository.remove(tenantB);
    assert.ok(await mobilityTwinRepository.findByOwner(tenantA), 'org A twin intact after org B writes');
  } finally {
    await cleanup();
  }
});
