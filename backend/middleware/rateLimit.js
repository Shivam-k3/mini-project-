const rateLimit = require('express-rate-limit');

const { ipKeyGenerator } = require('express-rate-limit');

const trackByUser = (windowMs, max, message, skipFn) => rateLimit({
  windowMs,
  max,
  message: { message },
  keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  ...(skipFn ? { skip: skipFn } : {}),
});

// Login: only FAILED attempts count, keyed per account + IP so one user's
// failures never block others on a shared campus network. Successful logins
// are exempt (skipSuccessfulRequests) — frequent legit logins stay frictionless.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const account = String(req.body?.emailOrUserId || 'unknown').toLowerCase().trim();
    return `login:${ipKeyGenerator(req.ip)}:${account}`;
  },
});

const predictionLimiter = trackByUser(
  60 * 60 * 1000, 30, 'Prediction limit reached (30/hour). Try again later.'
);

const aiLimiter = trackByUser(
  24 * 60 * 60 * 1000, 20, 'AI message limit reached (20/day). Try again tomorrow.'
);

const simulationLimiter = trackByUser(
  24 * 60 * 60 * 1000, 50, 'Simulation limit reached (50/day). Try again tomorrow.'
);

const reportLimiter = trackByUser(
  24 * 60 * 60 * 1000, 10, 'Report limit reached (10/day). Try again tomorrow.'
);

// Submission throttle: only POST/PUT/DELETE (entry writes) are limited,
// so GET dashboard/history/list calls are never throttled.
const submissionLimiter = trackByUser(
  10 * 1000, 1, 'Please wait 10 seconds between submissions.',
  (req) => !['POST', 'PUT', 'DELETE'].includes(req.method)
);

module.exports = {
  loginLimiter,
  predictionLimiter,
  aiLimiter,
  simulationLimiter,
  reportLimiter,
  submissionLimiter,
};
