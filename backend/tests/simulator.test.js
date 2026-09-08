/**
 * Simulator migration tests (Phase 3D).
 *
 * Verifies that the Simulator persistence/data-access layer is served from
 * Supabase PostgreSQL (`public.simulations`) via `simulationRepository` +
 * `simulationSerializer`, preserving the API contract and ownership model.
 *
 * Two groups:
 *   A) UNIT / architecture (always run):
 *      - simulationSerializer.toApiSimulation maps a PG row onto the Mongo-doc
 *        contract (_id, baseline, changes, results, createdAt), preserving the
 *        nested JSONB result structure exactly.
 *      - repository surface.
 *   B) LIVE repository data tests (skipped unless SUPABASE_URL + SECRET_KEY):
 *      - create -> list -> findById round-trip, JSONB result preservation,
 *        timestamps (created_at present, auto-set by the DB)
 *      - delete (remove) scoped to owner
 *      - ownership: A cannot read/delete B's simulation
 *      - cross-org / cross-dept isolation (ownership is strictly by profile id)
 *      - malicious user_id / org / dept overrides are ignored
 *
 * Controlled records use an email-safe `SIM_…` marker and are FULLY removed in
 * cleanup. Seeded/organization/demo data is never deleted.
 *
 * Run: npm test  (from backend/)
 */
require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert');

const { tenancyContext, supabaseClient, simulationRepository, organizationRepository, departmentRepository } = require('../repositories');
const { toApiSimulation } = require('../repositories/simulationSerializer');
const { fromProfile } = tenancyContext;

function db() { return supabaseClient.client(); }

// ---------------------------------------------------------------------------
// A) unit / architecture
// ---------------------------------------------------------------------------
test('simulationSerializer.toApiSimulation maps a PG row onto the Mongo contract', () => {
  const row = {
    id: 'aa11bb22-0000-4000-8000-000000000000',
    user_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    name: 'Car → Metro',
    baseline: { trips: [{ mode: 'car', distanceKm: 10, occupants: 1 }] },
    changes: { replaceMode: 'car', newMode: 'metro' },
    results: { baselineTotal: 2.1, scenarioTotal: 0.82, reduction: 1.28, reductionPercent: 61 },
    created_at: '2026-08-30T12:00:00.000Z',
  };
  const sim = toApiSimulation(row);
  assert.strictEqual(sim._id, row.id, '_id must mirror the uuid');
  assert.strictEqual(sim.user, row.user_id);
  assert.strictEqual(sim.name, 'Car → Metro');
  assert.deepStrictEqual(sim.results, row.results, 'results JSONB preserved verbatim');
  assert.deepStrictEqual(sim.baseline, row.baseline, 'baseline JSONB preserved verbatim');
  assert.deepStrictEqual(sim.changes, row.changes, 'changes JSONB preserved verbatim');
  assert.strictEqual(sim.createdAt, row.created_at, 'created_at -> createdAt');
});

test('simulationSerializer.toApiSimulation tolerates null / missing row', () => {
  assert.strictEqual(toApiSimulation(null), null);
  const s = toApiSimulation({});
  assert.deepStrictEqual(s.baseline, {});
  assert.deepStrictEqual(s.results, {});
  assert.deepStrictEqual(s.changes, {});
  assert.strictEqual(s._id, undefined);
});

test('simulationRepository exports expected methods', () => {
  assert.strictEqual(typeof simulationRepository.listByOwner, 'function');
  assert.strictEqual(typeof simulationRepository.findById, 'function');
  assert.strictEqual(typeof simulationRepository.create, 'function');
  assert.strictEqual(typeof simulationRepository.remove, 'function');
});

// ---------------------------------------------------------------------------
// B) LIVE data tests (gated)
// ---------------------------------------------------------------------------
const live = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

const MARK = `sim-${Date.now()}-`;
const PASSWORD = 'SimTest@123';

let created = { authUsers: [], orgIds: [], deptIds: [], profileIds: [], simIds: [] };

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
  if (created.simIds.length) {
    for (const id of created.simIds) await db().from('simulations').delete().eq('id', id);
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
  created = { authUsers: [], orgIds: [], deptIds: [], profileIds: [], simIds: [] };
}

