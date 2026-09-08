const { createClient } = require('@supabase/supabase-js');

/**
 * Supabase Auth + PostgreSQL bridge (Phase 2, hardened in Phase 3H).
 *
 * The Express backend remains the business/API layer. It connects to Supabase
 * with the SERVICE/ SECRET key so it can:
 *   - verify & decode access tokens (`getUser`)
 *   - perform server-side auth mutations (signInWithPassword, updateUser,
 *     admin.createUser, admin.updateUserById, admin.generateLink, admin.deleteUser)
 *
 * The application identity is resolved by `profileRepository.findByAuthUserId`
 * (public.profiles), NOT by any MongoDB model — MongoDB is fully retired from
 * the production auth path.
 *
 * SECURITY: SUPABASE_SECRET_KEY / DATABASE_URL are server-only. They are read
 * from process.env and never exposed to the frontend or logged.
 */

let _admin = null;

function adminClient() {
  if (!_admin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required for Supabase admin operations');
    }
    _admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _admin;
}

/** Client used to READ the public.profiles table (via the secret key, RLS bypass). */
function profilesClient() {
  return adminClient();
}

/** Whether Supabase auth is configured in this environment. */
function isConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

/**
 * Decode/verify a Supabase access token (server-side). Returns the JWT payload
 * (whose `sub` is the Supabase auth user id) or throws on invalid/expired token.
 */
async function verifyToken(accessToken) {
  const { data, error } = await adminClient().auth.getUser(accessToken);
  if (error || !data?.user) {
    const err = new Error(error?.message || 'Invalid token');
    err.authError = true;
    throw err;
  }
  return data.user;
}

module.exports = {
  adminClient,
  profilesClient,
  isConfigured,
  verifyToken,
};
