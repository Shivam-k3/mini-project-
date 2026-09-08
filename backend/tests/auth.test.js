/**
 * Backend auth tests — Phase 3H (Supabase Auth only, MongoDB retired).
 *
 * Two groups:
 *   A) UNIT (always run, no DB, no network)
 *      - `protect` rejects when no token / malformed token.
 *      - `protect` rejects a bogus Supabase token (verifyToken throws).
 *      - `protect` rejects a valid token with a missing profile (401) or a
 *        suspended profile (403).
 *      - `protect` accepts a valid token + active profile and attaches
 *        req.auth / req.user derived from the verified PostgreSQL profile.
 *      - `admin` guard forbids non-admin roles.
 *      - sanity of the Supabase service `isConfigured()` guard.
 *   B) INTEGRATION (skipped unless SUPABASE_URL + SUPABASE_SECRET_KEY are set)
 *      - real signInWithPassword, verifyToken decode/reject, session semantics.
 *
 * Run: npm test   (from backend/)
 */
const test = require('node:test');
const assert = require('node:assert');
const supabase = require('../services/supabase');
const { protect, admin } = require('../middleware/auth');
const { profileRepository } = require('../repositories');

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; };
  return res;
}

const ACTIVE_PROFILE = {
  id: '00000000-0000-0000-0000-000000000001',
  auth_user_id: 'a1111111-0000-0000-0000-000000000001',
  user_id: 'IND0001',
  name: 'Tester',
  email: 'tester@example.com',
  role: 'individual',
  organization_id: null,
  department_id: null,
  semester: '',
  section: '',
  first_login: false,
  status: 'active',
  profile: {},
  gamification: {},
};

// ---------------------------------------------------------------------------
// A) UNIT tests
// ---------------------------------------------------------------------------

test('protect -> 401 when no bearer token is supplied', async () => {
  const res = makeRes();
  let called = false;
  await protect({ headers: {} }, res, () => { called = true; });
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(called, false);
  assert.match(res.body.message, /no token/i);
});

test('protect -> 401 when Authorization is not Bearer', async () => {
  const res = makeRes();
  await protect({ headers: { authorization: 'Basic abc' } }, res, () => {});
  assert.strictEqual(res.statusCode, 401);
});

test('protect -> 401 when Supabase verifyToken fails (bogus/expired token)', async () => {
  const m = test.mock.method(supabase, 'verifyToken', async () => {
    const e = new Error('invalid');
    e.authError = true;
    throw e;
  });
  test.mock.method(profileRepository, 'findByAuthUserId', async () => ACTIVE_PROFILE);
  const res = makeRes();
  const req = { headers: { authorization: 'Bearer not.a.jwt' } };
  try {
    await protect(req, res, () => {});
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.body.message, /invalid token/i);
  } finally {
    m.mock.restore();
    test.mock.restoreAll();
  }
});

test('protect -> 401 when profile is missing and provisioning fails', async () => {
  test.mock.method(supabase, 'verifyToken', async () => ({ id: 'a1111111-0000-0000-0000-000000000001', email: 'fresh@example.com' }));
  test.mock.method(profileRepository, 'findByAuthUserId', async () => null);
  test.mock.method(profileRepository, 'ensurePersonalProfile', async () => {
    throw new Error('provisioning unavailable');
  });
  const res = makeRes();
  const req = { headers: { authorization: 'Bearer valid.supabase.token' } };
  try {
    await protect(req, res, () => {});
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.body.message, /profile/i);
  } finally {
    test.mock.restoreAll();
  }
});

