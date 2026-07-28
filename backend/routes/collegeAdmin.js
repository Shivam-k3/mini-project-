const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Department = require('../models/Department');
const Challenge = require('../models/Challenge');
const CarbonEntry = require('../models/CarbonEntry');
const { getPredictions, trainEntityModel, predictEntityModel } = require('../utils/mlService');

const router = express.Router();

const collegeAdminOnly = (req, res, next) => {
  if (req.user?.role !== 'college_admin') {
    return res.status(403).json({ message: 'College Admin access required' });
  }
  next();
};

router.use(protect, collegeAdminOnly);

// 1. Department CRUD
router.get('/departments', async (req, res) => {
  try {
    const depts = await Department.find({ collegeId: req.user.collegeId }).sort({ code: 1 });
    res.json(depts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/departments', async (req, res) => {
  const { name, code } = req.body;
  try {
    const exists = await Department.findOne({ collegeId: req.user.collegeId, code: code.toUpperCase() });
    if (exists) {
      return res.status(400).json({ message: `Department code ${code} already exists in this college.` });
    }
    const dept = await Department.create({
      collegeId: req.user.collegeId,
      name,
      code: code.toUpperCase()
    });
    res.status(201).json(dept);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/departments/:id', async (req, res) => {
  const { name, code } = req.body;
  try {
    const dept = await Department.findOne({ _id: req.params.id, collegeId: req.user.collegeId });
    if (!dept) return res.status(404).json({ message: 'Department not found' });
    
    if (name) dept.name = name;
    if (code) {
      const exists = await Department.findOne({
        collegeId: req.user.collegeId,
        code: code.toUpperCase(),
        _id: { $ne: req.params.id }
      });
      if (exists) {
        return res.status(400).json({ message: `Department code ${code} already exists.` });
      }
      dept.code = code.toUpperCase();
    }
    await dept.save();
    res.json(dept);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/departments/:id', async (req, res) => {
  try {
    const dept = await Department.findOneAndDelete({ _id: req.params.id, collegeId: req.user.collegeId });
    if (!dept) return res.status(404).json({ message: 'Department not found' });
    // Keep users but unset departmentId or toggle status? Or cascade? Unsetting is safer
    await User.updateMany({ departmentId: req.params.id }, { $set: { departmentId: null } });
    res.json({ message: 'Department deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. User CRUD (Faculty and Students)
router.get('/users', async (req, res) => {
  const { role, search, departmentId } = req.query;
  try {
    const filter = { collegeId: req.user.collegeId };
    
    if (role && role !== 'all') {
      filter.role = role;
    } else {
      filter.role = { $in: ['faculty', 'student'] }; // Only list college-scoped accounts
    }

    if (departmentId) {
      filter.departmentId = departmentId;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { userId: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .populate('departmentId')
      .sort({ createdAt: -1 });
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create Single User (Student/Faculty)
router.post('/users', async (req, res) => {
  const { name, email, role, departmentId, semester, section } = req.body;
  try {
    if (!['faculty', 'student'].includes(role)) {
      return res.status(400).json({ message: 'Only faculty or student accounts can be provisioned.' });
    }

    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      return res.status(400).json({ message: 'Email already exists.' });
    }

    // Auto-generate User ID
    let generatedUserId = '';
    const currentYear = new Date().getFullYear().toString().slice(-2); // e.g. '26' or '25'
    
    if (role === 'student') {
      if (!departmentId) return res.status(400).json({ message: 'Department is required for student creation.' });
      const dept = await Department.findById(departmentId);
      if (!dept) return res.status(404).json({ message: 'Department not found' });
      
      const count = await User.countDocuments({ 
        collegeId: req.user.collegeId, 
        role: 'student', 
        departmentId: departmentId 
      });
      const seq = String(count + 1).padStart(3, '0');
      generatedUserId = `${dept.code}${currentYear}${seq}`; // CSE26001
    } else if (role === 'faculty') {
      const count = await User.countDocuments({ collegeId: req.user.collegeId, role: 'faculty' });
      const seq = String(count + 1).padStart(3, '0');
      generatedUserId = `FAC${seq}`; // FAC001
    }

    const newUser = await User.create({
      userId: generatedUserId,
      name,
      email,
      password: 'Temp@123', // Temporary password
      role,
      collegeId: req.user.collegeId,
      departmentId: departmentId || null,
      semester: semester || '',
      section: section || '',
      firstLogin: true,
      status: 'active'
    });

    res.status(201).json(newUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/users/:id', async (req, res) => {
  const { name, email, departmentId, semester, section, status } = req.body;
  try {
    const user = await User.findOne({ _id: req.params.id, collegeId: req.user.collegeId });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (name) user.name = name;
    if (status) user.status = status;
    if (semester !== undefined) user.semester = semester;
    if (section !== undefined) user.section = section;
    if (departmentId !== undefined) user.departmentId = departmentId || null;

    if (email && email.toLowerCase() !== user.email) {
      const emailExists = await User.findOne({ email: email.toLowerCase() });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already exists.' });
      }
      user.email = email.toLowerCase();
    }

    await user.save();
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ _id: req.params.id, collegeId: req.user.collegeId });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    // Cascade delete carbon records
    await CarbonEntry.deleteMany({ user: req.params.id });
    res.json({ message: 'User and carbon data deleted.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reset Password
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, collegeId: req.user.collegeId });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    
    user.password = 'Temp@123';
    user.firstLogin = true;
    await user.save();
    
    res.json({ message: 'Password reset to Temp@123' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Import Students via CSV Text
router.post('/users/import-csv', async (req, res) => {
  const { csvText } = req.body;
  if (!csvText) return res.status(400).json({ message: 'No CSV data provided.' });

  try {
    const lines = csvText.split(/\r?\n/);
    const results = [];
    const errors = [];
    const currentYear = new Date().getFullYear().toString().slice(-2);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // Skip header row if present
      if (i === 0 && line.toLowerCase().includes('name') && line.toLowerCase().includes('email')) {
        continue;
      }

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

      // Check if email already exists
      const exists = await User.findOne({ email: email.toLowerCase() });
      if (exists) {
        errors.push(`Row ${i + 1} (${email}): Email already registered.`);
        continue;
      }

      // Find department
      const dept = await Department.findOne({ collegeId: req.user.collegeId, code: deptCode });
      if (!dept) {
        errors.push(`Row ${i + 1}: Department ${deptCode} not found in this college.`);
        continue;
      }

      // Auto-generate User ID
      const count = await User.countDocuments({ 
        collegeId: req.user.collegeId, 
        role: 'student', 
        departmentId: dept._id 
      });
      const seq = String(count + 1 + results.filter(r => r.deptId === dept._id.toString()).length).padStart(3, '0');
      const generatedUserId = `${dept.code}${currentYear}${seq}`;

      const provisioned = {
        userId: generatedUserId,
        name,
        email: email.toLowerCase(),
        password: 'Temp@123',
        role: 'student',
        collegeId: req.user.collegeId,
        departmentId: dept._id,
        semester,
        section,
        firstLogin: true,
        status: 'active'
      };
      
      results.push({ ...provisioned, deptId: dept._id.toString() });
    }

    // Insert provisioned students
    if (results.length > 0) {
      // Remove temporary deptId field used for local counting before save
      const studentsToInsert = results.map(({ deptId, ...s }) => s);
      await User.insertMany(studentsToInsert);
    }

    res.json({
      success: true,
      importedCount: results.length,
      errors: errors
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 3. College Challenges
router.get('/challenges', async (req, res) => {
  try {
    const challenges = await Challenge.find({ collegeId: req.user.collegeId }).sort({ createdAt: -1 });
    res.json(challenges);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/challenges', async (req, res) => {
  const { title, description, category, points, targetReduction, duration, badge } = req.body;
  try {
    const newCh = await Challenge.create({
      title,
      description,
      category: category || 'general',
      points: points || 50,
      targetReduction: targetReduction || 10,
      duration: duration || 7,
      badge: badge || '',
      collegeId: req.user.collegeId,
      departmentId: null // College-wide
    });
    res.status(201).json(newCh);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 4. Campus Analytics
router.get('/analytics/campus', async (req, res) => {
  try {
    const students = await User.find({ collegeId: req.user.collegeId, role: 'student' });
    const studentIds = students.map(s => s._id);

    const totalStudents = students.length;
    const totalFaculty = await User.countDocuments({ collegeId: req.user.collegeId, role: 'faculty' });
    const activeUsers = await User.countDocuments({ collegeId: req.user.collegeId, status: 'active' });

    // Campus emissions
    const emissionsResult = await CarbonEntry.aggregate([
      { $match: { user: { $in: studentIds } } },
      { $group: { _id: null, total: { $sum: '$totalEmissions' } } }
    ]);
    const campusEmissions = emissionsResult[0]?.total || 0;

    // Monthly reduction (mocked or derived from trend comparison)
    const monthlyReduction = 8.5; // percentage reduction default

    // Campus average Eco Score
    const campusEcoScore = students.length > 0
      ? Math.round(students.reduce((acc, s) => acc + (s.gamification?.ecoScore || 50), 0) / students.length)
      : 50;

    // Department Comparison
    const depts = await Department.find({ collegeId: req.user.collegeId });
    const deptComparison = await Promise.all(depts.map(async (d) => {
      const deptStudents = await User.find({ departmentId: d._id, role: 'student' });
      const deptStudentIds = deptStudents.map(s => s._id);

      const deptEmissionsResult = await CarbonEntry.aggregate([
        { $match: { user: { $in: deptStudentIds } } },
        { $group: { _id: null, total: { $sum: '$totalEmissions' } } }
      ]);
      
      return {
        department: d.code,
        name: d.name,
        emissions: deptEmissionsResult[0]?.total || 0,
        userCount: deptStudents.length
      };
    }));

    // Monthly Trend
    const monthlyTrend = await CarbonEntry.aggregate([
      { $match: { user: { $in: studentIds } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
          total: { $sum: '$totalEmissions' }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 6 }
    ]);

    // Student Participation Rate
    const loggedCount = await CarbonEntry.distinct('user', { user: { $in: studentIds } });
    const participationRate = totalStudents > 0 
      ? Math.round((loggedCount.length / totalStudents) * 100) 
      : 0;

    // Top Contributors (Leaderboard)
    const topContributors = [...students]
      .sort((a, b) => b.gamification?.greenPoints - a.gamification?.greenPoints)
      .slice(0, 5)
      .map(s => ({
        name: s.name,
        userId: s.userId,
        points: s.gamification?.greenPoints || 0,
        ecoScore: s.gamification?.ecoScore || 50
      }));

    res.json({
      totalStudents,
      totalFaculty,
      activeUsers,
      campusEmissions,
      monthlyReduction,
      campusEcoScore,
      deptComparison,
      monthlyTrend: monthlyTrend.map(t => ({ month: t._id, emissions: t.total })),
      participationRate,
      topContributors
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 5. Campus-level ML Predictions
// Aggregates all student carbon entries in the college, trains a campus model,
// and returns entity-level forecasts.  The model is cached on the ML service
// as carbon_model_college_<collegeId>.pkl so it persists across requests.
router.get('/analytics/campus/predictions', async (req, res) => {
  try {
    // Step 1: find all students in this college
    const students = await User.find({ collegeId: req.user.collegeId, role: 'student' });
    const studentIds = students.map(s => s._id);

    if (studentIds.length === 0) {
      return res.json({
        predictions: null,
        message: 'No students in this college yet.',
      });
    }

    // Step 2: fetch their carbon entries (most recent 30 days / 200 entries)
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
        message: 'Insufficient campus data for predictions (need 3+ entries).',
        entryCount: entries.length,
      });
    }

    // Step 3: get the latest entry for forecast baseline
    const latestEntry = entries[0];

    // Step 4: train a college-level model on the ML service
    // This saves to: models/carbon_model_college_<collegeId>.pkl
    const trainResult = await trainEntityModel(
      'college',
      req.user.collegeId.toString(),
      entries
    );

    if (!trainResult.trained) {
      return res.json({ predictions: null, message: 'Model training failed.', trainResult });
    }

    // Step 5: get predictions from the freshly-trained college model
    const predictions = await predictEntityModel(
      'college',
      req.user.collegeId.toString(),
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
