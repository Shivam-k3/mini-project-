const express = require('express');
const { protect } = require('../middleware/auth');
const { organizationRepository, announcementRepository } = require('../repositories');
const { client } = require('../repositories/supabaseClient');
const userProvision = require('../utils/userProvision');

const router = express.Router();

const PROFILE_COLUMNS =
  'id, auth_user_id, user_id, name, email, role, organization_id, department_id, semester, section, first_login, status, profile, gamification, created_at, updated_at';

const superAdminOnly = (req, res, next) => {
  if (req.auth?.profile?.role !== 'super_admin') {
    return res.status(403).json({ message: 'Super Admin access required' });
  }
  next();
};

router.use(protect, superAdminOnly);

const round = (value, decimals = 2) => {
  const n = Number(value) || 0;
  const p = Math.pow(10, decimals);
  return Math.round(n * p) / p;
};

// 1. College CRUD
router.get('/colleges', async (req, res) => {
  try {
    const colleges = await organizationRepository.list();
    const results = await Promise.all(colleges.map(async (c) => {
      const admin = await adminOfOrg(c.id);
      const studentCount = await countProfilesByOrg(c.id, 'student');
      const facultyCount = await countProfilesByOrg(c.id, 'faculty');
      return {
        _id: c.id,
        id: c.id,
        name: c.name,
        code: c.code,
        address: c.address,
        license: c.license,
        status: c.status,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        admin,
        studentCount,
        facultyCount,
      };
    }));
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/colleges', async (req, res) => {
  const { name, code, address, plan, expiresAt } = req.body;
  try {
    const existing = await organizationRepository.findByCode(String(code || '').toUpperCase());
    if (existing) {
      return res.status(400).json({ message: `College code ${code} already exists.` });
    }
    const college = await organizationRepository.create({
      name,
      code: String(code || '').toUpperCase(),
      address: address || '',
      license: {
        plan: plan || 'Standard',
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
      status: 'active',
    });
    res.status(201).json(college);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/colleges/:id', async (req, res) => {
  const { name, address, plan, expiresAt, status } = req.body;
  try {
    const college = await organizationRepository.findById(req.params.id);
    if (!college) return res.status(404).json({ message: 'College not found' });

    const changes = {};
    if (name) changes.name = name;
    if (address !== undefined) changes.address = address;
    if (status) changes.status = status;
    if (plan || expiresAt) {
      changes.license = {
        ...(college.license || {}),
        plan: plan || college.license?.plan,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : college.license?.expiresAt,
      };
    }
    const updated = await organizationRepository.update(req.params.id, changes);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/colleges/:id', async (req, res) => {
  try {
    const college = await organizationRepository.findById(req.params.id);
    if (!college) return res.status(404).json({ message: 'College not found' });

    // Cascade: remove Supabase auth identities for the org's members (best-effort).
    const members = await listProfilesByOrg(req.params.id);
    for (const m of members) {
      if (m.auth_user_id) await userProvision.deleteAuthUser(m.auth_user_id);
    }

    // Deleting the organization cascades to departments, profiles, carbon
    // entries, announcements and challenges via the schema FKs.
    await client().from('organizations').delete().eq('id', req.params.id);

    res.json({ message: 'College and all related departments, users, and activities deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Provision College Admin
router.post('/colleges/:id/admin', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const college = await organizationRepository.findById(req.params.id);
    if (!college) return res.status(404).json({ message: 'College not found' });

    const existingAdmin = await orgCollegeAdmin(req.params.id);
    if (existingAdmin) {
      return res.status(400).json({ message: 'College Admin already exists. Please edit the existing user instead.' });
    }

    const emailExists = await emailRegistered(String(email || '').toLowerCase());
    if (emailExists) {
      return res.status(400).json({ message: 'Email already registered.' });
    }

    // Determine sequential ADMIN id
    const adminCount = await countProfilesWithPattern('ADMIN%');
    const userId = `ADMIN${String(adminCount + 1).padStart(3, '0')}`;

    // Create the Supabase auth identity first (profiles.auth_user_id NOT NULL).
    let authUserId;
    try {
      authUserId = await userProvision.createAuthUser(email, password || userProvision.TEMP_PASSWORD);
    } catch (e) {
      return res.status(400).json({ message: e.message || 'Failed to create auth identity' });
    }

    const { data: profile, error } = await client()
      .from('profiles')
      .insert({
        auth_user_id: authUserId,
        user_id: userId,
        name,
        email: String(email || '').toLowerCase(),
        role: 'college_admin',
        organization_id: college.id,
        department_id: null,
        semester: '',
        section: '',
        first_login: true,
        status: 'active',
        profile: {},
        gamification: {},
      })
      .select(PROFILE_COLUMNS)
      .single();
    if (error) {
      await userProvision.deleteAuthUser(authUserId);
      return res.status(400).json({ message: error.message || 'Failed to create college admin' });
    }

    res.status(201).json({
      _id: profile.id,
      id: profile.id,
      userId: profile.user_id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      collegeId: profile.organization_id,
      firstLogin: profile.first_login,
      status: profile.status,
      createdAt: profile.created_at,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 3. Global Analytics
router.get('/analytics/global', async (req, res) => {
  try {
    const totalColleges = await countOrganizations();
    const totalStudents = await countProfilesByRole('student');
    const totalFaculty = await countProfilesByRole('faculty');
    const activeUsers = await countProfilesByStatus('active');

    const totalEmissions = await sumAllEmissions();

    const avgEcoScoreResult = await avgEcoForRole('student');
    const overallEcoScore = Math.round(avgEcoScoreResult || 50);

    res.json({
      totalColleges,
      totalStudents,
      totalFaculty,
      activeUsers,
      totalCarbonEmissions: round(totalEmissions, 2),
      overallEcoScore,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 4. College Comparison Analytics & Rankings
router.get('/analytics/colleges-compare', async (req, res) => {
  try {
    const colleges = await organizationRepository.list({ status: 'active' });
    const comparisons = await Promise.all(colleges.map(async (c) => {
      const members = await listProfilesByOrg(c.id);
      const students = members.filter((p) => p.role === 'student');
      const userCount = members.length;

      const emissions = await sumEmissionsByOrg(c.id);
      const avgEco = students.length > 0
        ? Math.round(students.reduce((acc, s) => acc + (Number(s.gamification?.ecoScore) || 50), 0) / students.length)
        : 50;

      return {
        collegeId: c.id,
        _id: c.id,
        name: c.name,
        code: c.code,
        userCount,
        emissions: round(emissions, 1),
        ecoScore: avgEco,
      };
    }));

    const rankings = [...comparisons].sort((a, b) => b.ecoScore - a.ecoScore);
    res.json({ comparisons, topColleges: rankings.slice(0, 10) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 5. Announcements (platform-wide = organization_id NULL)
router.get('/announcements', async (req, res) => {
  try {
    const { data, error } = await client()
      .from('announcements')
      .select('id, title, content, organization_id, created_by, created_at, updated_at')
      .is('organization_id', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = data || [];

    // Join creator names (platform-wide).
    const creatorIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))];
    const profiles = creatorIds.length
      ? await client().from('profiles').select('id, name')
      : { data: [] };
    const nameById = new Map((profiles.data || []).map((p) => [p.id, p.name]));

    const announcements = rows.map((r) => ({
      _id: r.id,
      id: r.id,
      title: r.title,
      content: r.content,
      collegeId: null,
      createdBy: r.created_by,
      author: { _id: r.created_by, name: nameById.get(r.created_by) || '' },
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    res.json(announcements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/announcements', async (req, res) => {
  const { title, content } = req.body;
  try {
    const created = await announcementRepository.create(req.auth.tenant, { title, content });
    res.status(201).json({
      _id: created.id,
      id: created.id,
      title: created.title,
      content: created.content,
      collegeId: null,
      createdBy: created.created_by,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ---------------------------------------------------------------- helpers ----

async function countOrganizations() {
  const { count, error } = await client().from('organizations').select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count;
}

async function countProfilesByRole(role) {
  const { count, error } = await client().from('profiles').select('*', { count: 'exact', head: true }).eq('role', role);
  if (error) throw error;
  return count;
}

async function countProfilesByStatus(status) {
  const { count, error } = await client().from('profiles').select('*', { count: 'exact', head: true }).eq('status', status);
  if (error) throw error;
  return count;
}

async function countProfilesWithPattern(pattern) {
  let q = client().from('profiles').select('*', { count: 'exact', head: true });
  if (pattern.endsWith('%')) {
    // PostgREST uses .like with a literal % wildcard pattern.
    const { count, error } = await client().from('profiles').select('user_id', { count: 'exact', head: true }).like('user_id', pattern);
    if (error) throw error;
    return count;
  }
  const { count, error } = await q.eq('user_id', pattern);
  if (error) throw error;
  return count;
}

async function countProfilesByOrg(orgId, role) {
  let q = client().from('profiles').select('*', { count: 'exact', head: true }).eq('organization_id', orgId);
  if (role) q = q.eq('role', role);
  const { count, error } = await q;
  if (error) throw error;
  return count;
}

async function listProfilesByOrg(orgId) {
  const { data, error } = await client().from('profiles').select(PROFILE_COLUMNS).eq('organization_id', orgId);
  if (error) throw error;
  return data || [];
}

async function adminOfOrg(orgId) {
  const { data, error } = await client()
    .from('profiles')
    .select('id, user_id, name, email, role, status')
    .eq('organization_id', orgId)
    .eq('role', 'college_admin')
    .limit(1);
  if (error) throw error;
  const row = data && data.length ? data[0] : null;
  if (!row) return null;
  return { _id: row.id, id: row.id, userId: row.user_id, name: row.name, email: row.email, status: row.status };
}

async function orgCollegeAdmin(orgId) {
  const { data, error } = await client()
    .from('profiles')
    .select('id')
    .eq('organization_id', orgId)
    .eq('role', 'college_admin')
    .limit(1);
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

async function emailRegistered(email) {
  const { data, error } = await client().from('profiles').select('id').eq('email', email).limit(1);
  if (error) throw error;
  return data && data.length > 0;
}

async function sumAllEmissions() {
  const { data, error } = await client().from('carbon_entries').select('total_emissions');
  if (error) throw error;
  return (data || []).reduce((s, r) => s + (Number(r.total_emissions) || 0), 0);
}

async function sumEmissionsByOrg(orgId) {
  const { data, error } = await client()
    .from('carbon_entries')
    .select('total_emissions')
    .eq('organization_id', orgId);
  if (error) throw error;
  return (data || []).reduce((s, r) => s + (Number(r.total_emissions) || 0), 0);
}

async function avgEcoForRole(role) {
  const { data, error } = await client().from('profiles').select('gamification').eq('role', role);
  if (error) throw error;
  const rows = data || [];
  if (!rows.length) return 0;
  return rows.reduce((s, r) => s + (Number(r.gamification?.ecoScore) || 0), 0) / rows.length;
}

module.exports = router;
