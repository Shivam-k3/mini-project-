const express = require('express');
const CarbonEntry = require('../models/CarbonEntry');
const { protect } = require('../middleware/auth');
const { getAIResponse } = require('../utils/aiService');

const router = express.Router();

router.post('/chat', protect, async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ message: 'Message is required' });
  }

  const entries = await CarbonEntry.find({ user: req.user._id })
    .sort({ date: -1 })
    .limit(30);

  const latest = entries[0];
  const weeklyAvg = entries.length > 0
    ? entries.slice(0, 7).reduce((s, e) => s + e.totalEmissions, 0) / Math.min(7, entries.length)
    : 0;

  const breakdown = latest?.breakdown || {};
  const topSource = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || 'transport';

  const context = {
    name: req.user.name,
    goal: req.user.profile?.goal || 15,
    ecoScore: req.user.gamification?.ecoScore || 50,
    greenPoints: req.user.gamification?.greenPoints || 0,
    streak: req.user.gamification?.streak || 0,
    latestEmissions: latest?.totalEmissions,
    weeklyAvg: Math.round(weeklyAvg * 100) / 100,
    topSource,
    breakdown,
  };

  const response = await getAIResponse(message, context);
  res.json({ message: response, context });
});

module.exports = router;
