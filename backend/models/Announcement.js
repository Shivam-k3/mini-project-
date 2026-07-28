const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true },
  collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null }, // Null means global (platform-wide)
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);
