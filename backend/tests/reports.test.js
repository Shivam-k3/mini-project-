/**
 * Reports / Analytics migration tests (Phase 3F).
 *
 * The Reports API is a PERSONAL, user-only surface: `GET /api/reports/pdf`.
 * After migration its carbon data is sourced from Supabase PostgreSQL
 * `public.carbon_entries` (via `carbonRepository.listByUser` +
 * `carbonSerializer.toApiEntry`) instead of Mongo `CarbonEntry`.
 *
 * These tests verify the data path the report depends on:
 *   A) UNIT / architecture (always run):
 *      - toApiEntry supplies every field the report aggregation reads
 *        (transportPersonal, trips[].mode/.distanceKm, modeBreakdown,
 *        breakdown.transport == transport_personal, date, totalEmissions)
 *   B) LIVE repository data tests (skipped unless SUPABASE_URL + SECRET_KEY):
 *      - exact aggregation parity: a controlled personal fixture produces the
 *        same numbers the report route computes (weekly/monthly/daily/total,
 *        legacy per-mode fallback, km-by-mode), newest-first ordering
 *      - personal isolation: user B cannot read user A's report data
 *      - malicious user_id / organization_id / department_id overrides ignored
 *
 * The report's aggregation steps are unchanged (copied verbatim into this test
 * via the local `personalOf`/loop helpers) — what CHANGED is the data source,
 * so the test proves the PG path + serializer feeds the identical shapes that
 * yield the same ground-truth numbers.
 *
 * Controlled records use the `RPT_` profile marker + `report-…@ecoguardian.test`
 * emails and are FULLY removed in cleanup. Seeded/organization/demo data is
 * never deleted.
 *
 * Run: npm test  (from backend/)
 */
require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert');

const { tenancyContext, supabaseClient, carbonRepository, organizationRepository } = require('../repositories');
const { toApiEntry } = require('../repositories/carbonSerializer');
const { fromProfile } = tenancyContext;

function db() { return supabaseClient.client(); }

// The report aggregation (kept byte-identical to routes/reports.js).
function personalOf(entry) {
  if (typeof entry.transportPersonal === 'number') return entry.transportPersonal;
  return entry.breakdown?.transport || 0;
}

// ---------------------------------------------------------------------------
// A) unit / architecture
// ---------------------------------------------------------------------------
test('toApiEntry supplies every field the report aggregation reads', () => {
  const row = {
    id: 'aa11bb22-0000-4000-8000-000000000000',
    user_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    date: '2026-01-03T00:00:00.000Z',
    trips: [{ mode: 'car', distanceKm: 10 }, { mode: 'metro', distanceKm: 5 }],
    transport_personal: 2.72,
    transport_household: 0,
    mode_breakdown: { car: 2.1, metro: 0.62 },
    total_emissions: 2.72,
    legacy: {},
    notes: '',
  };
  const e = toApiEntry(row);
  assert.strictEqual(typeof e.transportPersonal, 'number', 'transportPersonal present (personalOf fast path)');
  assert.strictEqual(e.transportPersonal, 2.72);
  assert.deepStrictEqual(e.breakdown, { transport: 2.72 }, 'breakdown.transport == transport_personal (legacy fallback)');
  assert.strictEqual(e.trips[0].mode, 'car');
  assert.strictEqual(e.trips[1].distanceKm, 5);
  assert.deepStrictEqual(e.modeBreakdown, { car: 2.1, metro: 0.62 }, 'modeBreakdown preserved for per-mode/kmByMode');
  assert.ok(e.date, 'date preserved');
  assert.strictEqual(e.totalEmissions, 2.72, 'totalEmissions preserved for the PDF recent-activity list');
});

// ---------------------------------------------------------------------------
// B) LIVE data tests (gated)
// ---------------------------------------------------------------------------
const live = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

const MARK = `report-${Date.now()}-`;
const PASSWORD = 'ReportTest@123';

let created = { authUsers: [], orgIds: [], profileIds: [], entryIds: [] };

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

async function insertProfile(authUserId, name, role, organizationId, departmentId) {
  const { data, error } = await db().from('profiles').insert({
    auth_user_id: authUserId,
    user_id: `RPT_${name}_${Date.now()}`,
    name,
    email: email(name),
    role,
    status: 'active',
    organization_id: organizationId,
    department_id: departmentId,
  }).select('id').single();
  if (error) throw new Error(`insertProfile(${name}): ${error.message}`);
  created.profileIds.push(data.id);
  return data.id;
}

