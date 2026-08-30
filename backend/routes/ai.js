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

  // Transportation-only context (occupancy-allocated personal emissions)
  const personalOf = (e) =>
    typeof e.transportPersonal === 'number' ? e.transportPersonal : (e.breakdown?.transport || 0);

  const weeklyTransport = entries.length > 0
    ? entries.slice(0, 7).reduce((s, e) => s + personalOf(e), 0) / Math.min(7, entries.length)
    : 0;

  const modeBreakdown = latest?.modeBreakdown?.transport || {};
  if (!Object.keys(modeBreakdown).length && latest?.breakdown?.transport) {
    modeBreakdown.transport = latest.breakdown.transport;
  }

  const context = {
    name: req.user.name,
    ecoScore: req.user.gamification?.ecoScore || 50,
    greenPoints: req.user.gamification?.greenPoints || 0,
    streak: req.user.gamification?.streak || 0,
    latestTransport: Math.round(personalOf(latest || {}) * 100) / 100,
    weeklyTransport: Math.round(weeklyTransport * 100) / 100,
    modeBreakdown,
  };

  const response = await getAIResponse(message, context);
  res.json({ message: response, context });
});

module.exports = router;
