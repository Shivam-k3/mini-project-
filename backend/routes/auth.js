const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { protect } = require('../middleware/auth');

const router = express.Router();

/**
 * Public self-registration — creates INDIVIDUAL users only (spec §1/§3).
 * Individual users have no collegeId/departmentId (optional tenancy).
 * Institutional accounts are provisioned by organization admins, never here.
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

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: 'An account with this email already exists' });
  }

  // Sequential individual ID: IND0001, IND0002, ...
  const lastInd = await User.findOne({ userId: /^IND/ }).sort({ createdAt: -1 }).select('userId').lean();
  const nextSeq = lastInd ? (parseInt(lastInd.userId.replace('IND', ''), 10) || 0) + 1 : 1;
  const userId = `IND${String(nextSeq).padStart(4, '0')}`;

  const user = await User.create({
    userId,
    name,
    email,
    password,
    role: 'individual',
    collegeId: null,
    departmentId: null,
    firstLogin: false,
  });

  res.status(201).json({
    _id: user._id,
    userId: user.userId,
    name: user.name,
    email: user.email,
    role: user.role,
    collegeId: null,
    departmentId: null,
    semester: '',
    section: '',
    firstLogin: false,
    status: user.status,
    gamification: user.gamification,
    profile: user.profile,
    token: generateToken(user._id),
  });
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