async function cleanup() {
  if (created.entryIds.length) {
    for (const id of created.entryIds) {
      const { error } = await db().from('carbon_entries').delete().eq('id', id);
      if (error) console.warn(`cleanup entry ${id}: ${error.message}`);
    }
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
  created = { authUsers: [], orgIds: [], profileIds: [], entryIds: [] };
}

test('LIVE: report aggregation parity from PostgreSQL carbon data (newest-first, exact totals)', { skip: !live }, async () => {
  try {
    const aId = await createAuthUser('ra');
    const bId = await createAuthUser('rb');
    const aPid = await insertProfile(aId, 'ra', 'individual', null, null);
    const bPid = await insertProfile(bId, 'rb', 'individual', null, null);
    const tenantA = ctx(aPid, 'individual', null, null);
    const tenantB = ctx(bPid, 'individual', null, null);

    // Controlled calendar-dated fixture for user A (dates deterministic so the
    // report's newest-first window is reproducible).
    await carbonRepository.create(tenantA, {
      date: '2026-01-01T10:00:00.000Z',
      trips: [{ mode: 'car', distanceKm: 5, occupants: 1 }],
      transportPersonal: 1.0, transportHousehold: 1.2,
      modeBreakdown: { car: 1.0 }, totalEmissions: 1.0,
    });
    await carbonRepository.create(tenantA, {
      date: '2026-01-02T10:00:00.000Z',
      trips: [{ mode: 'bus', distanceKm: 8, occupants: 1 }],
      transportPersonal: 1.0, transportHousehold: 1.1,
      modeBreakdown: { bus: 1.0 }, totalEmissions: 1.0,
    });
    await carbonRepository.create(tenantA, {
      date: '2026-01-03T10:00:00.000Z',
      trips: [{ mode: 'car', distanceKm: 10, occupants: 1 }, { mode: 'metro', distanceKm: 5, occupants: 1 }],
      transportPersonal: 2.72, transportHousehold: 3.0,
      modeBreakdown: { car: 2.1, metro: 0.62 }, totalEmissions: 2.72,
    });
    const rows = await carbonRepository.listByUser(tenantA, { limit: 30 });
    created.entryIds = rows.map((r) => r.id);
    const entries = rows.map(toApiEntry);

    // newest-first ordering (matches Mongo `.sort({date:-1}).limit(30)`)
    assert.strictEqual(entries.length, 3);
    assert.ok(new Date(entries[0].date) > new Date(entries[2].date), 'entries are ordered newest-first');
    assert.strictEqual(entries[0].trips.length, 2, 'newest entry has two trips');

    // ---- replicate the report aggregation on the PG-sourced docs -------------
    const weeklyTotal = entries.slice(0, 7).reduce((s, e) => s + personalOf(e), 0);
    const monthlyTotal = entries.slice(0, 30).reduce((s, e) => s + personalOf(e), 0);
    const dailyAvg = entries.length > 0 ? entries.reduce((s, e) => s + personalOf(e), 0) / entries.length : 0;
    const totalEmissions = Math.round(entries.reduce((s, e) => s + personalOf(e), 0) * 100) / 100;

    const modeBreakdown = {};
    const kmByMode = {};
    entries.forEach((e) => {
      if (Array.isArray(e.trips)) {
        e.trips.forEach((t) => {
          kmByMode[t.mode] = (kmByMode[t.mode] || 0) + Number(t.distanceKm || 0);
        });
      }
      const mb = e.modeBreakdown?.transport || {};
      Object.entries(mb).forEach(([k, v]) => {
        modeBreakdown[k] = (modeBreakdown[k] || 0) + v;
      });
    });
    if (!Object.keys(modeBreakdown).length && entries.length) {
      entries.forEach((e) => {
        const t = e.breakdown?.transport || 0;
        if (t) modeBreakdown.transport = (modeBreakdown.transport || 0) + t;
      });
    }

    // ---- exact ground-truth assertions ---------------------------------------
    assert.strictEqual(Math.round(weeklyTotal * 100) / 100, 4.72, 'weeklyTotal = 2.72+1.0+1.0');
    assert.strictEqual(Math.round(monthlyTotal * 100) / 100, 4.72, 'monthlyTotal over the 30-window');
    assert.ok(Math.abs(dailyAvg - 4.72 / 3) < 1e-9, 'dailyAvg = 4.72 / 3');
    assert.strictEqual(totalEmissions, 4.72, 'all-time total = 4.72');
    // legacy fallback from empty per-mode (`mode_breakdown.transport` undefined):
    // collapses to a single "transport" bucket equal to the personal total.
    // (float tolerance: 2.72+1.0+1.0 = 4.720000000000001, exactly as the route computes)
    assert.ok(Math.abs(modeBreakdown.transport - 4.72) < 1e-9, 'legacy mode fallback sums personal totals');
    // the rounded summary buckets match exactly
    assert.strictEqual(Math.round(modeBreakdown.transport * 100) / 100, 4.72);
    assert.strictEqual(kmByMode.car, 15, 'km by car = 5 + 10');
    assert.strictEqual(kmByMode.metro, 5, 'km by metro = 5');
    assert.strictEqual(kmByMode.bus, 8, 'km by bus = 8');

    // ---- personal isolation: user B sees none of A's report data -------------
    assert.strictEqual((await carbonRepository.listByUser(tenantB, { limit: 30 })).length, 0, 'personal user B sees no report data for A');

    // ---- malicious overrides ignored at the data layer ------------------------
    const orgProbe = await organizationRepository.create({ name: 'Report Org X', code: `RPTX${Date.now()}`, address: '' });
    created.orgIds.push(orgProbe.id);
    const malicious = await carbonRepository.create(tenantA, {
      notes: 'RPT malicious override',
      user_id: bPid,             // must be ignored
      organization_id: orgProbe.id, // must be ignored
      department_id: '00000000-0000-0000-0000-000000000000', // must be ignored
      transportPersonal: 0, transportHousehold: 0,
    });
    assert.strictEqual(malicious.user_id, aPid, 'report ownership derived from auth profile, never client-supplied');
    assert.strictEqual(malicious.organization_id, null, 'personal user must not gain org via payload');
    assert.strictEqual(malicious.department_id, null, 'personal user must not gain dept via payload');
    created.entryIds.push(malicious.id);
  } finally {
    await cleanup();
  }
});
