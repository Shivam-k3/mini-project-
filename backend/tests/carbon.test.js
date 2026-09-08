/**
 * Carbon migration tests (Phase 3B).
 *
 * Verifies that `backend/routes/carbon.js` now serves carbon data from
 * Supabase PostgreSQL via `carbonRepository` + `carbonSerializer`, preserving
 * the exact API contract the frontend consumes.
 *
 * Two groups:
 *   A) UNIT / architecture (always run):
 *      - carbonSerializer.toApiEntry maps a PG row to the Mongo-document
 *        contract (e._id, trips[], date, transportPersonal, totalEmissions,
 *        modeBreakdown, breakdown.transport) the frontend reads.
 *      - null/no-row handling.
 *      - repository surface (new methods listAllByUser / countByUser).
 *   B) LIVE repository data tests (skipped unless SUPABASE_URL + SECRET_KEY):
 *      - personal CRUD lifecycle (create -> listAll -> findById -> update ->
 *        remove -> not-found)
 *      - pagination (page/limit/offset) + count
 *      - date-filtering
 *      - multi-trip + modeBreakdown round-trip fidelity (jsonb)
 *      - legacy jsonb compat
 *      - malicious user_id / organization_id / department_id overrides are
 *        ignored (ownership + tenancy always derived from the profile)
 *      - empty result sets
 *      - tenancy isolation at the data layer
 *
 * Controlled records use an email-safe `CARBON_…` marker and are FULLY removed
 * in cleanup. Seeded/organization/demo data is never deleted.
 *
 * Run: npm test  (from backend/)
 */
require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert');

const { tenancyContext, supabaseClient, carbonRepository, profileRepository, organizationRepository, departmentRepository } = require('../repositories');
const { toApiEntry } = require('../repositories/carbonSerializer');
const { fromProfile } = tenancyContext;

function db() { return supabaseClient.client(); }

// ---------------------------------------------------------------------------
// A) unit / architecture
// ---------------------------------------------------------------------------
test('carbonSerializer.toApiEntry maps a PG row onto the frontend contract', () => {
  const row = {
    id: '9f4d2a1e-0000-4000-8000-000000000000',
    user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    date: '2026-08-30T12:00:00.000Z',
    trips: [{ mode: 'car', distanceKm: 10, tripTotalEmission: 2.1, personalAllocatedEmission: 2.1 }],
    transport_personal: 2.1,
    transport_household: 0,
    mode_breakdown: { car: 2.1 },
    total_emissions: 2.1,
    legacy: {},
    notes: 'to work',
    organization_id: null,
    department_id: null,
    created_at: '2026-08-30T12:00:00.000Z',
    updated_at: '2026-08-30T12:00:00.000Z',
  };
  const api = toApiEntry(row);
  // the frontend keys lists by e._id and reads date via new Date(...)
  assert.strictEqual(api._id, row.id, '_id must mirror the uuid so e._id works as a React key');
  assert.strictEqual(api.id, row.id);
  assert.strictEqual(api.transportPersonal, 2.1);
  assert.strictEqual(api.totalEmissions, 2.1);
  assert.strictEqual(api.transportHousehold, 0);
  assert.deepStrictEqual(api.trips, row.trips);
  assert.deepStrictEqual(api.modeBreakdown, { car: 2.1 });
  assert.deepStrictEqual(api.breakdown, { transport: 2.1 }, 'breakdown.transport = personal total for legacy trend/avg compat');
  assert.ok(Number.isFinite(new Date(api.date).getTime()), 'date must be parseable by new Date()');
});

test('carbonSerializer.toApiEntry tolerates nulls / missing row', () => {
  assert.strictEqual(toApiEntry(null), null);
  assert.strictEqual(toApiEntry(undefined), null);
  const api = toApiEntry({});
  assert.strictEqual(api._id, undefined);
  assert.strictEqual(api.transportPersonal, 0);
  assert.strictEqual(api.totalEmissions, 0);
  assert.deepStrictEqual(api.breakdown, { transport: 0 });
  assert.deepStrictEqual(api.trips, []);
});

test('carbonRepository exports the new Phase 3B methods', () => {
  assert.strictEqual(typeof carbonRepository.listAllByUser, 'function');
  assert.strictEqual(typeof carbonRepository.countByUser, 'function');
});

// ---------------------------------------------------------------------------
// B) LIVE data tests (gated)
// ---------------------------------------------------------------------------
const live = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

const MARK = `carbon-${Date.now()}-`;
const PASSWORD = 'CarbonTest@123';

