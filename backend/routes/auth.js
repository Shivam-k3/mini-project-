const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const supabase = require('../services/supabase');
const { profileRepository, departmentRepository } = require('../repositories');
const { toApiUser } = require('../repositories/profileSerializer');

const router = express.Router();

/**
 * Resolve the authenticated request's profile-scoped tenant context from the
 * verified Supabase profile + bump first_login when required.
 */

/** Serialize a profile (resolving its department) into the API contract. */
async function serializeProfile(profile) {
  let dept = null;
  if (profile.department_id) {
    try {
      dept = await departmentRepository.findById(profile.department_id);
    } catch { dept = null; }
  }
  return toApiUser(profile, dept);
}

/**
 * Public self-registration — creates INDIVIDUAL users only (spec §1/§3).
 * Institutional accounts are provisioned by organization admins (college-admin
 * route), never here.
 *
 * Credential lives in Supabase Auth; application identity lives in
 * `public.profiles`. MongoDB is NOT written.
 */
router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2-80 characters'),
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0]?.msg || 'Invalid input' });
  }

  const { name, email, password } = req.body;
  const normalizedEmail = email.toLowerCase();

  // Sequential individual ID: IND0001, IND0002, ...
  let nextSeq = 1;
  try {
    const { data: last, error } = await supabase.profilesClient()
      .from('profiles')
      .select('user_id')
      .ilike('user_id', 'IND%')
      .order('created_at', { ascending: false })
      .limit(1);
    if (!error && last && last.length) {
      const m = /^IND(\d+)$/.exec(last[0].user_id || '');
      nextSeq = m ? (parseInt(m[1], 10) || 0) + 1 : 1;
    }
  } catch { nextSeq = 1; }
  const userId = `IND${String(nextSeq).padStart(4, '0')}`;

  let authUserId;
  try {
    const { data: created, error } = await supabase.adminClient().auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
    });
    if (error) {
      return res.status(400).json({ message: error.message || 'Registration failed' });
    }
    authUserId = created.user.id;
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Registration failed' });
  }

  const { data: profile, error: profileError } = await supabase.profilesClient()
    .from('profiles')
    .insert({
      auth_user_id: authUserId,
      user_id: userId,
      name,
      email: normalizedEmail,
      role: 'individual',
      organization_id: null,
      department_id: null,
      semester: '',
      section: '',
      first_login: false,
      status: 'active',
      profile: {},
      gamification: {},
    })
    .select('id, user_id, name, email, role, organization_id, department_id, semester, section, first_login, status, profile, gamification, created_at')
    .single();
  if (profileError) {
    try {
      await supabase.adminClient().auth.admin.deleteUser(authUserId);
    } catch { /* ignore */ }
    return res.status(400).json({ message: profileError.message || 'Registration failed' });
  }

  // Obtain a Supabase session.
  let session = null;
  let token = null;
  try {
    const { data: s, error } = await supabase.adminClient().auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (!error) {
      session = s?.session || null;
      token = session?.access_token || null;
    }
  } catch { /* fall through */ }

  const apiUser = await serializeProfile(profile);
  res.status(201).json({
    ...apiUser,
    ...(token ? { token } : {}),
    ...(session ? { session } : {}),
    ...(session ? { refresh_token: session.refresh_token } : {}),
  });
});

/**
 * Login — resolves an email OR user ID to an email, then authenticates against
 * Supabase Auth.
 */
router.post('/login', [
  body('emailOrUserId').notEmpty(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { emailOrUserId, password } = req.body;
  const value = String(emailOrUserId).trim();

  // Resolve a user_id (e.g. CSE25001) to its email; otherwise treat the value as an email.
  let email = value.toLowerCase();
  if (!value.includes('@')) {
    const byUserId = await profileRepository.findByUserId(value.toUpperCase())
      || await profileRepository.findByUserId(value);
    if (!byUserId) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    email = byUserId.email.toLowerCase();
  }

  let session = null;
  try {
    const { data, error } = await supabase.adminClient().auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    session = data.session || null;
  } catch {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const authUserId = session?.user?.id;
  const profile = authUserId ? await profileRepository.findByAuthUserId(authUserId) : null;
  if (!profile) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  if (profile.status === 'suspended') {
    return res.status(403).json({ message: 'Your account has been suspended' });
  }

  const apiUser = await serializeProfile(profile);
  res.json({
    ...apiUser,
    token: session?.access_token,
    ...(session ? { session } : {}),
    ...(session ? { refresh_token: session.refresh_token } : {}),
  });
});

router.post('/change-password', protect, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  // Update the credential in Supabase Auth (the single source of truth).
  const { error } = await supabase.adminClient().auth.admin.updateUserById(req.auth.authUserId, {
    password: newPassword,
  });
  if (error) {
    return res.status(400).json({ message: error.message || 'Failed to update password' });
  }

  // Clear firstLogin on the PG profile.
  await profileRepository.updateProfile(
    { profileId: req.auth.profile.id },
    { first_login: false }
  ).catch(() => {});

  res.json({ message: 'Password updated successfully' });
});

router.get('/me', protect, async (req, res) => {
  const profile = await profileRepository.findByAuthUserId(req.auth.authUserId);
  if (!profile) {
    return res.status(401).json({ message: 'User profile not found' });
  }
  res.json(await serializeProfile(profile));
});

router.put('/profile', protect, async (req, res) => {
  const { name, profile } = req.body;
  const changes = {};
  if (name) changes.name = String(name).slice(0, 80);
  if (profile && typeof profile === 'object') {
    const current = req.auth.profile?.profile || {};
    changes.profile = { ...current, ...profile };
  }
  let updated;
  try {
    updated = await profileRepository.updateProfile({ profileId: req.auth.profile.id }, changes);
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Failed to update profile' });
  }
  res.json(await serializeProfile(updated));
});

module.exports = router;
