const mongoose = require('mongoose');

const collegeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  address: { type: String, trim: true, default: '' },
  license: {
    plan: { type: String, default: 'Standard' },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }, // 1 year default
    status: { type: String, enum: ['active', 'expired'], default: 'active' }
  },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('College', collegeSchema);
