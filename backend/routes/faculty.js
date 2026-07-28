const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Challenge = require('../models/Challenge');
const CarbonEntry = require('../models/CarbonEntry');
const Department = require('../models/Department');
const { getPredictions, trainEntityModel, predictEntityModel } = require('../utils/mlService');

const router = express.Router();

const facultyOnly = (req, res, next) => {
  if (req.user?.role !== 'faculty') {
    return res.status(403).json({ message: 'Faculty access required' });
  }
  next();
};

router.use(protect, facultyOnly);

// 1. Department Analytics
router.get('/analytics/department', async (req, res) => {
  try {
    if (!req.user.departmentId) {
      return res.status(400).json({ message: 'Faculty not assigned to any department.' });
    }

    const dept = await Department.findById(req.user.departmentId);
    const students = await User.find({ departmentId: req.user.departmentId, role: 'student' });
    const studentIds = students.map(s => s._id);

    // Total emissions in department
    const emissionsResult = await CarbonEntry.aggregate([
      { $match: { user: { $in: studentIds } } },
      { $group: { _id: null, total: { $sum: '$totalEmissions' } } }
    ]);
    const totalEmissions = emissionsResult[0]?.total || 0;

    // Average Eco Score in department
    const avgEcoScore = students.length > 0
      ? Math.round(students.reduce((acc, s) => acc + (s.gamification?.ecoScore || 50), 0) / students.length)
      : 50;

    // Monthly category breakdown in department
    const categoryTotals = await CarbonEntry.aggregate([
      { $match: { user: { $in: studentIds } } },
      {
        $group: {
          _id: null,
          transport: { $sum: '$breakdown.transport' },
          electricity: { $sum: '$breakdown.electricity' },
          water: { $sum: '$breakdown.water' },
          food: { $sum: '$breakdown.food' },
          shopping: { $sum: '$breakdown.shopping' },
          waste: { $sum: '$breakdown.waste' },
        }
      }
    ]);

    res.json({
      departmentName: dept?.name || 'Assigned Department',
      studentCount: students.length,
      totalEmissions,
      avgEcoScore,
      categoryTotals: categoryTotals[0] || {}
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Student Participation Monitor
router.get('/students/participation', async (req, res) => {
  try {
    if (!req.user.departmentId) {
      return res.status(400).json({ message: 'Faculty not assigned to any department.' });
    }

    const students = await User.find({ departmentId: req.user.departmentId, role: 'student' })
      .select('name userId gamification email status')
      .sort({ name: 1 });

    const results = await Promise.all(students.map(async (s) => {
      // Find latest logged entry date
      const latestEntry = await CarbonEntry.findOne({ user: s._id }).sort({ date: -1 });
      const lastLogged = latestEntry ? latestEntry.date : null;
      
      // Logged this week? (within 7 days)
      const loggedThisWeek = lastLogged 
        ? (Date.now() - new Date(lastLogged).getTime()) < 7 * 24 * 60 * 60 * 1000
        : false;

      return {
        _id: s._id,
        name: s.name,
        userId: s.userId,
        email: s.email,
        status: s.status,
        ecoScore: s.gamification?.ecoScore || 0,
        greenPoints: s.gamification?.greenPoints || 0,
        streak: s.gamification?.streak || 0,
        lastLogged,
        loggedThisWeek
      };
    }));

    res.json(results);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 3. Department Scoped Challenges
router.get('/challenges', async (req, res) => {
  try {
    const challenges = await Challenge.find({ 
      collegeId: req.user.collegeId,
      departmentId: req.user.departmentId
    }).sort({ createdAt: -1 });
    res.json(challenges);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/challenges', async (req, res) => {
  const { title, description, category, points, targetReduction, duration, badge } = req.body;
  try {
    if (!req.user.departmentId) {
      return res.status(400).json({ message: 'Faculty not assigned to any department.' });
    }

    const newCh = await Challenge.create({
      title,
      description,
      category: category || 'general',
      points: points || 50,
      targetReduction: targetReduction || 10,
      duration: duration || 7,
      badge: badge || '',
      collegeId: req.user.collegeId,
      departmentId: req.user.departmentId
    });
    res.status(201).json(newCh);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 4. Department-level ML Predictions
// Aggregates all student carbon entries in the faculty's department, trains a
// department model, and returns entity-level forecasts.
// Model is cached as: models/carbon_model_department_<departmentId>.pkl
router.get('/analytics/department/predictions', async (req, res) => {
  try {
    if (!req.user.departmentId) {
      return res.status(400).json({ message: 'Faculty not assigned to any department.' });
    }

    // Step 1: find all students in this department
    const students = await User.find({ departmentId: req.user.departmentId, role: 'student' });
    const studentIds = students.map(s => s._id);

    if (studentIds.length === 0) {
      return res.json({
        predictions: null,
        message: 'No students in this department yet.',
      });
    }

    // Step 2: fetch their carbon entries (recent 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const entries = await CarbonEntry.find({
      user: { $in: studentIds },
      date: { $gte: thirtyDaysAgo },
    })
      .sort({ date: -1 })
      .limit(200);

    if (entries.length < 3) {
      return res.json({
        predictions: null,
        message: 'Insufficient department data for predictions (need 3+ entries).',
        entryCount: entries.length,
      });
    }

    const latestEntry = entries[0];

    // Step 3: train a department-level model
    const trainResult = await trainEntityModel(
      'department',
      req.user.departmentId.toString(),
      entries
    );

    if (!trainResult.trained) {
      return res.json({ predictions: null, message: 'Model training failed.', trainResult });
    }

    // Step 4: get predictions from the department model
    const predictions = await predictEntityModel(
      'department',
      req.user.departmentId.toString(),
      latestEntry
    );

    res.json({
      predictions,
      trainingMetrics: trainResult.metrics,
      featureImportance: trainResult.featureImportance,
      studentCount: studentIds.length,
      entryCount: entries.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
