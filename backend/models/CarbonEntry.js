const mongoose = require('mongoose');

const carbonEntrySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now },
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

module.exports = mongoose.model('CarbonEntry', carbonEntrySchema);
