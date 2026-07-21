const express = require('express');
const User = require('../models/User');
const CarbonEntry = require('../models/CarbonEntry');
const { protect, admin } = require('../middleware/auth');

const router = express.Router();

router.use(protect, admin);

router.get('/users', async (req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 });
  res.json(users);
});

router.get('/analytics', async (req, res) => {
  const [userCount, entryCount, totalEmissions, recentEntries] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    CarbonEntry.countDocuments(),
    CarbonEntry.aggregate([
      { $group: { _id: null, total: { $sum: '$totalEmissions' } } },
    ]),
    CarbonEntry.find().sort({ date: -1 }).limit(10).populate('user', 'name email'),
  ]);

  const categoryTotals = await CarbonEntry.aggregate([
    {
      $group: {
        _id: null,
        transport: { $sum: '$breakdown.transport' },
        electricity: { $sum: '$breakdown.electricity' },
        water: { $sum: '$breakdown.water' },
        food: { $sum: '$breakdown.food' },
        shopping: { $sum: '$breakdown.shopping' },
        waste: { $sum: '$breakdown.waste' },
        fuel: { $sum: '$breakdown.fuel' },
      },
    },
  ]);

  const monthlyTrend = await CarbonEntry.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
        total: { $sum: '$totalEmissions' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
    { $limit: 12 },
  ]);

  res.json({
    userCount,
    entryCount,
    communityEmissions: totalEmissions[0]?.total || 0,
    categoryTotals: categoryTotals[0] || {},
    monthlyTrend: monthlyTrend.reverse(),
    recentEntries,
  });
});

router.delete('/users/:id', async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  await CarbonEntry.deleteMany({ user: req.params.id });
  res.json({ message: 'User deleted' });
});

router.get('/export', async (req, res) => {
  const entries = await CarbonEntry.find()
    .populate('user', 'name email')
    .sort({ date: -1 })
    .limit(1000);

  const csv = [
    'Date,User,Email,Total CO2,Transport,Electricity,Water,Food,Shopping,Waste,Fuel',
    ...entries.map((e) =>
      [
        new Date(e.date).toISOString(),
        e.user?.name || '',
        e.user?.email || '',
        e.totalEmissions,
        e.breakdown?.transport || 0,
        e.breakdown?.electricity || 0,
        e.breakdown?.water || 0,
        e.breakdown?.food || 0,
        e.breakdown?.shopping || 0,
        e.breakdown?.waste || 0,
        e.breakdown?.fuel || 0,
      ].join(',')
    ),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=ecoguardian-export.csv');
  res.send(csv);
});

module.exports = router;
