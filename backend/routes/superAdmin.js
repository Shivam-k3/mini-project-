const express = require('express');
const { protect } = require('../middleware/auth');
const College = require('../models/College');
const User = require('../models/User');
const Department = require('../models/Department');
const Announcement = require('../models/Announcement');
const CarbonEntry = require('../models/CarbonEntry');

const router = express.Router();

const superAdminOnly = (req, res, next) => {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ message: 'Super Admin access required' });
  }
  next();
};

router.use(protect, superAdminOnly);

// 1. College CRUD
router.get('/colleges', async (req, res) => {
  try {
    const colleges = await College.find().sort({ createdAt: -1 });
    // For each college, get admin and user counts
    const results = await Promise.all(colleges.map(async (c) => {
      const admin = await User.findOne({ collegeId: c._id, role: 'college_admin' }).select('name email userId status');
      const studentCount = await User.countDocuments({ collegeId: c._id, role: 'student' });
      const facultyCount = await User.countDocuments({ collegeId: c._id, role: 'faculty' });
      return {
        ...c.toObject(),
        admin,
        studentCount,
        facultyCount
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
    const exists = await College.findOne({ code: code.toUpperCase() });
    if (exists) {
      return res.status(400).json({ message: `College code ${code} already exists.` });
    }
    const college = await College.create({
      name,
      code,
      address,
      license: {
        plan: plan || 'Standard',
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    });
    res.status(201).json(college);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/colleges/:id', async (req, res) => {
  const { name, address, plan, expiresAt, status } = req.body;
  try {
    const college = await College.findById(req.params.id);
    if (!college) return res.status(404).json({ message: 'College not found' });
    
    if (name) college.name = name;
    if (address !== undefined) college.address = address;
    if (status) college.status = status;
    if (plan || expiresAt) {
      college.license = {
        ...college.license,
        plan: plan || college.license.plan,
        expiresAt: expiresAt ? new Date(expiresAt) : college.license.expiresAt
      };
    }
    await college.save();
    res.json(college);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/colleges/:id', async (req, res) => {
  try {
    const college = await College.findByIdAndDelete(req.params.id);
    if (!college) return res.status(404).json({ message: 'College not found' });
    // Cascade delete departments, users, entries
    await Department.deleteMany({ collegeId: req.params.id });
    const users = await User.find({ collegeId: req.params.id });
    const userIds = users.map(u => u._id);
    await User.deleteMany({ collegeId: req.params.id });
    await CarbonEntry.deleteMany({ user: { $in: userIds } });
    res.json({ message: 'College and all related departments, users, and activities deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Provision College Admin
router.post('/colleges/:id/admin', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const college = await College.findById(req.params.id);
    if (!college) return res.status(404).json({ message: 'College not found' });

    // Check if college admin already exists for this college
    const existingAdmin = await User.findOne({ collegeId: college._id, role: 'college_admin' });
    if (existingAdmin) {
      return res.status(400).json({ message: 'College Admin already exists. Please edit the existing user instead.' });
    }

    // Determine sequential ADMIN id
    const count = await User.countDocuments({ role: 'college_admin' });
    const seq = String(count + 1).padStart(3, '0');
    const userId = `ADMIN${seq}`;

    // Verify email unique
    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      return res.status(400).json({ message: 'Email already registered.' });
    }

    const adminUser = await User.create({
      userId,
      name,
      email,
      password: password || 'Temp@123',
      role: 'college_admin',
      collegeId: college._id,
      firstLogin: true
    });
    res.status(201).json(adminUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 3. Global Analytics
router.get('/analytics/global', async (req, res) => {
  try {
    const totalColleges = await College.countDocuments();
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalFaculty = await User.countDocuments({ role: 'faculty' });
    const activeUsers = await User.countDocuments({ status: 'active' });

    const totalEmissionsResult = await CarbonEntry.aggregate([
      { $group: { _id: null, total: { $sum: '$totalEmissions' } } }
    ]);
    const totalCarbonEmissions = totalEmissionsResult[0]?.total || 0;

    const avgEcoScoreResult = await User.aggregate([
      { $match: { role: 'student' } },
      { $group: { _id: null, avgScore: { $avg: '$gamification.ecoScore' } } }
    ]);
    const overallEcoScore = Math.round(avgEcoScoreResult[0]?.avgScore || 50);

    res.json({
      totalColleges,
      totalStudents,
      totalFaculty,
      activeUsers,
      totalCarbonEmissions,
      overallEcoScore
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 4. College Comparison Analytics & Rankings
router.get('/analytics/colleges-compare', async (req, res) => {
  try {
    const colleges = await College.find({ status: 'active' });
    const comparisons = await Promise.all(colleges.map(async (c) => {
      const userCount = await User.countDocuments({ collegeId: c._id });
      const students = await User.find({ collegeId: c._id, role: 'student' });
      const studentIds = students.map(s => s._id);

      // Aggregated emissions
      const emissionsResult = await CarbonEntry.aggregate([
        { $match: { user: { $in: studentIds } } },
        { $group: { _id: null, total: { $sum: '$totalEmissions' } } }
      ]);
      const emissions = emissionsResult[0]?.total || 0;

      // Avg Eco Score
      const avgEco = students.length > 0 
        ? Math.round(students.reduce((acc, s) => acc + (s.gamification?.ecoScore || 50), 0) / students.length)
        : 50;

      return {
        collegeId: c._id,
        name: c.name,
        code: c.code,
        userCount,
        emissions: round(emissions, 1),
        ecoScore: avgEco
      };
    }));

    // Sort by eco score descending (higher is better) for rankings
    const rankings = [...comparisons].sort((a, b) => b.ecoScore - a.ecoScore);

    res.json({
      comparisons,
      topColleges: rankings.slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper rounding function
function round(value, decimals) {
  return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}

// 5. Announcements
router.get('/announcements', async (req, res) => {
  try {
    const announcements = await Announcement.find({ collegeId: null })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json(announcements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/announcements', async (req, res) => {
  const { title, content } = req.body;
  try {
    const announcement = await Announcement.create({
      title,
      content,
      collegeId: null, // Global
      createdBy: req.user._id
    });
    res.status(201).json(announcement);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
