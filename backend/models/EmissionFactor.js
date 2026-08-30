const mongoose = require('mongoose');

/**
 * Centralized, source-aware emission-factor registry.
 *
 * Hierarchy (resolved by utils/factorResolver.js):
 *   Level 1  vehicle-specific : exact manufacturer+model+variant, or user-declared CO2 g/km
 *   Level 2  category         : vehicle_category + fuel_type
 *   Level 3  generic-mode     : mode-level default
 *
 * Research integrity: no manufacturer rows are fabricated by the seed. Level-1
 * catalog entries may be curated by super admins; users may declare their own
 * vehicle's certified CO2 g/km which is stored on the trip, not here.
 */
const emissionFactorSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      required: true,
      enum: ['car', 'motorcycle', 'auto_rickshaw', 'bus', 'metro', 'ev', 'bicycle', 'walk', 'flight', 'grid_electricity'],
    },
    manufacturer: { type: String, default: '', set: (v) => (v || '').toLowerCase().trim() },
    model: { type: String, default: '', set: (v) => (v || '').toLowerCase().trim() },
    variant: { type: String, default: '', set: (v) => (v || '').toLowerCase().trim() },
    vehicle_category: { type: String, default: '', set: (v) => (v || '').toLowerCase().trim() },
    fuel_type: { type: String, default: '', set: (v) => (v || '').toLowerCase().trim() },

    // Canonical resolved intensity for this row.
    co2_kg_per_km: { type: Number, default: 0 },

    // EV-specific inputs (EVs are NEVER computed from liquid-fuel efficiency).
    kwh_per_km: { type: Number, default: null },

    // Provenance metadata (research integrity requirement).
    source: { type: String, default: '' },
    source_url: { type: String, default: '' },
    source_year: { type: Number, default: null },
    region: { type: String, default: 'IN' },
    confidence_level: { type: String, enum: ['high', 'medium', 'low'], default: 'low' },

    active: { type: Boolean, default: true },
    datasetVersion: { type: String, default: '' },
  },
  { timestamps: true }
);

// Exact-vehicle lookups (Level 1). Partial so generic/category rows don't collide.
emissionFactorSchema.index(
  { mode: 1, manufacturer: 1, model: 1, variant: 1 },
  { partialFilterExpression: { manufacturer: { $gt: '' } } }
);
// Category lookups (Level 2).
emissionFactorSchema.index({ mode: 1, vehicle_category: 1, fuel_type: 1 });
// Generic-mode lookups (Level 3): one row per mode with empty category.
emissionFactorSchema.index({ mode: 1, vehicle_category: 1 });

module.exports = mongoose.model('EmissionFactor', emissionFactorSchema);
