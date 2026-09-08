const express = require('express');
const { protect } = require('../middleware/auth');
const { calculateEcoScore } = require('../utils/emissionFactors');
const { calculateTrips } = require('../utils/tripEngine');
const { getPredictions, getShapExplanation } = require('../utils/mlService');
const { carbonRepository, gamificationRepository, tenancyContext } = require('../repositories');
const { toApiEntry } = require('../repositories/carbonSerializer');

const router = express.Router();

/**
 * The tenant context for the authenticated request. Built exclusively from the
 * verified Supabase profile (req.auth.profile) — never from request JSON/query,
 * so user_id / organization_id / department_id cannot be client-controlled.
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

/**
 * Compute badges earned from a gamification snapshot (pure, no storage).
 * Gamification state now lives in `public.profiles.gamification` (PostgreSQL).
 * @param {object} g - current gamification snapshot
 * @param {object} ctx - { entryCount, entry, allEmissions }
 * @returns {string[]} newly earned badge ids
 */
function earnedBadges(g, ctx) {
  const badges = g.badges || [];
  const newBadges = [];
  const has = (id) => badges.includes(id);

  if (ctx.entryCount === 1 && !has('first_entry')) newBadges.push('first_entry');
  if (g.streak >= 7 && !has('week_streak')) newBadges.push('week_streak');
  if (g.streak >= 30 && !has('month_streak')) newBadges.push('month_streak');
  if (g.ecoScore >= 80 && !has('eco_hero')) newBadges.push('eco_hero');

  const avg = ctx.allEmissions.length >= 3
    ? ctx.allEmissions.reduce((s, e) => s + e, 0) / ctx.allEmissions.length
    : 0;
  if (ctx.allEmissions.length >= 3 && ctx.entry.totalEmissions <= avg * 0.8 && !has('carbon_cut')) {
    newBadges.push('carbon_cut');
  }

  if ((ctx.entry.breakdown?.transport || 0) === 0 && !has('green_commuter')) newBadges.push('green_commuter');
  if (g.greenPoints >= 500 && !has('eco_warrior')) newBadges.push('eco_warrior');

  return newBadges;
}

/**
 * Map the trip engine's flat resolution output onto the CarbonEntry subdoc
 * shape, so each stored trip keeps its factor provenance (spec §12).
 */
function toTripSubdocs(tripDetails) {
  return tripDetails.map((t) => ({
    mode: t.mode,
    distanceKm: t.distanceKm,
    occupants: t.occupants,
    tripFrequency: t.tripFrequency,
    purpose: t.purpose,
    vehicle: t.vehicle || {},
    resolved: {
      factorKgPerKm: t.factorKgPerKm,
      factorLevel: t.factorLevel,
      factorSource: t.factorSource,
      sourceUrl: t.factorSourceUrl,
      sourceYear: t.factorSourceYear,
      methodology: t.factorMethodology,
    },
    tripTotalEmission: t.tripTotalEmission,
    personalAllocatedEmission: t.personalAllocatedEmission,
  }));
}

router.post('/', protect, async (req, res) => {
  // Transportation-only platform (spec §37): trips[] is the sole input.
  if (!Array.isArray(req.body.trips) || req.body.trips.length === 0) {
    return res.status(400).json({
      message: 'At least one trip is required — EcoGuardian tracks transportation emissions only.',
    });
  }

  const tripsResult = await calculateTrips(req.body.trips);
  if (tripsResult.tripDetails.length === 0) {
    return res.status(400).json({ message: 'At least one trip must have a distance greater than zero.' });
  }

  // For transportation-only entries the occupancy-allocated personal share IS
  // the entry total.
  const entryTotal = tripsResult.transportPersonal;

  // Write the entry to Supabase PostgreSQL (primary store). Tenancy derived
  // from the authenticated profile; client-supplied user/org/dept are ignored.
  const tenant = authTenant(req);
  const entry = await carbonRepository.create(tenant, {
    date: req.body.date,
    notes: req.body.notes,
    trips: toTripSubdocs(tripsResult.tripDetails),
    transportPersonal: tripsResult.transportPersonal,
    transportHousehold: tripsResult.transportHousehold,
    modeBreakdown: tripsResult.modeBreakdown,
    totalEmissions: entryTotal,
  });

  // Update gamification on the PostgreSQL `profiles.gamification` column.
  const serialized = toApiEntry(entry);
  const entryCount = (await carbonRepository.countByUser(tenant)) || 0;
  const allEmissions = (await carbonRepository.listAllByUser(tenant)).map((r) => Number(r.total_emissions) || 0);
  let earned = [];
  const gamification = await gamificationRepository.mutate(tenant, (g) => {
    const today = new Date().toDateString();
    const lastActive = g.lastActiveDate ? new Date(g.lastActiveDate).toDateString() : null;
    let streak = g.streak || 0;
    if (lastActive !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (lastActive === yesterday.toDateString()) streak += 1;
      else streak = 1;
    }
    const ecoScore = calculateEcoScore(entryTotal, streak);
    const greenPoints = Math.max(0, Math.round(20 - entryTotal));
    const next = {
      ...g,
      streak,
      ecoScore,
      greenPoints: (g.greenPoints || 0) + greenPoints,
      lastActiveDate: new Date().toISOString(),
      badges: g.badges || [],
    };
    // Auto-award badges (pure computations against the post-entry snapshot).
    earned = earnedBadges(next, { entryCount, entry: serialized, allEmissions });
    if (earned.length) next.badges = [...next.badges, ...earned];
    return next;
  });

  res.status(201).json({ ...serialized, gamification: gamification.gamification, earnedBadges: earned });
});