let created = { authUsers: [], orgIds: [], deptIds: [], profileIds: [], entryIds: [] };

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
  if (created.entryIds.length) {
    for (const id of created.entryIds) await db().from('carbon_entries').delete().eq('id', id);
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
  created = { authUsers: [], orgIds: [], deptIds: [], profileIds: [], entryIds: [] };
}

test('LIVE: carbon personal CRUD + pagination + count + date filter', { skip: !live }, async () => {
  try {
    const pAId = await createAuthUser('pa');
    const pA = await db().from('profiles').insert({
      auth_user_id: pAId, user_id: `CARBON_PA_${Date.now()}`, name: 'pa', email: email('pa'),
      role: 'individual', status: 'active', organization_id: null, department_id: null,
    }).select('id').single();
    assert.ok(pA.data, 'expected personal A profile');
    created.profileIds.push(pA.data.id);
    const tenant = ctx(pA.data.id, 'individual', null, null);

    // create three entries (multi-trip + mode breakdown on one)
    await carbonRepository.create(tenant, {
      notes: 'CARBON multi-trip',
      trips: [
        { mode: 'car', distanceKm: 10, occupants: 1, tripFrequency: 1, resolved: { factorKgPerKm: 0.21 } },
        { mode: 'metro', distanceKm: 5, occupants: 1, tripFrequency: 1, resolved: { factorKgPerKm: 0.082 } },
      ],
      transportPersonal: 2.72,
      transportHousehold: 0,
      modeBreakdown: { car: 2.1, metro: 0.62 },
      totalEmissions: 2.72,
      legacy: { previousVersion: true },
    });
    await carbonRepository.create(tenant, {
      notes: 'CARBON single',
      transportPersonal: 1.0, transportHousehold: 0,
      modeBreakdown: { bus: 1.0 }, totalEmissions: 1.0,
    });
    await carbonRepository.create(tenant, {
      notes: 'CARBON later',
      date: new Date(Date.now() + 86400000).toISOString(),
      transportPersonal: 3.0, transportHousehold: 0,
      modeBreakdown: { walk: 0 }, totalEmissions: 3.0,
    });
    // collect the actual ids by listing
    const all = await carbonRepository.listAllByUser(tenant);
    created.entryIds = all.map((r) => r.id);
    assert.ok(all.length >= 3, `expected >=3 entries, got ${all.length}`);

    // newest first
    assert.strictEqual(all[0].notes, 'CARBON later', 'listAll is ordered newest first');

    // multi-trip + mode breakdown round-trip (jsonb fidelity)
    const mt = all.find((r) => r.notes === 'CARBON multi-trip');
    assert.ok(mt, 'multi-trip entry persisted');
    assert.strictEqual(mt.trips.length, 2, 'trips jsonb preserved');
    assert.strictEqual(mt.trips[0].mode, 'car');
    assert.deepStrictEqual(mt.mode_breakdown, { car: 2.1, metro: 0.62 }, 'mode_breakdown jsonb round-trips');
    assert.deepStrictEqual(mt.legacy, { previousVersion: true }, 'legacy jsonb round-trips');

    // count
    const count = await carbonRepository.countByUser(tenant);
    assert.strictEqual(count, all.length, 'countByUser matches listed length');

    // pagination: page size 2 => 2 on page 1, rest on page 2/3
    const page1 = await carbonRepository.listByUser(tenant, { limit: 2, offset: 0 });
    assert.strictEqual(page1.length, 2);
    const page2 = await carbonRepository.listByUser(tenant, { limit: 2, offset: 2 });
    assert.ok(page2.length >= 1);
    const page1Ids = new Set(page1.map((r) => r.id));
    assert.ok(!page1Ids.has(page2[0].id), 'pagination does not overlap');
    const pages = Math.ceil(count / 2);
    assert.strictEqual(page1.length + page2.length >= count - (count % 2), true);

    // date filter: only the entry whose date is ~a day in the future is found
    // (the other two were created "now", which is earlier than this threshold)
    const newestOnly = await carbonRepository.listByUser(tenant, {
      from: new Date(Date.now() + 1800000).toISOString(),
    });
    assert.strictEqual(newestOnly.length, 1, 'date from-filter returns only the future-dated entry');
    assert.strictEqual(newestOnly[0].notes, 'CARBON later');

    // findById scoped to owner
    const found = await carbonRepository.findById(tenant, all[0].id);
    assert.ok(found, 'owner can findById own entry');

    // update
    const updated = await carbonRepository.update(tenant, all[1].id, { transport_personal: 9.99, total_emissions: 9.99 });
    assert.strictEqual(Number(updated.transport_personal), 9.99, 'update persists new personal total');

    // remove
    const victim = all[all.length - 1].id;
    await carbonRepository.remove(tenant, victim);
    const removed = await carbonRepository.findById(tenant, victim);
    assert.strictEqual(removed, null, 'removed entry is gone');
    created.entryIds = created.entryIds.filter((id) => id !== victim);

    // empty results for a fresh personal user B
    const pBId = await createAuthUser('pb');
    const pB = await db().from('profiles').insert({
      auth_user_id: pBId, user_id: `CARBON_PB_${Date.now()}`, name: 'pb', email: email('pb'),
      role: 'individual', status: 'active', organization_id: null, department_id: null,
    }).select('id').single();
    created.profileIds.push(pB.data.id);
    const tenantB = ctx(pB.data.id, 'individual', null, null);
    assert.strictEqual((await carbonRepository.listByUser(tenantB)).length, 0, 'new personal user sees no entries');
    assert.strictEqual(await carbonRepository.countByUser(tenantB), 0, 'count is 0 for empty user');
    assert.strictEqual(await carbonRepository.findById(tenantB, all[0].id), null, 'B cannot read A entry (ownership)');

    // malicious override: client cannot change ownership / tenancy
    const orgProbe = await organizationRepository.create({ name: 'CARBON Org X', code: `CARBONX${Date.now()}`, address: '' });
    created.orgIds.push(orgProbe.id);
    const malicious = await carbonRepository.create(tenant, {
      notes: 'CARBON malicious override',
      user_id: pB.data.id,           // must be ignored
      organization_id: orgProbe.id,  // must be ignored
      department_id: '00000000-0000-0000-0000-000000000000', // must be ignored
    });
    assert.strictEqual(malicious.user_id, pA.data.id, 'user_id must be derived from the auth profile, never client-supplied');
    assert.strictEqual(malicious.organization_id, null, 'personal user must not gain org via payload');
    assert.strictEqual(malicious.department_id, null, 'personal user must not gain dept via payload');
  } finally {
    await cleanup();
  }
});

