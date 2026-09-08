const express = require('express');
const { protect } = require('../middleware/auth');
const { challengeRepository, gamificationRepository, tenancyContext } = require('../repositories');
const { toApiChallenge } = require('../repositories/challengeSerializer');

const router = express.Router();

const BADGES = [
  { id: 'first_entry', name: 'First Step', description: 'Log your first carbon entry', icon: '🌱' },
  { id: 'week_streak', name: 'Week Warrior', description: '7-day logging streak', icon: '🔥' },
  { id: 'month_streak', name: 'Monthly Master', description: '30-day logging streak', icon: '⭐' },
  { id: 'eco_hero', name: 'Eco Hero', description: 'Reach eco score of 80+', icon: '🦸' },
  { id: 'carbon_cut', name: 'Carbon Cutter', description: 'Reduce emissions by 20%', icon: '✂️' },
  { id: 'green_commuter', name: 'Green Commuter', description: 'Zero transport emissions in a day', icon: '🚲' },
  { id: 'eco_warrior', name: 'Eco Warrior', description: 'Earn 500+ Green Points', icon: '🏅' },
  { id: 'challenge_champ', name: 'Challenge Champion', description: 'Complete 5 challenges', icon: '🏆' },
  { id: 'solar_pioneer', name: 'Solar Pioneer', description: 'Simulate solar panel installation', icon: '☀️' },
];

/**
 * Tenant context for the authenticated request. Built exclusively from the
 * verified Supabase profile (req.auth.profile) — never from request JSON/query,
 * so the actor/org/dept can never be client-controlled.
 */
function authTenant(req) {
  const profile = req.auth?.profile;
  if (!profile) {
    const e = new Error('Authenticated profile not available');
    e.status = 401;
    throw e;
  }
  return tenancyContext.fromProfile(profile);
}

router.get('/stats', protect, async (req, res) => {
  try {
    const tenant = authTenant(req);
    const { gamification } = await gamificationRepository.get(tenant);
    res.json({
      ecoScore: gamification.ecoScore ?? 0,
      greenPoints: gamification.greenPoints ?? 0,
      streak: gamification.streak ?? 0,
      badges: gamification.badges || [],
      allBadges: BADGES,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/challenges', protect, async (req, res) => {
  try {
    const tenant = authTenant(req);

    // Active challenges VISIBLE to the authenticated actor (platform / org /
    // dept scoping is enforced by the repository, never the request body).
    const challenges = await challengeRepository.listVisible(tenant, { activeOnly: true });

    const { gamification } = await gamificationRepository.get(tenant);
    const completed = Array.isArray(gamification.completedChallenges)
      ? gamification.completedChallenges.map(String)
      : [];

    const enriched = challenges.map((c) => ({
      ...toApiChallenge(c),
      completed: completed.includes(String(c.id)),
    }));
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/challenges/:id/complete', protect, async (req, res) => {
  try {
    const tenant = authTenant(req);

    // Resolve the challenge within the actor's visibility. A challenge from
    // another org/dept (or a fabricated id) resolves to null.
    const challenge = await challengeRepository.findVisible(tenant, req.params.id);
    if (!challenge) return res.status(404).json({ message: 'Challenge not found' });

    const result = await gamificationRepository.completeChallenge(tenant, challenge);
    if (result.status === 'already_completed') {
      return res.status(400).json({ message: 'Challenge already completed' });
    }

    res.json({
      message: 'Challenge completed!',
      pointsEarned: result.pointsEarned,
      badge: result.badge,
      gamification: result.gamification,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/leaderboard', protect, async (req, res) => {
  try {
    const tenant = authTenant(req);
    // Leaderboards are scoped to the caller's own boundary: an organization
    // member ranks against their college, a personal-mode user against the
    // platform-wide personal pool (enforced in the repository).
    const leaderboard = await gamificationRepository.leaderboard(tenant, { limit: 20 });
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
