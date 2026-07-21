const express = require('express');
const CarbonEntry = require('../models/CarbonEntry');
const { protect } = require('../middleware/auth');
const { getAIResponse } = require('../utils/aiService');
const { generateCarbonReport } = require('../utils/pdfGenerator');

const router = express.Router();

router.get('/pdf', protect, async (req, res) => {
  const entries = await CarbonEntry.find({ user: req.user._id })
    .sort({ date: -1 })
    .limit(30);

  const weeklyTotal = entries.slice(0, 7).reduce((s, e) => s + e.totalEmissions, 0);
  const monthlyTotal = entries.slice(0, 30).reduce((s, e) => s + e.totalEmissions, 0);
  const dailyAvg = entries.length > 0
    ? entries.reduce((s, e) => s + e.totalEmissions, 0) / entries.length
    : 0;

  const categoryBreakdown = {};
  entries.forEach((e) => {
    Object.entries(e.breakdown || {}).forEach(([k, v]) => {
      categoryBreakdown[k] = (categoryBreakdown[k] || 0) + v;
    });
  });

  const stats = {
    dailyAvg: Math.round(dailyAvg * 100) / 100,
    weeklyTotal: Math.round(weeklyTotal * 100) / 100,
    monthlyTotal: Math.round(monthlyTotal * 100) / 100,
    totalEmissions: Math.round(entries.reduce((s, e) => s + e.totalEmissions, 0) * 100) / 100,
    categoryBreakdown,
  };

  const aiRecs = await getAIResponse('Give me 5 specific recommendations to reduce my carbon footprint', {
    name: req.user.name,
    latestEmissions: entries[0]?.totalEmissions || 0,
    ecoScore: req.user.gamification?.ecoScore || 50,
    breakdown: categoryBreakdown,
    topSource: Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0],
  });

  const recommendations = aiRecs.split('\n').filter((l) => l.trim()).slice(0, 5);

  const pdfBuffer = await generateCarbonReport(req.user, entries, stats, recommendations);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=ecoguardian-report-${Date.now()}.pdf`);
  res.send(pdfBuffer);
});

module.exports = router;
