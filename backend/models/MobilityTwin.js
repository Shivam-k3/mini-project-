const mongoose = require('mongoose');

/**
 * MobilityTwin — a per-user digital twin of their transportation behaviour.
 *
 * The twin is DERIVED from the user's CarbonEntry history (never manually
 * edited) and stores:
 *   - baseline: average daily personal transport emissions + mode mix
 *   - vehicleProfile: the user's primary vehicle (for replacement analysis)
 *   - scenarios: saved what-if scenarios evaluated via the ML service
 *   - modelMetadata: which ML scope/version the twin's forecasts come from
 *
 * One twin per user. Re-derivation replaces baseline but preserves saved
 * scenarios.
 */
const scenarioSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    changes: { type: mongoose.Schema.Types.Mixed, required: true },
    result: {
      reductionKg: Number,
      reductionPercent: Number,
      yearlySavingsKg: Number,
      scenarioDailyKg: Number,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const mobilityTwinSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },

    // ---- derived baseline (from last N days of entries) -------------------
    baseline: {
      windowDays: { type: Number, default: 28 },
      entryCount: { type: Number, default: 0 },
      dailyPersonalKg: { type: Number, default: 0 },   // avg personal transport kg/day
      weeklyPersonalKg: { type: Number, default: 0 },
      monthlyPersonalKg: { type: Number, default: 0 },
      modeBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} }, // mode -> avg kg/day
      weeklyKmByMode: { type: mongoose.Schema.Types.Mixed, default: {} }, // mode -> km/week
      occupancyProfile: { type: mongoose.Schema.Types.Mixed, default: {} }, // mode -> avg occupants
      dataQuality: {
        type: String,
        enum: ['no_data', 'sparse', 'moderate', 'good'],
        default: 'no_data',
      },
    },

    // ---- primary vehicle (most frequent car/ev/motorcycle trip vehicle) ---
    vehicleProfile: {
      mode: String,            // car | ev | motorcycle | auto_rickshaw | null
      manufacturer: String,
      model: String,
      variant: String,
      category: String,
      fuelType: String,
      fuelEfficiencyKmpl: Number,
      electricityConsumptionKwhPerKm: Number,
      declaredCo2GPerKm: Number,
      factorLevel: String,     // resolved level for transparency
      co2GPerKm: Number,       // effective g/km used for this vehicle
    },

    // ---- saved what-if scenarios ------------------------------------------
    scenarios: [scenarioSchema],

    // ---- ML linkage --------------------------------------------------------
    modelMetadata: {
      scope: { type: String, default: 'user' },
      scopeId: String,
      modelVersion: { type: String, default: '3.0.0' },
      sampleCount: { type: Number, default: 0 },
      predictionMethod: String, // rolling_average | hybrid | xgboost
      syncedAt: Date,
    },

    derivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MobilityTwin', mobilityTwinSchema);
