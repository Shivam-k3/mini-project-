const express = require('express');
const CarbonEntry = require('../models/CarbonEntry');
const { protect } = require('../middleware/auth');
const { getAIResponse } = require('../utils/aiService');
const { generateCarbonReport } = require('../utils/pdfGenerator');

const router = express.Router();

// Transportation-only personal emissions (occupancy-allocated)
function personalOf(entry) {
  if (typeof entry.transportPersonal === 'number') return entry.transportPersonal;
  return entry.breakdown?.transport || 0;
}

router.get('/pdf', protect, async (req, res) => {
  const entries = await CarbonEntry.find({ user: req.user._id })
    .sort({ date: -1 })
    .limit(30);

  const weeklyTotal = entries.slice(0, 7).reduce((s, e) => s + personalOf(e), 0);
  const monthlyTotal = entries.slice(0, 30).reduce((s, e) => s + personalOf(e), 0);
  const dailyAvg = entries.length > 0
    ? entries.reduce((s, e) => s + personalOf(e), 0) / entries.length
    : 0;

  // Per-mode breakdown (kg over the window)
  const modeBreakdown = {};
  const kmByMode = {};
  entries.forEach((e) => {
    if (Array.isArray(e.trips)) {
      e.trips.forEach((t) => {
        kmByMode[t.mode] = (kmByMode[t.mode] || 0) + Number(t.distanceKm || 0);
      });
    }
    const mb = e.modeBreakdown?.transport || {};
    Object.entries(mb).forEach(([k, v]) => {
      modeBreakdown[k] = (modeBreakdown[k] || 0) + v;
    });
  });
  if (!Object.keys(modeBreakdown).length && entries.length) {
    // legacy fallback: aggregate transport kg from breakdown
    entries.forEach((e) => {
      const t = e.breakdown?.transport || 0;
      if (t) modeBreakdown.transport = (modeBreakdown.transport || 0) + t;
    });
  }

  const stats = {
    dailyAvg: Math.round(dailyAvg * 100) / 100,
    weeklyTotal: Math.round(weeklyTotal * 100) / 100,
    monthlyTotal: Math.round(monthlyTotal * 100) / 100,
    totalEmissions: Math.round(entries.reduce((s, e) => s + personalOf(e), 0) * 100) / 100,
    categoryBreakdown: modeBreakdown,
    kmByMode,
    reportType: 'transportation',
  };

  const aiRecs = await getAIResponse('Give me 5 specific recommendations to reduce my transport emissions', {
    name: req.user.name,
    latestTransport: stats.dailyAvg,
    ecoScore: req.user.gamification?.ecoScore || 50,
    modeBreakdown,
  });

  const recommendations = aiRecs.split('\n').filter((l) => l.trim()).slice(0, 5);

  const pdfBuffer = await generateCarbonReport(req.user, entries, stats, recommendations);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=ecoguardian-mobility-report-${Date.now()}.pdf`);
  res.send(pdfBuffer);
});

module.exports = router;