test('protect -> provisions a personal profile on first login for a missing profile (OAuth)', async () => {
  const provisioned = {
    ...ACTIVE_PROFILE,
    id: '00000000-0000-0000-0000-000000000099',
    auth_user_id: 'a2222222-0000-0000-0000-000000000002',
    user_id: 'IND0099',
    name: 'Fresh OAuth',
    email: 'fresh@example.com',
  };
  test.mock.method(supabase, 'verifyToken', async () => ({
    id: 'a2222222-0000-0000-0000-000000000002',
    email: 'fresh@example.com',
    user_metadata: { full_name: 'Fresh OAuth' },
  }));
  test.mock.method(profileRepository, 'findByAuthUserId', async () => null);
  test.mock.method(profileRepository, 'ensurePersonalProfile', async (authUserId, identity) => ({
    profile: provisioned,
    created: true,
  }));
  const res = makeRes();
  const req = { headers: { authorization: 'Bearer valid.supabase.token' } };
  try {
    let nextCalled = false;
    await protect(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(res.statusCode, null);
    assert.strictEqual(req.user.userId, 'IND0099');
    assert.strictEqual(req.user.role, 'individual');
    assert.strictEqual(req.auth.profile.id, provisioned.id);
  } finally {
    test.mock.restoreAll();
  }
});

test('protect -> idempotent: returning OAuth user reuses existing profile (no duplicate)', async () => {
  test.mock.method(supabase, 'verifyToken', async () => ({ id: 'a1111111-0000-0000-0000-000000000001', email: 'tester@example.com' }));
  let ensureCalls = 0;
  test.mock.method(profileRepository, 'findByAuthUserId', async () => ACTIVE_PROFILE);
  // ensurePersonalProfile must not be reached because the profile already exists.
  test.mock.method(profileRepository, 'ensurePersonalProfile', async () => {
    ensureCalls += 1;
    return { profile: ACTIVE_PROFILE, created: false };
  });
  const res = makeRes();
  const req = { headers: { authorization: 'Bearer valid.supabase.token' } };
  try {
    let nextCalled = false;
    await protect(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.user.userId, ACTIVE_PROFILE.user_id);
    assert.strictEqual(req.user.name, ACTIVE_PROFILE.name);
    assert.strictEqual(ensureCalls, 0, 'existing profile should short-circuit provisioning');
  } finally {
    test.mock.restoreAll();
  }
});

test('protect -> 403 when profile is suspended', async () => {
  test.mock.method(supabase, 'verifyToken', async () => ({ id: 'a1111111-0000-0000-0000-000000000001' }));
  test.mock.method(profileRepository, 'findByAuthUserId', async () => ({ ...ACTIVE_PROFILE, role: 'college_admin', organization_id: 'o0000000-0000-0000-0000-000000000001', status: 'suspended' }));
  const res = makeRes();
  const req = { headers: { authorization: 'Bearer valid.supabase.token' } };
  try {
    await protect(req, res, () => {});
    assert.strictEqual(res.statusCode, 403);
    assert.match(res.body.message, /suspended/i);
  } finally {
    test.mock.restoreAll();
  }
});

test('protect -> attaches req.auth/req.user from a valid Supabase token + active PG profile', async () => {
  test.mock.method(supabase, 'verifyToken', async () => ({ id: 'a1111111-0000-0000-0000-000000000001' }));
  test.mock.method(profileRepository, 'findByAuthUserId', async () => ACTIVE_PROFILE);
  const res = makeRes();
  const req = { headers: { authorization: 'Bearer valid.supabase.token' } };
  try {
    let nextCalled = false;
    await protect(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
    assert.ok(req.auth, 'req.auth set');
    assert.strictEqual(req.auth.provider, 'supabase');
    assert.strictEqual(req.auth.authUserId, 'a1111111-0000-0000-0000-000000000001');
    assert.strictEqual(req.auth.profile.id, ACTIVE_PROFILE.id);
    assert.strictEqual(req.auth.tenant.profileId, ACTIVE_PROFILE.id);
    assert.strictEqual(req.auth.tenant.role, 'individual');
    // req.user is derived from the PG profile (Mongo User shape preserved).
    assert.strictEqual(req.user._id, ACTIVE_PROFILE.id);
    assert.strictEqual(req.user.name, 'Tester');
    assert.strictEqual(req.user.role, 'individual');
    assert.strictEqual(req.user.userId, 'IND0001');
  } finally {
    test.mock.restoreAll();
  }
});

test('idempotent: protect skips lookup when req.user already set', async () => {
  let nextCalled = false;
  const res = { status() { this.code = 200; return this; }, json() {} };
  const req = { user: { _id: 'x', role: 'individual' } };
  await protect(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
  assert.notStrictEqual(res.code, 401);
  assert.ok(req.user, 'req.user preserved');
});

test('admin guard forbids non-admin roles', () => {
  const res = makeRes();
  let ok = false;
  admin({ user: { role: 'individual' } }, res, () => { ok = true; });
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(ok, false);
});

test('supabase.isConfigured() reflects env presence (no secrets leaked)', () => {
  const prevUrl = process.env.SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  assert.strictEqual(supabase.isConfigured(), false);
  // re-enable with placeholders (never real secrets in source)
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_TEST';
  assert.strictEqual(supabase.isConfigured(), true);
  // ensure the admin client constructor does not throw on placeholder URL shape
  assert.doesNotThrow(() => { supabase.adminClient(); });
  if (prevUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = prevUrl;
  if (prevKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = prevKey;
});

// ---------------------------------------------------------------------------
// B) INTEGRATION (gated — requires live Supabase credentials in env)
// ---------------------------------------------------------------------------
const realConfigured =
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

test('INTEGRATION: signInWithPassword returns a usable session (when configured)',
  { skip: !realConfigured }, async () => {
    const { data, error } = await supabase.adminClient().auth.signInWithPassword({
      email: process.env.SUPABASE_TEST_EMAIL || 'super@ecoguardian.ai',
      password: process.env.SUPABASE_TEST_PASSWORD || 'admin123',
    });
    assert.strictEqual(error, null, `signIn error: ${error?.message}`);
    assert.ok(data.session?.access_token, 'expected access token');
    assert.ok(data.session?.refresh_token, 'expected refresh token');
  });

test('INTEGRATION: verifyToken decodes a valid access token (when configured)',
  { skip: !realConfigured }, async () => {
    const { data } = await supabase.adminClient().auth.signInWithPassword({
      email: process.env.SUPABASE_TEST_EMAIL || 'super@ecoguardian.ai',
      password: process.env.SUPABASE_TEST_PASSWORD || 'admin123',
    });
    const user = await supabase.verifyToken(data.session.access_token);
    assert.ok(user.id, 'expected auth user id (sub)');
  });

test('INTEGRATION: verifyToken rejects a bogus token (when configured)',
  { skip: !realConfigured }, async () => {
    await assert.rejects(() => supabase.verifyToken('not.a.real.token'));
  });
