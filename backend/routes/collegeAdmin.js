const express = require('express');
const { protect } = require('../middleware/auth');
const { tenancyContext, adminProfileRepository, organizationRepository, departmentRepository,
  challengeRepository, carbonRepository } = require('../repositories');
const { toApiChallenge } = require('../repositories/challengeSerializer');
const { toApiUser } = require('../repositories/profileSerializer');
const { toApiEntry } = require('../repositories/carbonSerializer');
const { getPredictions, trainEntityModel, predictEntityModel } = require('../utils/mlService');
const userProvision = require('../utils/userProvision');

const router = express.Router();

/**
 * Tenant + role for the authenticated request. Built from the VERIFIED Supabase
 * profile (req.auth.profile) — the canonical RBAC/tenancy source. Role /
 * org are never taken from req.body / req.query / URL params.
 * @throws {Error} status 401/403 on missing/invalid profile or role
 */
function actor(req) {
  if (req.auth?.profile) {
    const tenant = tenancyContext.fromProfile(req.auth.profile);
    return { tenant };
  }
  const e = new Error('Authenticated profile not available');
  e.status = 401;
  throw e;
}

const collegeAdminOnly = (req, res, next) => {
  try {
    const { tenant } = actor(req);
    const role = tenant.role;
    const orgId = tenant.organizationId;
    if (role !== 'college_admin') {
      return res.status(403).json({ message: 'College Admin access required' });
    }
    // Every query below is scoped by the org. An admin without one would
    // resolve scopes to `{ organizationId: null }` — the tenancy of
    // personal-mode users — so refuse rather than leak across the boundary.
    if (!orgId) {
      return res.status(403).json({ message: 'Account is not attached to an organization' });
    }
    req.actor = { tenant, orgId };
    return next();
  } catch (error) {
    return res.status(error.status || 403).json({ message: error.message });
  }
};

router.use(protect, collegeAdminOnly);

/** Lookup an authenticated tenant for downstream repos (throws 401/403). */
function tenantOf(req) {
  return req.actor.tenant;
}

function toApiDepartment(d) {
  return {
    _id: d.id,
    id: d.id,
    name: d.name,
    code: d.code,
    collegeId: d.organization_id || null,
    createdAt: d.created_at,
  };
}

async function deptLookup(tenant) {
  const depts = await departmentRepository.listByOrganization(tenant);
  return new Map(depts.map((d) => [d.id, d]));
}

