const rateLimit = require('express-rate-limit');

const { ipKeyGenerator } = require('express-rate-limit');

const trackByUser = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { message },
  keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req),
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
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

const submissionLimiter = trackByUser(
  10 * 1000, 1, 'Please wait 10 seconds between submissions.'
);

module.exports = {
  loginLimiter,
  predictionLimiter,
  aiLimiter,
  simulationLimiter,
  reportLimiter,
  submissionLimiter,
};