test('LIVE: simulation CRUD + JSONB results + ownership + delete', { skip: !live }, async () => {
  try {
    const pAId = await createAuthUser('pa');
    const pBId = await createAuthUser('pb');
    const mkProfile = (authUserId, name) =>
      db().from('profiles').insert({
        auth_user_id: authUserId, user_id: `SIM_${name}_${Date.now()}`, name, email: email(name),
        role: 'individual', status: 'active', organization_id: null, department_id: null,
      }).select('id').single();
    const [pA, pB] = await Promise.all([mkProfile(pAId, 'pa'), mkProfile(pBId, 'pb')]);
    assert.ok(pA.data && pB.data, 'expected 2 test profiles');
    created.profileIds = [pA.data.id, pB.data.id];
    const tenantA = ctx(pA.data.id, 'individual', null, null);
    const tenantB = ctx(pB.data.id, 'individual', null, null);

    // ---- create (full JSONB result structure) ------------------------------
    const createdSim = await simulationRepository.create(tenantA, {
      name: 'SIM Car → Metro',
      baseline: { trips: [{ mode: 'car', distanceKm: 10, occupants: 1 }, { mode: 'metro', distanceKm: 5, occupants: 1 }] },
      changes: { replaceMode: 'car', newMode: 'metro' },
      results: { baselineTotal: 2.1, scenarioTotal: 0.82, reduction: 1.28, reductionPercent: 61 },
    });
    assert.ok(createdSim && createdSim.id, 'simulation created');
    assert.strictEqual(createdSim.user_id, pA.data.id, 'simulation owned by authenticated user');
    assert.ok(createdSim.created_at, 'created_at set by the DB trigger/default');
    created.simIds.push(createdSim.id);

    // ---- JSONB round-trip fidelity -----------------------------------------
    const found = await simulationRepository.findById(tenantA, createdSim.id);
    assert.ok(found, 'owner can findById');
    assert.deepStrictEqual(found.results, { baselineTotal: 2.1, scenarioTotal: 0.82, reduction: 1.28, reductionPercent: 61 }, 'results JSONB preserved exactly');
    assert.strictEqual(found.baseline.trips.length, 2, 'baseline trips array preserved');
    assert.strictEqual(found.baseline.trips[0].mode, 'car');

    // ---- list most recent first --------------------------------------------
    await simulationRepository.create(tenantA, { name: 'SIM newest', changes: { mode: 'car', occupants: 4 }, results: { reduction: 0.5 } });
    const list = await simulationRepository.listByOwner(tenantA, { limit: 20 });
    assert.ok(list.length >= 2, 'lists own simulations');
    assert.strictEqual(list[0].name, 'SIM newest', 'list orders by created_at desc');
    created.simIds.push(...list.map((s) => s.id));

    // ---- serializer contract on listed rows ---------------------------------
    const api = list.map(toApiSimulation);
    assert.ok(api.some((s) => s._id === found.id), 'serializer exposes _id matching the uuid');
    assert.ok(api.every((s) => s.createdAt), 'serializer exposes createdAt');

    // ---- ownership: B cannot read A's simulation ----------------------------
    assert.strictEqual(await simulationRepository.findById(tenantB, createdSim.id), null, 'user B must not read user A sim');
    assert.strictEqual((await simulationRepository.listByOwner(tenantB)).length, 0, 'user B has no simulations');

    // ---- B cannot delete A's simulation --------------------------------------
    await simulationRepository.remove(tenantB, createdSim.id);
    assert.ok(await simulationRepository.findById(tenantA, createdSim.id), 'A sim intact after B delete attempt (scoped to owner)');

    // ---- malicious override: user_id / org / dept ignored --------------------
    const orgProbe = await organizationRepository.create({ name: 'SIM Org X', code: `SIMX${Date.now()}`, address: '' });
    created.orgIds.push(orgProbe.id);
    const m = await simulationRepository.create(tenantA, {
      name: 'SIM malicious',
      changes: { mode: 'car' },
      results: { reduction: 0 },
      user_id: pB.data.id,           // must be ignored
      organization_id: orgProbe.id,  // no such column — repository never reads it
      department_id: '00000000-0000-0000-0000-000000000000',
    });
    assert.strictEqual(m.user_id, pA.data.id, 'simulation ownership must be the authenticated user (cannot be overridden)');
    created.simIds.push(m.id);

    // ---- delete own simulation ------------------------------------------------
    await simulationRepository.remove(tenantA, m.id);
    assert.strictEqual(await simulationRepository.findById(tenantA, m.id), null, 'owner can delete own sim');
    created.simIds = created.simIds.filter((id) => id !== m.id);
  } finally {
    await cleanup();
  }
});

test('LIVE: simulation cross-org / cross-dept isolation', { skip: !live }, async () => {
  try {
    const oaId = await createAuthUser('oa');
    const obId = await createAuthUser('ob');
    const orgA = await organizationRepository.create({ name: 'SIM Org A', code: `SIMA${Date.now()}`, address: '' });
    const orgB = await organizationRepository.create({ name: 'SIM Org B', code: `SIMB${Date.now()}`, address: '' });
    created.orgIds = [orgA.id, orgB.id];
    const deptA = await departmentRepository.create(ctx(oaId, 'college_admin', orgA.id, null), { name: 'SIM Dept A', code: 'SDA' });
    const deptB = await departmentRepository.create(ctx(obId, 'college_admin', orgB.id, null), { name: 'SIM Dept B', code: 'SDB' });
    created.deptIds = [deptA.id, deptB.id];

    const mk = (authUserId, name, oid, did) =>
      db().from('profiles').insert({
        auth_user_id: authUserId, user_id: `SIM_${name}_${Date.now()}`, name, email: email(name),
        role: 'college_admin', organization_id: oid, department_id: did, status: 'active',
      }).select('id').single();
    const [oaP, obP] = await Promise.all([mk(oaId, 'oa', orgA.id, deptA.id), mk(obId, 'ob', orgB.id, deptB.id)]);
    created.profileIds = [oaP.data.id, obP.data.id];
    const tenantA = ctx(oaP.data.id, 'college_admin', orgA.id, deptA.id);
    const tenantB = ctx(obP.data.id, 'college_admin', orgB.id, deptB.id);

    const simA = await simulationRepository.create(tenantA, { name: 'SIM org A result', changes: {}, results: { reduction: 3 } });
    created.simIds.push(simA.id);

    // org-B / dept-B caller cannot read, list, or delete org-A caller's sim
    assert.strictEqual(await simulationRepository.findById(tenantB, simA.id), null, 'org B member must not read org A member sim');
    assert.deepStrictEqual(await simulationRepository.listByOwner(tenantB), [], 'org B member lists no simulations');
    await simulationRepository.remove(tenantB, simA.id);
    assert.ok(await simulationRepository.findById(tenantA, simA.id), 'org A sim intact after org B remove attempt');
  } finally {
    await cleanup();
  }
});
