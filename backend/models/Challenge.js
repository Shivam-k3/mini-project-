const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['transport', 'energy', 'food', 'waste', 'general'], default: 'general' },
  points: { type: Number, default: 50 },
  targetReduction: { type: Number, default: 10 }, // percentage
  duration: { type: Number, default: 7 }, // days
  badge: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  weekNumber: { type: Number },
  collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Challenge', challengeSchema);
