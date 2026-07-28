const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, uppercase: true, trim: true }
}, { timestamps: true });

// A department code must be unique within a single college
departmentSchema.index({ collegeId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Department', departmentSchema);
