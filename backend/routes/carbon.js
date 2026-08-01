const express = require('express');
const CarbonEntry = require('../models/CarbonEntry');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { calculateEmissions, calculateEcoScore } = require('../utils/emissionFactors');
const { getPredictions, getShapExplanation } = require('../utils/mlService');

const router = express.Router();

async function autoAwardBadges(user, entry) {
  const badges = user.gamification.badges || [];
  const newBadges = [];

  // Count total entries for this user
  const entryCount = await CarbonEntry.countDocuments({ user: user._id });

  // first_entry: first carbon log
  if (entryCount === 1 && !badges.includes('first_entry')) {
    newBadges.push('first_entry');
  }

  // week_streak: 7-day streak
  if (user.gamification.streak >= 7 && !badges.includes('week_streak')) {
    newBadges.push('week_streak');
  }

  // month_streak: 30-day streak
  if (user.gamification.streak >= 30 && !badges.includes('month_streak')) {
    newBadges.push('month_streak');
  }

  // eco_hero: eco score 80+
  if (user.gamification.ecoScore >= 80 && !badges.includes('eco_hero')) {
    newBadges.push('eco_hero');
  }

  // carbon_cut: entry 20%+ below user's historical average
  const allEntries = await CarbonEntry.find({ user: user._id }).select('totalEmissions');
  if (allEntries.length >= 3) {
    const avg = allEntries.reduce((s, e) => s + e.totalEmissions, 0) / allEntries.length;
    if (entry.totalEmissions <= avg * 0.8 && !badges.includes('carbon_cut')) {
      newBadges.push('carbon_cut');
    }
  }

  // green_commuter: zero transport emissions in this entry
  const transportTotal = entry.breakdown?.transport || 0;
  if (transportTotal === 0 && !badges.includes('green_commuter')) {
    newBadges.push('green_commuter');
  }

  // eco_warrior: 500+ green points
  if (user.gamification.greenPoints >= 500 && !badges.includes('eco_warrior')) {
    newBadges.push('eco_warrior');
  }

  if (newBadges.length > 0) {
    user.gamification.badges = [...badges, ...newBadges];
    await user.save();
  }

  return newBadges;
}

router.post('/', protect, async (req, res) => {
  const { total, breakdown, householdTotal, householdBreakdown } = calculateEmissions(req.body);
  const entry = await CarbonEntry.create({
    user: req.user._id,
    ...req.body,
    totalEmissions: total,
    breakdown,
    householdTotal,
    householdBreakdown,
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

  // Auto-award badges
  const earnedBadges = await autoAwardBadges(user, entry);

  res.status(201).json({ ...entry.toObject(), earnedBadges });
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

  const predictions = await getPredictions(
    userId.toString(),
    allEntries.slice(0, 60),
    'user',
    userId.toString()
  );
  const latestBreakdown = allEntries[0]?.breakdown || categoryBreakdown;
  const shapExplanation = await getShapExplanation(
    latestBreakdown,
    allEntries[0]?.totalEmissions || 0,
    'user',
    userId.toString()
  );

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