router.get('/', protect, async (req, res) => {
  const tenant = authTenant(req);
  const limit = Math.max(1, Number(req.query.limit) || 30);
  const page = Math.max(1, Number(req.query.page) || 1);
  const rows = await carbonRepository.listByUser(tenant, {
    limit,
    offset: (page - 1) * limit,
  });
  const total = await carbonRepository.countByUser(tenant);
  const entries = rows.map((r) => toApiEntry(r));
  res.json({ entries, total, page, pages: Math.ceil(total / limit) });
});

router.get('/dashboard', protect, async (req, res) => {
  const userId = req.user._id;
  const now = new Date();

  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const startOfWeek = new Date(now);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const startOfMonth = new Date(now);
  startOfMonth.setDate(startOfMonth.getDate() - 30);

  const tenant = authTenant(req);

  const [daily, weekly, monthly, allEntries] = await Promise.all([
    carbonRepository.listByUser(tenant, { from: startOfDay.toISOString() }),
    carbonRepository.listByUser(tenant, { from: startOfWeek.toISOString() }),
    carbonRepository.listByUser(tenant, { from: startOfMonth.toISOString() }),
    carbonRepository.listAllByUser(tenant, { limit: 90 }),
  ]);

  // map to API shape so the aggregate helpers below keep their exact contract
  const dApi = daily.map(toApiEntry);
  const wApi = weekly.map(toApiEntry);
  const mApi = monthly.map(toApiEntry);
  const aApi = allEntries.map(toApiEntry);

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

  const dailyTotal = sumEmissions(dApi);
  const weeklyTotal = sumEmissions(wApi);
  const monthlyTotal = sumEmissions(mApi);
  const allTimeTotal = sumEmissions(aApi);
  const categoryBreakdown = avgBreakdown(aApi.slice(0, 30));

  // Per-travel-mode totals (occupancy-allocated personal kg CO2).
  const toModePairs = (mb) => {
    if (!mb) return [];
    if (typeof Map !== 'undefined' && mb instanceof Map) return [...mb.entries()];
    if (typeof mb.toObject === 'function') return Object.entries(mb.toObject());
    return Object.entries(mb);
  };
  const sumModes = (entries) => {
    const totals = {};
    entries.forEach((e) => {
      toModePairs(e.modeBreakdown).forEach(([mode, kg]) => {
        const v = Number(kg) || 0;
        if (v > 0) totals[mode] = (totals[mode] || 0) + v;
      });
    });
    return Object.fromEntries(
      Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => [k, Math.round(v * 100) / 100])
    );
  };
  const modeBreakdown = sumModes(aApi.slice(0, 30));

  // transportation-only aggregates (occupancy-allocated personal)
  const sumPersonal = (entries) =>
    Math.round(entries.reduce((s, e) => {
      if (typeof e.transportPersonal === 'number') return s + e.transportPersonal;
      return s + (e.breakdown?.transport || 0); // legacy fallback
    }, 0) * 100) / 100;

  const transport = {
    dailyPersonal: sumPersonal(dApi),
    weeklyPersonal: sumPersonal(wApi),
    monthlyPersonal: sumPersonal(mApi),
  };

  const trend = aApi.slice(0, 30).reverse().map((e) => ({
    date: e.date,
    total: e.totalEmissions,
    ...e.breakdown,
  }));

  // ML predictions keep their existing scope id (the Mongo user id) so models
  // and behavior are unchanged.
  const predictions = await getPredictions(
    userId.toString(),
    aApi.slice(0, 60),
    'user',
    userId.toString()
  );
  const latestBreakdown = aApi[0]?.breakdown || categoryBreakdown;
  const shapExplanation = await getShapExplanation(
    latestBreakdown,
    aApi[0]?.totalEmissions || 0,
    'user',
    userId.toString()
  );

  res.json({
    daily: Math.round(dailyTotal * 100) / 100,
    weekly: Math.round(weeklyTotal * 100) / 100,
    monthly: Math.round(monthlyTotal * 100) / 100,
    total: Math.round(allTimeTotal * 100) / 100,
    transport,
    categoryBreakdown,
    modeBreakdown,
    trend,
    predictions,
    shapExplanation,
    entryCount: aApi.length,
  });
});

router.get('/:id', protect, async (req, res) => {
  const tenant = authTenant(req);
  const entry = await carbonRepository.findById(tenant, req.params.id);
  if (!entry) return res.status(404).json({ message: 'Entry not found' });
  res.json(toApiEntry(entry));
});

router.delete('/:id', protect, async (req, res) => {
  const tenant = authTenant(req);
  const entry = await carbonRepository.findById(tenant, req.params.id);
  if (!entry) return res.status(404).json({ message: 'Entry not found' });
  await carbonRepository.remove(tenant, req.params.id);
  res.json({ message: 'Entry deleted' });
});

module.exports = router;
