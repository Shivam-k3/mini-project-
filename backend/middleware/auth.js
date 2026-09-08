/**
 * Authentication middleware (Phase 3H — legacy auth fully removed).
 *
 * Supabase Auth is the SOLE authentication mechanism. `protect`:
 *   1. requires a `Bearer <supabase-access-token>`
 *   2. verifies it via Supabase (`getUser`) — malformed/expired/bogus -> 401
 *   3. loads the application profile from `public.profiles` by auth_user_id
 *      (the verified Supabase auth user id) — missing profile -> 401
 *   4. enforces active status (suspended/invalid -> 403)
 *   5. builds `req.user` from the verified PostgreSQL profile (never from the
 *      request body/query), so existing routes reading
 *      `req.user.name/.role/.gamification/.collegeId/.departmentId/.userId/.email`
 *      keep working unchanged — now sourced from PostgreSQL.
 *
 * NO legacy-JWT path. NO bcrypt. NO Mongo bridge.
 */
const supabase = require('../services/supabase');
const { profileRepository, tenancyContext } = require('../repositories');

async function protect(req, res, next) {
  // Idempotent: per-user rate limiters are mounted behind `protect` so their key
  // generator can see req.user, and each route re-declares `protect`.
  if (req.user) return next();

  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  let authUser;
  try {
    authUser = await supabase.verifyToken(token);
  } catch {
    return res.status(401).json({ message: 'Not authorized, invalid token' });
  }
  if (!authUser?.id) {
    return res.status(401).json({ message: 'Not authorized, invalid token' });
  }

  let profile;
  try {
    profile = await profileRepository.findByAuthUserId(authUser.id);
  } catch {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
  if (!profile) {
    // First authenticated application session for a valid Supabase identity that
    // has no application profile yet (e.g. a fresh Google OAuth sign-in that
    // created an `auth.users` row but no `public.profiles` row). Provision a
    // PERSONAL profile idempotently so the app can recognize the account.
    // ensurePersonalProfile is race-safe: if a concurrent first-login already
    // created the row it is returned untouched (role/org/dept/data preserved).
    try {
      const name = authUser.user_metadata?.full_name
        || authUser.user_metadata?.name
        || (authUser.email ? authUser.email.split('@')[0] : '');
      const provisioned = await profileRepository.ensurePersonalProfile(
        authUser.id,
        { email: authUser.email, name }
      );
      profile = provisioned.profile;
    } catch {
      profile = null;
    }
    if (!profile) {
      return res.status(401).json({ message: 'User profile not found' });
    }
  }

  if (profile.status === 'suspended') {
    return res.status(403).json({ message: 'Your account has been suspended' });
  }
  if (profile.status && !['active', 'suspended'].includes(profile.status)) {
    return res.status(403).json({ message: 'Account has an invalid status' });
  }

  req.auth = {
    authUserId: authUser.id,
    profile,
    tenant: tenancyContext.fromProfile(profile),
    provider: 'supabase',
  };

  // Profile-shaped `req.user` so downstream routes keep their existing reads,
  // but the data now comes from PostgreSQL `profiles`, never MongoDB.
  req.user = {
    _id: profile.id,
    userId: profile.user_id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    collegeId: profile.organization_id || null,
    departmentId: profile.department_id || null,
    semester: profile.semester || '',
    section: profile.section || '',
    firstLogin: profile.first_login,
    status: profile.status,
    profile: profile.profile || {},
    gamification: profile.gamification || {},
    authUserId: authUser.id,
  };

  return next();
}

/** Legacy `admin` guard kept for any residual callers (role 'admin' no longer used). */
const admin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

module.exports = { protect, admin };
