const express = require('express');
const User = require('../models/User');
const Challenge = require('../models/Challenge');
const { protect } = require('../middleware/auth');

const router = express.Router();

const BADGES = [
  { id: 'first_entry', name: 'First Step', description: 'Log your first carbon entry', icon: '🌱' },
  { id: 'week_streak', name: 'Week Warrior', description: '7-day logging streak', icon: '🔥' },
  { id: 'month_streak', name: 'Monthly Master', description: '30-day logging streak', icon: '⭐' },
  { id: 'eco_hero', name: 'Eco Hero', description: 'Reach eco score of 80+', icon: '🦸' },
  { id: 'carbon_cut', name: 'Carbon Cutter', description: 'Reduce emissions by 20%', icon: '✂️' },
  { id: 'green_commuter', name: 'Green Commuter', description: 'Zero car emissions for a week', icon: '🚲' },
  { id: 'challenge_champ', name: 'Challenge Champion', description: 'Complete 5 challenges', icon: '🏆' },
  { id: 'solar_pioneer', name: 'Solar Pioneer', description: 'Simulate solar panel installation', icon: '☀️' },
];

router.get('/stats', protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({
    ecoScore: user.gamification.ecoScore,
    greenPoints: user.gamification.greenPoints,
    streak: user.gamification.streak,
    badges: user.gamification.badges,
    allBadges: BADGES,
  });
});

router.get('/challenges', protect, async (req, res) => {
  const challenges = await Challenge.find({ isActive: true });
  const user = await User.findById(req.user._id);
  const completed = user.gamification.completedChallenges.map(String);
  const enriched = challenges.map((c) => ({
    ...c.toObject(),
    completed: completed.includes(c._id.toString()),
  }));
  res.json(enriched);
});

router.post('/challenges/:id/complete', protect, async (req, res) => {
  const challenge = await Challenge.findById(req.params.id);
  if (!challenge) return res.status(404).json({ message: 'Challenge not found' });

  const user = await User.findById(req.user._id);
  const completed = user.gamification.completedChallenges.map(String);
  if (completed.includes(challenge._id.toString())) {
    return res.status(400).json({ message: 'Challenge already completed' });
  }

  user.gamification.completedChallenges.push(challenge._id);
  user.gamification.greenPoints += challenge.points;
  if (challenge.badge && !user.gamification.badges.includes(challenge.badge)) {
    user.gamification.badges.push(challenge.badge);
  }
  await user.save();

  res.json({
    message: 'Challenge completed!',
    pointsEarned: challenge.points,
    badge: challenge.badge,
    gamification: user.gamification,
  });
});

router.get('/leaderboard', protect, async (req, res) => {
  const users = await User.find({ role: 'user' })
    .select('name gamification.ecoScore gamification.greenPoints gamification.streak')
    .sort({ 'gamification.greenPoints': -1 })
    .limit(20);
  res.json(users.map((u, i) => ({
    rank: i + 1,
    name: u.name,
    ecoScore: u.gamification.ecoScore,
    greenPoints: u.gamification.greenPoints,
    streak: u.gamification.streak,
  })));
});

module.exports = router;
