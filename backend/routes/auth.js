const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', (req, res) => {
  res.status(403).json({ message: 'Public registration is disabled. Please contact your administrator.' });
});

router.post('/login', [
  body('emailOrUserId').notEmpty(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { emailOrUserId, password } = req.body;
  
  const user = await User.findOne({
    $or: [
      { email: emailOrUserId.toLowerCase() },
      { userId: emailOrUserId.toUpperCase() }
    ]
  }).populate('collegeId').populate('departmentId');

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  if (user.status === 'suspended') {
    return res.status(403).json({ message: 'Your account has been suspended' });
  }

  res.json({
    _id: user._id,
    userId: user.userId,
    name: user.name,
    email: user.email,
    role: user.role,
    collegeId: user.collegeId,
    departmentId: user.departmentId,
    semester: user.semester,
    section: user.section,
    firstLogin: user.firstLogin,
    status: user.status,
    gamification: user.gamification,
    profile: user.profile,
    token: generateToken(user._id),
  });
});

router.post('/change-password', protect, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }
  req.user.password = newPassword;
  req.user.firstLogin = false;
  await req.user.save();
  res.json({ message: 'Password updated successfully' });
});

router.get('/me', protect, async (req, res) => {
  const populatedUser = await User.findById(req.user._id)
    .select('-password')
    .populate('collegeId')
    .populate('departmentId');
  res.json(populatedUser);
});

router.put('/profile', protect, async (req, res) => {
  const { name, profile } = req.body;
  if (name) req.user.name = name;
  if (profile) req.user.profile = { ...req.user.profile.toObject?.() || req.user.profile, ...profile };
  await req.user.save();
  
  const populatedUser = await User.findById(req.user._id)
    .select('-password')
    .populate('collegeId')
    .populate('departmentId');
  res.json(populatedUser);
});

module.exports = router;
