const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['super_admin', 'college_admin', 'faculty', 'student', 'individual'], default: 'individual' },
  collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  semester: { type: String, default: '' },
  section: { type: String, default: '' },
  firstLogin: { type: Boolean, default: true },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  profile: {
    avatar: { type: String, default: '' },
    location: { type: String, default: '' },
    bio: { type: String, default: '' },
    goal: { type: Number, default: 15 }, // daily CO2 goal in kg
  },
  gamification: {
    ecoScore: { type: Number, default: 50 },
    greenPoints: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    lastActiveDate: { type: Date },
    badges: [{ type: String }],
    completedChallenges: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Challenge' }],
  },
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