// 1. Department CRUD --------------------------------------------------------
router.get('/departments', async (req, res) => {
  try {
    const tenant = tenantOf(req);
    const depts = await departmentRepository.listByOrganization(tenant);
    const sorted = [...depts].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
    res.json(sorted.map(toApiDepartment));
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/departments', async (req, res) => {
  const { name, code } = req.body;
  try {
    const tenant = tenantOf(req);
    if (!code) return res.status(400).json({ message: 'Department code is required.' });
    const exists = (await departmentRepository.listByOrganization(tenant))
      .find((d) => d.code === String(code).toUpperCase());
    if (exists) {
      return res.status(400).json({ message: `Department code ${code} already exists in this college.` });
    }
    const dept = await departmentRepository.create(tenant, { name, code: String(code).toUpperCase() });
    res.status(201).json(toApiDepartment(dept));
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
});

router.put('/departments/:id', async (req, res) => {
  const { name, code } = req.body;
  try {
    const tenant = tenantOf(req);
    const dept = await departmentRepository.findScoped(tenant, req.params.id);
    if (!dept) return res.status(404).json({ message: 'Department not found' });

    const changes = {};
    if (name) changes.name = name;
    if (code) {
      const exists = (await departmentRepository.listByOrganization(tenant))
        .find((d) => d.code === String(code).toUpperCase() && d.id !== req.params.id);
      if (exists) {
        return res.status(400).json({ message: `Department code ${code} already exists.` });
      }
      changes.code = String(code).toUpperCase();
    }
    const updated = await departmentRepository.update(tenant, req.params.id, changes);
    res.json(toApiDepartment(updated));
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
});

router.delete('/departments/:id', async (req, res) => {
  try {
    const tenant = tenantOf(req);
    const dept = await departmentRepository.findScoped(tenant, req.params.id);
    if (!dept) return res.status(404).json({ message: 'Department not found' });
    // Keep users but unset their department (mirrors Mongo $set departmentId:null)
    await adminProfileRepository.unsetDepartment(tenant, req.params.id);
    await departmentRepository.remove(tenant, req.params.id);
    res.json({ message: 'Department deleted successfully.' });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

// 2. User CRUD (Faculty and Students) ----------------------------------------
router.get('/users', async (req, res) => {
  const { role, search, departmentId } = req.query;
  try {
    const tenant = tenantOf(req);
    const rows = await adminProfileRepository.listByOrg(tenant, { role, search, departmentId });
    const depts = await deptLookup(tenant);
    res.json(rows.map((p) => toApiUser(p, depts.get(p.department_id) || null)));
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

// Create Single User (Student/Faculty)
router.post('/users', async (req, res) => {
  const { name, email, role, departmentId, semester, section } = req.body;
  try {
    const tenant = tenantOf(req);
    if (!['faculty', 'student'].includes(role)) {
      return res.status(400).json({ message: 'Only faculty or student accounts can be provisioned.' });
    }
    if (!name || !email) return res.status(400).json({ message: 'Name and email are required.' });

    if (await adminProfileRepository.emailExists(email)) {
      return res.status(400).json({ message: 'Email already exists.' });
    }

    // Auto-generate User ID
    const currentYear = new Date().getFullYear().toString().slice(-2);
    let generatedUserId = '';
    let resolvedDeptId = departmentId || null;

    if (role === 'student') {
      if (!departmentId) return res.status(400).json({ message: 'Department is required for student creation.' });
      const dept = await departmentRepository.findScoped(tenant, departmentId);
      if (!dept) return res.status(404).json({ message: 'Department not found' });
      resolvedDeptId = dept.id;
      const count = await adminProfileRepository.countByOrg(tenant, { role: 'student', departmentId: dept.id });
      const seq = String(count + 1).padStart(3, '0');
      generatedUserId = `${dept.code}${currentYear}${seq}`; // CSE26001
    } else if (role === 'faculty') {
      const count = await adminProfileRepository.countByOrg(tenant, { role: 'faculty' });
      const seq = String(count + 1).padStart(3, '0');
      generatedUserId = `FAC${seq}`; // FAC001
    }

    const depts = await deptLookup(tenant);
    // Provision the REAL Supabase auth identity first (profiles.auth_user_id is
    // NOT NULL + the canonical provisioning path creates an auth user), then the
    // PG profile, then the legacy Mongo bridge.
    const authUserId = await userProvision.createAuthUser(email);
    let profile;
    try {
      profile = await adminProfileRepository.create(tenant, {
        auth_user_id: authUserId,
        user_id: generatedUserId,
        name,
        email,
        role,
        departmentId: resolvedDeptId,
        semester: semester || '',
        section: section || '',
      });
    } catch (err) {
      await userProvision.deleteAuthUser(authUserId); // rollback orphan identity
      throw err;
    }

    res.status(201).json(toApiUser(profile, depts.get(profile.department_id) || null));
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
});

router.put('/users/:id', async (req, res) => {
  const { name, email, departmentId, semester, section, status } = req.body;
  try {
    const tenant = tenantOf(req);
    const existing = await adminProfileRepository.findScoped(tenant, req.params.id);
    if (!existing) return res.status(404).json({ message: 'User not found.' });

    const changes = {};
    if (name) changes.name = name;
    if (status) changes.status = status;
    if (semester !== undefined) changes.semester = semester;
    if (section !== undefined) changes.section = section;
    if (departmentId !== undefined) changes.departmentId = departmentId || null;
    if (email && String(email).toLowerCase() !== existing.email) {
      if (await adminProfileRepository.emailExists(email)) {
        return res.status(400).json({ message: 'Email already exists.' });
      }
      changes.email = email;
    }

    const updated = await adminProfileRepository.update(tenant, req.params.id, changes);
    if (!updated) return res.status(404).json({ message: 'User not found.' });
    const depts = await deptLookup(tenant);
    res.json(toApiUser(updated, depts.get(updated.department_id) || null));
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const tenant = tenantOf(req);
    const user = await adminProfileRepository.findScoped(tenant, req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    // Cascade delete carbon records (PG) then the profile, then the Supabase
    // auth identity and the legacy Mongo bridge.
    await carbonRepository.removeForUser(tenant, user.id);
    await adminProfileRepository.remove(tenant, req.params.id);
    await userProvision.deleteAuthUser(user.auth_user_id);
    res.json({ message: 'User and carbon data deleted.' });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

// Reset Password
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const tenant = tenantOf(req);
    const user = await adminProfileRepository.findScoped(tenant, req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    await adminProfileRepository.update(tenant, req.params.id, { first_login: true, status: user.status });

    // Rotate the SUPABASE password (the real auth identity).
    await userProvision.resetPassword(user.auth_user_id);

    res.json({ message: 'Password reset to Temp@123' });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

// Import Students via CSV Text
router.post('/users/import-csv', async (req, res) => {
  const { csvText } = req.body;
  if (!csvText) return res.status(400).json({ message: 'No CSV data provided.' });

  try {
    const tenant = tenantOf(req);
    const lines = String(csvText).split(/\r?\n/);
    const results = [];
    const errors = [];
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const deptsByCode = new Map((await departmentRepository.listByOrganization(tenant)).map((d) => [d.code, d]));

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (i === 0 && line.toLowerCase().includes('name') && line.toLowerCase().includes('email')) continue;

      const parts = line.split(',');
      if (parts.length < 3) {
        errors.push(`Row ${i + 1}: Invalid layout. Must contain Name, Email, DepartmentCode.`);
        continue;
      }

      const name = parts[0]?.trim();
      const email = parts[1]?.trim();
      const deptCode = parts[2]?.trim()?.toUpperCase();
      const semester = parts[3]?.trim() || '';
      const section = parts[4]?.trim() || '';

      if (!name || !email || !deptCode) {
        errors.push(`Row ${i + 1}: Missing required fields.`);
        continue;
      }
      if (await adminProfileRepository.emailExists(email)) {
        errors.push(`Row ${i + 1} (${email}): Email already registered.`);
        continue;
      }
      const dept = deptsByCode.get(deptCode);
      if (!dept) {
        errors.push(`Row ${i + 1}: Department ${deptCode} not found in this college.`);
        continue;
      }

      const count = await adminProfileRepository.countByOrg(tenant, { role: 'student', departmentId: dept.id });
      const seq = String(count + 1 + results.filter((r) => r.deptId === dept.id).length).padStart(3, '0');
      const generatedUserId = `${dept.code}${currentYear}${seq}`;

      let authUserId;
      try {
        authUserId = await userProvision.createAuthUser(email);
      } catch (err) {
        errors.push(`Row ${i + 1} (${email}): could not provision auth identity (${err.message})`);
        continue;
      }
      let profile;
      try {
        profile = await adminProfileRepository.create(tenant, {
          auth_user_id: authUserId, user_id: generatedUserId, name, email,
          role: 'student', departmentId: dept.id, semester, section,
        });
      } catch (err) {
        await userProvision.deleteAuthUser(authUserId);
        errors.push(`Row ${i + 1} (${email}): could not create profile (${err.message})`);
        continue;
      }
      results.push({ ...toApiUser(profile, { id: dept.id, name: dept.name, code: dept.code }), deptId: dept.id });
    }

    res.json({ success: true, importedCount: results.length, errors });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

// 3. College Challenges ------------------------------------------------------
router.get('/challenges', async (req, res) => {
  try {
    const tenant = tenantOf(req);
    const challenges = await challengeRepository.listAll({ organizationId: tenant.organizationId });
    res.json(challenges.map(toApiChallenge));
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/challenges', async (req, res) => {
  const { title, description, category, points, targetReduction, duration, badge } = req.body;
  try {
    const tenant = tenantOf(req);
    const newCh = await challengeRepository.create(tenant, {
      title,
      description,
      category: category || 'general',
      points: points || 50,
      targetReduction: targetReduction || 10,
      duration: duration || 7,
      badge: badge || '',
      departmentId: null, // College-wide
    });
    res.status(201).json(toApiChallenge(newCh));
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
});

// 4. Campus Analytics --------------------------------------------------------
router.get('/analytics/campus', async (req, res) => {
  try {
    const tenant = tenantOf(req);
    const students = await adminProfileRepository.listByOrg(tenant, { role: 'student' });
    const studentIds = students.map((s) => s.id);

    const totalStudents = students.length;
    const totalFaculty = await adminProfileRepository.countByOrg(tenant, { role: 'faculty' });
    const activeUsers = await adminProfileRepository.countByOrg(tenant, { status: 'active' });

    // Campus emissions (sum of student-owned entries) and 30/60-day windows.
    const allEntries = await carbonRepository.listByUserIds(tenant, studentIds);
    const byDate = (from) => (e) => new Date(e.date) >= from;
    const now = new Date();
    const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
    const d60 = new Date(now); d60.setDate(d60.getDate() - 60);
    const recent = allEntries.filter((e) => new Date(e.date) >= d30);
    const prev = allEntries.filter((e) => new Date(e.date) >= d60 && new Date(e.date) < d30);
    const sumOf = (rows) => rows.reduce((s, e) => s + (Number(e.total_emissions) || 0), 0);
    const campusEmissions = sumOf(allEntries);

    let monthlyReduction = null;
    let monthlyReductionNote = 'Insufficient data in both periods to compute a trend.';
    if (recent.length > 0 && prev.length > 0 && sumOf(prev) > 0) {
      monthlyReduction = Math.round(((sumOf(prev) - sumOf(recent)) / sumOf(prev)) * 1000) / 10;
      monthlyReductionNote = 'Derived from total logged emissions: last 30 days vs previous 30 days.';
    }

    const readEco = (p) => Number(p.gamification?.ecoScore) || 50;
    const campusEcoScore = totalStudents > 0
      ? Math.round(students.reduce((acc, s) => acc + readEco(s), 0) / totalStudents)
      : 50;

    // Department Comparison (students + their emissions per dept).
    const depts = await departmentRepository.listByOrganization(tenant);
    const deptComparison = await Promise.all(depts.map(async (d) => {
      const deptStudents = students.filter((s) => s.department_id === d.id);
      const deptIds = deptStudents.map((s) => s.id);
      const deptRows = deptIds.length ? await carbonRepository.listByUserIds(tenant, deptIds) : [];
      return {
        department: d.code,
        name: d.name,
        emissions: sumOf(deptRows),
        userCount: deptStudents.length,
      };
    }));

    // Monthly Trend (latest 6 months ascending).
    const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const trendMap = new Map();
    allEntries.forEach((e) => {
      const k = monthKey(new Date(e.date));
      trendMap.set(k, (trendMap.get(k) || 0) + (Number(e.total_emissions) || 0));
    });
    const monthlyTrend = [...trendMap.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-6)
      .map(([month, emissions]) => ({ month, emissions: Math.round(emissions * 100) / 100 }));

    // Student Participation Rate.
    const loggedIds = await adminProfileRepository.distinctLoggedStudentIds(tenant, studentIds);
    const participationRate = totalStudents > 0 ? Math.round((loggedIds.length / totalStudents) * 100) : 0;

    // Top Contributors (Leaderboard by greenPoints).
    const topContributors = [...students]
      .sort((a, b) => (Number(b.gamification?.greenPoints) || 0) - (Number(a.gamification?.greenPoints) || 0))
      .slice(0, 5)
      .map((s) => ({
        name: s.name,
        userId: s.user_id,
        points: Number(s.gamification?.greenPoints) || 0,
        ecoScore: readEco(s),
      }));

    res.json({
      totalStudents,
      totalFaculty,
      activeUsers,
      campusEmissions,
      monthlyReduction,
      monthlyReductionNote,
      campusEcoScore,
      deptComparison,
      monthlyTrend,
      participationRate,
      topContributors,
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

// 5. Campus-level ML Predictions ----------------------------------------------
router.get('/analytics/campus/predictions', async (req, res) => {
  try {
    const tenant = tenantOf(req);
    const entityId = req.actor.tenant ? req.actor.tenant.organizationId : req.actor.legacy.collegeId;
    if (!entityId) return res.status(403).json({ message: 'Account is not attached to an organization' });

    const students = await adminProfileRepository.listByOrg(tenant, { role: 'student' });
    const studentIds = students.map((s) => s.id);
    if (studentIds.length === 0) {
      return res.json({ predictions: null, message: 'No students in this college yet.' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const rows = await carbonRepository.listByUserIds(tenant, studentIds, { from: thirtyDaysAgo.toISOString() });
    const entries = rows.map(toApiEntry).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 200);

    if (entries.length < 3) {
      return res.json({ predictions: null, message: 'Insufficient campus data for predictions (need 3+ entries).', entryCount: entries.length });
    }

    const latestEntry = entries[0];
    const trainResult = await trainEntityModel('college', String(entityId), entries);
    if (!trainResult.trained) {
      return res.json({ predictions: null, message: 'Model training failed.', trainResult });
    }
    const predictions = await predictEntityModel('college', String(entityId), latestEntry);
    res.json({ predictions, trainingMetrics: trainResult.metrics, featureImportance: trainResult.featureImportance, studentCount: studentIds.length, entryCount: entries.length });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

module.exports = router;
