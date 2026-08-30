const mongoose = require('mongoose');

/**
 * Transportation-focused entry (platform v3).
 *
 * NEW canonical shape: `trips[]` — one subdoc per trip with vehicle info,
 * resolved emission factor and occupancy allocation (see utils/tripEngine.js).
 *
 * LEGACY fields (transport km aggregates, electricity/water/food/shopping/
 * waste/fuel) are retained for historical/archival compatibility only.
 * They MUST NOT feed the transportation ML pipeline (spec §37) — the ML
 * feature extractor reads trips/mode data exclusively.
 */
const vehicleSchema = new mongoose.Schema(
  {
    manufacturer: { type: String, default: '' },
    model: { type: String, default: '' },
    variant: { type: String, default: '' },
    category: {
      type: String,
      enum: ['', 'hatchback', 'sedan', 'suv', 'scooter', 'standard', 'performance'],
      default: '',
    },
    fuelType: { type: String, enum: ['', 'petrol', 'diesel', 'cng', 'electric', 'lpg'], default: '' },
    fuelEfficiencyKmpl: { type: Number, default: null },
    electricityConsumptionKwhPerKm: { type: Number, default: null },
    declaredCo2GPerKm: { type: Number, default: null },
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      required: true,
      enum: ['car', 'motorcycle', 'auto_rickshaw', 'bus', 'metro', 'ev', 'bicycle', 'walk', 'flight'],
    },
    distanceKm: { type: Number, required: true, min: 0 },
    occupants: { type: Number, default: 1, min: 1, max: 8 },
    tripFrequency: { type: Number, default: 1, min: 1 },
    purpose: {
      type: String,
      enum: ['commute', 'college', 'office', 'school', 'personal', 'other'],
      default: 'other',
    },
    vehicle: { type: vehicleSchema, default: () => ({}) },
    resolved: {
      factorKgPerKm: { type: Number, default: 0 },
      factorLevel: {
        type: String,
        enum: ['vehicle-specific', 'category', 'efficiency-derived', 'generic-mode'],
        default: 'generic-mode',
      },
      factorSource: { type: String, default: '' },
      // Provenance (spec §11): where the factor came from and how it was
      // derived, so a stored entry stays auditable even after the dataset is
      // re-versioned. Written by the trip engine only — never from the client.
      sourceUrl: { type: String, default: '' },
      sourceYear: { type: Number, default: null },
      methodology: { type: String, default: '' },
    },
    tripTotalEmission: { type: Number, default: 0 },
    personalAllocatedEmission: { type: Number, default: 0 },
  },
  { _id: false }
);

const carbonEntrySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now },

  // ── v3 canonical transportation data ─────────────────────────────
  trips: { type: [tripSchema], default: [] },
  transportPersonal: { type: Number, default: 0 },   // occupancy-allocated kg CO2
  transportHousehold: { type: Number, default: 0 },  // raw pre-allocation kg CO2
  modeBreakdown: { type: Map, of: Number, default: {} },

  // ── legacy v2 lifestyle fields (archival; not in ML pipeline) ────
  transport: {
    bike: { type: Number, default: 0 },
    bus: { type: Number, default: 0 },
    metro: { type: Number, default: 0 },
    car: { type: Number, default: 0 },
    ev: { type: Number, default: 0 },
    flight: { type: Number, default: 0 },
    carOccupants: { type: Number, default: 1, min: 1, max: 8 },
  },
  electricity: { type: Number, default: 0 },
  water: { type: Number, default: 0 },
  foodHabit: { type: String, enum: ['vegetarian', 'nonVegetarian', 'vegan'], default: 'nonVegetarian' },
  shoppingFrequency: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  wasteGeneration: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  fuel: {
    petrol: { type: Number, default: 0 },
    diesel: { type: Number, default: 0 },
    lpg: { type: Number, default: 0 },
  },
  solarPanels: { type: Boolean, default: false },
  totalEmissions: { type: Number, default: 0 },
  breakdown: {
    transport: { type: Number, default: 0 },
    electricity: { type: Number, default: 0 },
    water: { type: Number, default: 0 },
    food: { type: Number, default: 0 },
    shopping: { type: Number, default: 0 },
    waste: { type: Number, default: 0 },
    fuel: { type: Number, default: 0 },
  },
  householdTotal: { type: Number, default: 0 },
  householdBreakdown: {
    transport: { type: Number, default: 0 },
    electricity: { type: Number, default: 0 },
    water: { type: Number, default: 0 },
    food: { type: Number, default: 0 },
    shopping: { type: Number, default: 0 },
    waste: { type: Number, default: 0 },
    fuel: { type: Number, default: 0 },
  },
  notes: { type: String, default: '' },
}, { timestamps: true });

carbonEntrySchema.index({ user: 1, date: -1 });
carbonEntrySchema.index({ 'trips.mode': 1 });

module.exports = mongoose.model('CarbonEntry', carbonEntrySchema);
