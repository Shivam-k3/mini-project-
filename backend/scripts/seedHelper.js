const User = require('../models/User');
const Challenge = require('../models/Challenge');
const College = require('../models/College');
const Department = require('../models/Department');

const challenges = [
  { title: 'Meat-Free Monday', description: 'Go vegetarian for one full day', category: 'food', points: 30, badge: 'first_entry', weekNumber: 1 },
  { title: 'Bike to Work', description: 'Use bicycle instead of car for 3 days', category: 'transport', points: 50, badge: 'green_commuter', weekNumber: 1 },
  { title: 'Power Down', description: 'Reduce electricity usage by 15% this week', category: 'energy', points: 40, badge: 'carbon_cut', weekNumber: 2 },
  { title: 'Zero Waste Day', description: 'Generate minimal waste for one day', category: 'waste', points: 35, badge: 'eco_hero', weekNumber: 2 },
  { title: 'Public Transit Week', description: 'Use only public transport for 5 days', category: 'transport', points: 60, badge: 'green_commuter', weekNumber: 3 },
  { title: 'Shop Smart', description: 'No unnecessary purchases this week', category: 'general', points: 25, badge: 'challenge_champ', weekNumber: 3 },
  { title: 'Solar Explorer', description: 'Run a solar panel simulation', category: 'energy', points: 45, badge: 'solar_pioneer', weekNumber: 4 },
  { title: 'Eco Streak', description: 'Log entries for 7 consecutive days', category: 'general', points: 70, badge: 'week_streak', weekNumber: 4 },
];

async function seedHelper() {
  console.log('Resetting and seeding database for multi-tenancy & RBAC...');

  // 1. Clear existing collections to ensure fresh schema compatibility
  await User.deleteMany({});
  await College.deleteMany({});
  await Department.deleteMany({});
  await Challenge.deleteMany({});

  console.log('Database cleared.');

  // 2. Seed Super Admin
  const superAdmin = await User.create({
    userId: 'SUPER001',
    name: 'Super Admin',
    email: 'super@ecoguardian.ai',
    password: 'admin123', // Will be hashed via pre-save hook
    role: 'super_admin',
    firstLogin: false,
    gamification: { ecoScore: 100, greenPoints: 1000, streak: 30, badges: ['eco_hero'] },
  });
  console.log('Super Admin seeded: super@ecoguardian.ai / admin123');

  // 3. Seed College
  const college = await College.create({
    name: 'Metro Institute of Technology',
    code: 'MIT',
    address: '100 University Ave, Metro City',
    license: { plan: 'Enterprise', expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), status: 'active' },
    status: 'active'
  });
  console.log('College seeded: Metro Institute of Technology (MIT)');

  // 4. Seed Department
  const cseDept = await Department.create({
    collegeId: college._id,
    name: 'Computer Science & Engineering',
    code: 'CSE'
  });
  const eceDept = await Department.create({
    collegeId: college._id,
    name: 'Electronics & Communication Engineering',
    code: 'ECE'
  });
  console.log('Departments seeded: CSE, ECE');

  // 5. Seed College Admin
  const collegeAdmin = await User.create({
    userId: 'ADMIN001',
    name: 'MIT Campus Admin',
    email: 'admin@ecoguardian.ai',
    password: 'admin123',
    role: 'college_admin',
    collegeId: college._id,
    firstLogin: false,
    gamification: { ecoScore: 80, greenPoints: 500, streak: 12, badges: [] },
  });
  console.log('College Admin seeded: admin@ecoguardian.ai / admin123');

  // 6. Seed Faculty
  const faculty = await User.create({
    userId: 'FAC001',
    name: 'Dr. Sarah Smith',
    email: 'sarah@mit.edu',
    password: 'Temp@123',
    role: 'faculty',
    collegeId: college._id,
    departmentId: cseDept._id,
    firstLogin: true,
  });
  console.log('Faculty seeded: sarah@mit.edu / Temp@123 (firstLogin: true)');

  // 7. Seed Student (CSE25001)
  const student = await User.create({
    userId: 'CSE25001',
    name: 'Jane Doe',
    email: 'demo@ecoguardian.ai',
    password: 'demo123',
    role: 'student',
    collegeId: college._id,
    departmentId: cseDept._id,
    semester: '3',
    section: 'A',
    firstLogin: false,
    gamification: { ecoScore: 65, greenPoints: 250, streak: 5, badges: ['first_entry'] },
  });
  console.log('Demo Student seeded: demo@ecoguardian.ai / demo123 (Jane Doe)');

  // 8. Seed Scoped Challenges
  const challengesToInsert = challenges.map(ch => ({
    ...ch,
    collegeId: college._id,
    departmentId: null // college-wide by default
  }));
  await Challenge.insertMany(challengesToInsert);
  console.log(`${challengesToInsert.length} challenges seeded`);

  console.log('Seeding verification complete.');
}

module.exports = seedHelper;
