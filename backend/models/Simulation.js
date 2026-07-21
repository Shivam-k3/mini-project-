const mongoose = require('mongoose');

const simulationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  baseline: { type: mongoose.Schema.Types.Mixed },
  changes: { type: mongoose.Schema.Types.Mixed },
  results: {
    baselineTotal: Number,
    scenarioTotal: Number,
    reduction: Number,
    reductionPercent: Number,
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Simulation', simulationSchema);
