require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const carbonRoutes = require('./routes/carbon');
const simulatorRoutes = require('./routes/simulator');
const aiRoutes = require('./routes/ai');
const gamificationRoutes = require('./routes/gamification');
const reportsRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');

connectDB().then(() => {
  const seedHelper = require('./scripts/seedHelper');
  seedHelper().catch((err) => console.error('Database seeding failed:', err));
});

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'EcoGuardian AI Backend', sdg: 'SDG 13 - Climate Action' });
});

app.use('/api/auth', authRoutes);
app.use('/api/carbon', carbonRoutes);
app.use('/api/simulator', simulatorRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`EcoGuardian AI Backend running on port ${PORT}`);
});
