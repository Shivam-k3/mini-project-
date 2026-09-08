const express = require('express');
const { protect } = require('../middleware/auth');
const { tenancyContext, adminProfileRepository, departmentRepository, challengeRepository,
  carbonRepository } = require('../repositories');
const { toApiChallenge } = require('../repositories/challengeSerializer');
const { toApiEntry } = require('../repositories/carbonSerializer');
const { trainEntityModel, predictEntityModel } = require('../utils/mlService');

const router = express.Router();

/**
 * Tenant + role for the authenticated request. Built from the VERIFIED Supabase
 * profile (req.auth.profile) — the canonical RBAC/tenancy source. Role /
 * org / department are never taken from req.body / req.query / URL params.
 */
function actor(req) {
  if (req.auth?.profile) {
    return { tenant: tenancyContext.fromProfile(req.auth.profile) };
  }
  const e = new Error('Authenticated profile not available');
  e.status = 401;
  throw e;
}

const facultyOnly = (req, res, next) => {
  try {
    const { tenant } = actor(req);
    const role = tenant.role;
    const orgId = tenant.organizationId;
    if (role !== 'faculty') {
      return res.status(403).json({ message: 'Faculty access required' });
    }
    // Faculty is an organization role by definition. Without an org the scopes
    // below collapse to `{ organizationId: null }` — the tenancy of personal
    // mode — so refuse rather than leak across the boundary. (A null department
    // IS legitimate here; the per-route guards answer 400 for it.)
    if (!orgId) {
      return res.status(403).json({ message: 'Account is not attached to an organization' });
    }
    req.actor = { tenant, orgId };
    return next();
  } catch (error) {
    return res.status(error.status || 403).json({ message: error.message });
  }
};

router.use(protect, facultyOnly);

function tenantOf(req) {
  return req.actor.tenant;
}

// 1. Department Analytics -----------------------------------------------------
router.get('/analytics/department', async (req, res) => {
  try {
    const tenant = tenantOf(req);
    if (!tenant.departmentId) {
      return res.status(400).json({ message: 'Faculty not assigned to any department.' });
    }

    const dept = await departmentRepository.findById(tenant.departmentId);
    const students = await adminProfileRepository.listStudentsByDept(tenant);
    const studentIds = students.map((s) => s.id);

    const rows = studentIds.length ? await carbonRepository.listByUserIds(tenant, studentIds) : [];
    const totalEmissions = rows.reduce((s, e) => s + (Number(e.total_emissions) || 0), 0);

    const readEco = (p) => Number(p.gamification?.ecoScore) || 50;
    const avgEcoScore = students.length > 0
      ? Math.round(students.reduce((acc, s) => acc + readEco(s), 0) / students.length)
      : 50;

    // Monthly mode breakdown: sum occupancy-allocated per-mode kg (mirrors the
    // Mongo objectToArray/unwind/group over `modeBreakdown`).
    const categoryTotals = {};
    rows.forEach((e) => {
      const mb = e.mode_breakdown || {};
      Object.entries(mb).forEach(([k, v]) => {
        const n = Number(v);
        if (n > 0) categoryTotals[k] = (categoryTotals[k] || 0) + n;
      });
    });
    Object.keys(categoryTotals).forEach((k) => { categoryTotals[k] = Math.round(categoryTotals[k] * 100) / 100; });

    res.json({
      departmentName: dept?.name || 'Assigned Department',
      studentCount: students.length,
      totalEmissions,
      avgEcoScore,
      categoryTotals,
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

// 2. Student Participation Monitor -------------------------------------------
router.get('/students/participation', async (req, res) => {
  try {
    const tenant = tenantOf(req);
    if (!tenant.departmentId) {
      return res.status(400).json({ message: 'Faculty not assigned to any department.' });
    }

    const students = await adminProfileRepository.listStudentsByDept(tenant);
    const studentIds = students.map((s) => s.id);

    // Newest-first rows for these students (single fetch); first occurrence per
    // student is their latest entry date.
    const rows = studentIds.length ? await carbonRepository.listByUserIds(tenant, studentIds) : [];
    const latestByStudent = new Map();
    rows.forEach((e) => {
      if (!latestByStudent.has(e.user_id)) latestByStudent.set(e.user_id, e.date);
    });
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    const results = students.map((s) => {
      const lastLogged = latestByStudent.get(s.id) || null;
      const loggedThisWeek = lastLogged ? (Date.now() - new Date(lastLogged).getTime()) < weekMs : false;
      return {
        _id: s.id,
        name: s.name,
        userId: s.user_id,
        email: s.email,
        status: s.status,
        ecoScore: Number(s.gamification?.ecoScore) || 0,
        greenPoints: Number(s.gamification?.greenPoints) || 0,
        streak: Number(s.gamification?.streak) || 0,
        lastLogged,
        loggedThisWeek,
      };
    })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    res.json(results);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

// 3. Department Scoped Challenges ----------------------------------------------
router.get('/challenges', async (req, res) => {
  try {
    const tenant = tenantOf(req);
    if (!tenant.departmentId) return res.json([]);
    const all = await challengeRepository.listAll({ organizationId: tenant.organizationId });
    const dept = all.filter((c) => c.organization_id === tenant.organizationId && c.department_id === tenant.departmentId);
    res.json(dept.map(toApiChallenge));
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/challenges', async (req, res) => {
  const { title, description, category, points, targetReduction, duration, badge } = req.body;
  try {
    const tenant = tenantOf(req);
    if (!tenant.departmentId) {
      return res.status(400).json({ message: 'Faculty not assigned to any department.' });
    }
    const newCh = await challengeRepository.create(tenant, {
      title,
      description,
      category: category || 'general',
      points: points || 50,
      targetReduction: targetReduction || 10,
      duration: duration || 7,
      badge: badge || '',
      departmentId: tenant.departmentId,
    });
    res.status(201).json(toApiChallenge(newCh));
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
});

// 4. Department-level ML Predictions -------------------------------------------
router.get('/analytics/department/predictions', async (req, res) => {
  try {
    const tenant = tenantOf(req);
    if (!tenant.departmentId) {
      return res.status(400).json({ message: 'Faculty not assigned to any department.' });
    }
    const entityId = tenant.departmentId;

    const students = await adminProfileRepository.listStudentsByDept(tenant);
    const studentIds = students.map((s) => s.id);
    if (studentIds.length === 0) {
      return res.json({ predictions: null, message: 'No students in this department yet.' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const rows = await carbonRepository.listByUserIds(tenant, studentIds, { from: thirtyDaysAgo.toISOString() });
    const entries = rows.map(toApiEntry).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 200);

    if (entries.length < 3) {
      return res.json({ predictions: null, message: 'Insufficient department data for predictions (need 3+ entries).', entryCount: entries.length });
    }

    const latestEntry = entries[0];
    const trainResult = await trainEntityModel('department', String(entityId), entries);
    if (!trainResult.trained) {
      return res.json({ predictions: null, message: 'Model training failed.', trainResult });
    }
    const predictions = await predictEntityModel('department', String(entityId), latestEntry);
    res.json({ predictions, trainingMetrics: trainResult.metrics, featureImportance: trainResult.featureImportance, studentCount: studentIds.length, entryCount: entries.length });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

module.exports = router;
