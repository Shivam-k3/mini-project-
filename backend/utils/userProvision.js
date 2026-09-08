/**
 * Provisioning helper for admin-created identities (Phase 3G).
 *
 * public.profiles.auth_user_id is NOT NULL, and the canonical way to create a
 * profile row is to first create a real Supabase auth.user (the deployment uses
 * `auth.users.id -> profiles.auth_user_id`). So the college-admin create /
 * import / reset-password flows bind every provisioned profile to a real
 * Supabase Auth identity:
 *
 *   * create : admin.auth.createUser(email, temp password)  -> auth_user_id
 *   * reset  : admin.updateUserById(auth_user_id, { password })
 *   * delete : admin.deleteUser(auth_user_id)
 *
 * These are best-effort on the auth side: the service-role runtime is configured
 * with SUPABASE_SECRET_KEY and may not be present in some test/env contexts, in
 * which case the caller decides whether the operation can proceed.
 */
const supabase = require('../services/supabase');

const TEMP_PASSWORD = 'Temp@123';

function notConfigured() {
  const e = new Error('Supabase admin not configured; cannot provision auth identity');
  e.status = 501;
  return e;
}

/** Create a Supabase auth user (email-confirmed) with the temp password. Returns auth user id. */
async function createAuthUser(email, password = TEMP_PASSWORD) {
  if (!supabase.isConfigured()) throw notConfigured();
  const { data, error } = await supabase.adminClient().auth.admin.createUser({
    email: String(email || '').toLowerCase(),
    password: password || TEMP_PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`createAuthUser: ${error.message}`);
  return data.user.id;
}

/** Reset an existing Supabase auth user's password + confirm email. */
async function resetPassword(authUserId, password = TEMP_PASSWORD) {
  if (!authUserId) return;
  if (!supabase.isConfigured()) throw notConfigured();
  const { error } = await supabase.adminClient().auth.admin.updateUserById(authUserId, {
    password: password || TEMP_PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`resetPassword: ${error.message}`);
}

/** Delete a Supabase auth user (cascades the linked profile when FK allows). Best-effort. */
async function deleteAuthUser(authUserId) {
  if (!authUserId) return;
  if (!supabase.isConfigured()) return;
  const { error } = await supabase.adminClient().auth.admin.deleteUser(authUserId, true);
  if (error) console.warn('[userProvision] deleteAuthUser skipped: ' + error.message);
}

module.exports = { createAuthUser, resetPassword, deleteAuthUser, TEMP_PASSWORD };
