const express = require('express');
const CarbonEntry = require('../models/CarbonEntry');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { calculateEmissions, calculateEcoScore } = require('../utils/emissionFactors');
const { getPredictions, getShapExplanation } = require('../utils/mlService');

const router = express.Router();

router.post('/', protect, async (req, res) => {
  const { total, breakdown } = calculateEmissions(req.body);
  const entry = await CarbonEntry.create({
    user: req.user._id,
    ...req.body,
    totalEmissions: total,
    breakdown,
  });

  // Update gamification
  const user = req.user;
  const today = new Date().toDateString();
  const lastActive = user.gamification.lastActiveDate?.toDateString();
  if (lastActive !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (lastActive === yesterday.toDateString()) {
      user.gamification.streak += 1;
    } else if (lastActive !== today) {
      user.gamification.streak = 1;
    }
    user.gamification.lastActiveDate = new Date();
  }
  user.gamification.ecoScore = calculateEcoScore(total, user.gamification.streak);
  user.gamification.greenPoints += Math.max(0, Math.round(20 - total));
  await user.save();

  res.status(201).json(entry);
});

router.get('/', protect, async (req, res) => {
  const { limit = 30, page = 1 } = req.query;
  const entries = await CarbonEntry.find({ user: req.user._id })
    .sort({ date: -1 })
    .limit(Number(limit))
    .skip((Number(page) - 1) * Number(limit));
  const total = await CarbonEntry.countDocuments({ user: req.user._id });
  res.json({ entries, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

router.get('/dashboard', protect, async (req, res) => {
  const userId = req.user._id;
  const now = new Date();

  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const startOfWeek = new Date(now);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const startOfMonth = new Date(now);
  startOfMonth.setDate(startOfMonth.getDate() - 30);

  const [daily, weekly, monthly, allEntries] = await Promise.all([
    CarbonEntry.find({ user: userId, date: { $gte: startOfDay } }),
    CarbonEntry.find({ user: userId, date: { $gte: startOfWeek } }),
    CarbonEntry.find({ user: userId, date: { $gte: startOfMonth } }),
    CarbonEntry.find({ user: userId }).sort({ date: -1 }).limit(90),
  ]);

  const sumEmissions = (entries) => entries.reduce((s, e) => s + e.totalEmissions, 0);
  const avgBreakdown = (entries) => {
    if (entries.length === 0) return {};
    const totals = {};
    entries.forEach((e) => {
      Object.entries(e.breakdown || {}).forEach(([k, v]) => {
        totals[k] = (totals[k] || 0) + v;
      });
    });
    return Object.fromEntries(
      Object.entries(totals).map(([k, v]) => [k, Math.round((v / entries.length) * 100) / 100])
    );
  };

  const dailyTotal = sumEmissions(daily);
  const weeklyTotal = sumEmissions(weekly);
  const monthlyTotal = sumEmissions(monthly);
  const allTimeTotal = sumEmissions(allEntries);
  const categoryBreakdown = avgBreakdown(allEntries.slice(0, 30));

  const trend = allEntries.slice(0, 30).reverse().map((e) => ({
    date: e.date,
    total: e.totalEmissions,
    ...e.breakdown,
  }));

  const predictions = await getPredictions(userId.toString(), allEntries.slice(0, 60));
  const latestBreakdown = allEntries[0]?.breakdown || categoryBreakdown;
  const shapExplanation = await getShapExplanation(latestBreakdown, allEntries[0]?.totalEmissions || 0);

  res.json({
    daily: Math.round(dailyTotal * 100) / 100,
    weekly: Math.round(weeklyTotal * 100) / 100,
    monthly: Math.round(monthlyTotal * 100) / 100,
    total: Math.round(allTimeTotal * 100) / 100,
    categoryBreakdown,
    trend,
    predictions,
    shapExplanation,
    entryCount: allEntries.length,
  });
});

router.get('/:id', protect, async (req, res) => {
  const entry = await CarbonEntry.findOne({ _id: req.params.id, user: req.user._id });
  if (!entry) return res.status(404).json({ message: 'Entry not found' });
  res.json(entry);
});

router.delete('/:id', protect, async (req, res) => {
  const entry = await CarbonEntry.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!entry) return res.status(404).json({ message: 'Entry not found' });
  res.json({ message: 'Entry deleted' });
});

module.exports = router;
