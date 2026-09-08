/**
 * Shared server-side Supabase PostgreSQL client for the repository/data-access
 * layer (Phase 3A).
 *
 * The backend connects with the SERVICE/ SECRET key, which BYPASSES RLS. RLS
 * remains a defense-in-depth perimeter for any future direct-DB client; the
 * repository layer is explicitly responsible for enforcing tenancy (the Express
 * app is the real authorization boundary).
 *
 * SECURITY:
 *   * SUPABASE_SECRET_KEY is read from process.env only. It is never inferred
 *     from request input, never logged, and never exposed to the frontend.
 *   * This module must never depend on a client-supplied value to pick a key.
 *
 * This mirrors services/supabase.js but is dedicated to data access (not auth),
 * so repository modules can depend on one clear seam.
 */
const { createClient } = require('@supabase/supabase-js');

let _client = null;

/** Lazy, memoized admin client (service/ secret key, RLS bypass). */
function client() {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required for the repository layer');
    }
    _client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _client;
}

function isConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

module.exports = { client, isConfigured };