test('LIVE: carbon org/dept tenancy isolation at the data layer', { skip: !live }, async () => {
  try {
    const oaId = await createAuthUser('oa');
    const obId = await createAuthUser('ob');
    const orgA = await organizationRepository.create({ name: 'CARBON Org A', code: `CARBONA${Date.now()}`, address: '' });
    const orgB = await organizationRepository.create({ name: 'CARBON Org B', code: `CARBONB${Date.now()}`, address: '' });
    created.orgIds = [orgA.id, orgB.id];
    const deptA = await departmentRepository.create(ctx(oaId, 'college_admin', orgA.id, null), { name: 'CARBON Dept A', code: 'CDA' });
    const deptB = await departmentRepository.create(ctx(obId, 'college_admin', orgB.id, null), { name: 'CARBON Dept B', code: 'CDB' });
    created.deptIds = [deptA.id, deptB.id];

    const mk = (authUserId, name, role, oid, did) =>
      db().from('profiles').insert({
        auth_user_id: authUserId, user_id: `CARBON_${name}_${Date.now()}`, name, email: email(name),
        role, organization_id: oid, department_id: did, status: 'active',
      }).select('id').single();
    const [oaP, obP] = await Promise.all([mk(oaId, 'oa', 'college_admin', orgA.id, deptA.id), mk(obId, 'ob', 'college_admin', orgB.id, deptB.id)]);
    created.profileIds = [oaP.data.id, obP.data.id];
    const tenantA = ctx(oaP.data.id, 'college_admin', orgA.id, deptA.id);
    const tenantB = ctx(obP.data.id, 'college_admin', orgB.id, deptB.id);

    await carbonRepository.create(tenantA, { notes: 'CARBON org A entry', transportPersonal: 5, totalEmissions: 5 });
    await carbonRepository.create(tenantB, { notes: 'CARBON org B entry', transportPersonal: 7, totalEmissions: 7 });

    const rowsA = await carbonRepository.listByTenant(tenantA);
    const rowsB = await carbonRepository.listByTenant(tenantB);
    assert.ok(rowsA.some((r) => r.notes === 'CARBON org A entry'));
    assert.ok(!rowsA.some((r) => r.notes === 'CARBON org B entry'), 'org A must not see org B');
    assert.ok(rowsB.some((r) => r.notes === 'CARBON org B entry'));
    assert.ok(!rowsB.some((r) => r.notes === 'CARBON org A entry'), 'org B must not see org A');

    const deptAScope = await carbonRepository.listByTenant(tenantA, { scopeToOwnDept: true });
    assert.ok(!deptAScope.some((r) => r.notes === 'CARBON org B entry'), 'dept-A scope excludes dept-B row');
  } finally {
    await cleanup();
  }
});
