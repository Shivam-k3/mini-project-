require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const { loginLimiter, predictionLimiter, aiLimiter, simulationLimiter, reportLimiter, submissionLimiter } = require('./middleware/rateLimit');
const { protect } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const carbonRoutes = require('./routes/carbon');
const simulatorRoutes = require('./routes/simulator');
const aiRoutes = require('./routes/ai');
const gamificationRoutes = require('./routes/gamification');
const reportsRoutes = require('./routes/reports');
const superAdminRoutes = require('./routes/superAdmin');
const collegeAdminRoutes = require('./routes/collegeAdmin');
const facultyRoutes = require('./routes/faculty');
const twinRoutes = require('./routes/twin');
const factorRoutes = require('./routes/factors');

connectDB().then(() => {
  const seedHelper = require('./scripts/seedHelper');
  seedHelper().catch((err) => console.error('Database seeding failed:', err));
});

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'EcoGuardian Backend', sdg: 'SDG 13 - Climate Action' });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the EcoGuardian API Backend!',
    status: 'online',
    health: '/api/health',
    sdg: 'SDG 13: Climate Action'
  });
});

app.use('/api/auth', loginLimiter, authRoutes);
// The per-user limiters key on req.user, so `protect` must run *before* them.
// Mounted without it they silently degraded to per-IP, which on a shared campus
// NAT meant one user's submission throttled the whole organization.
app.use('/api/carbon', protect, submissionLimiter, carbonRoutes);
app.use('/api/twin', twinRoutes);
// Read-only factor lookups: no submission limiter, the Calculator preview polls
// this while the user types (debounced + cached client-side).
app.use('/api/factors', factorRoutes);
app.use('/api/simulator', protect, simulationLimiter, simulatorRoutes);
app.use('/api/ai', protect, aiLimiter, aiRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/reports', protect, reportLimiter, reportsRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/collegeadmin', collegeAdminRoutes);
app.use('/api/faculty', facultyRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`EcoGuardian Backend running on port ${PORT}`);
});
