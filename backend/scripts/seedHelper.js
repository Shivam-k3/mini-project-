const User = require('../models/User');
const Challenge = require('../models/Challenge');
const College = require('../models/College');
const Department = require('../models/Department');
const EmissionFactor = require('../models/EmissionFactor');
const { FACTOR_DATASET } = require('../utils/factorResolver');

/**
 * Transport-focused platform challenges (spec §34).
 * No food/water/waste/energy challenges.
 */
const challenges = [
  { title: 'Car-Free Day', description: 'Complete one full day using only active or public transport', category: 'transport', points: 40, badge: 'first_entry', weekNumber: 1 },
  { title: 'Public Transport Week', description: 'Use only bus/metro for your commute 5 days straight', category: 'transport', points: 60, badge: 'green_commuter', weekNumber: 1 },
  { title: 'Carpool Challenge', description: 'Share your car with at least 2 occupants for 3 days', category: 'transport', points: 50, badge: 'green_commuter', weekNumber: 2 },
  { title: 'Green Commute Challenge', description: 'Cycle or walk trips under 3 km for a week', category: 'transport', points: 45, badge: 'eco_hero', weekNumber: 2 },
  { title: 'Walk + Metro Combo', description: 'Replace short car trips with walking-to-metro chains', category: 'transport', points: 55, badge: 'challenge_champ', weekNumber: 3 },
  { title: 'Reduce Solo Trips', description: 'Cut solo car occupancy trips by half this week', category: 'transport', points: 65, badge: 'carbon_cut', weekNumber: 3 },
  { title: 'Efficient Vehicle Switch', description: 'Run a vehicle-replacement simulation in your Mobility Twin', category: 'transport', points: 35, badge: 'challenge_champ', weekNumber: 4 },
  { title: 'Eco Streak', description: 'Log mobility entries for 7 consecutive days', category: 'general', points: 70, badge: 'week_streak', weekNumber: 4 },
];

/**
 * Idempotent emission-factor seeding from config/emission-factors.json.
 * - Upserts generic-mode and category-level rows (identified by empty manufacturer).
 * - NEVER deletes rows: super-admin-curated vehicle catalog entries survive.
 */
async function seedEmissionFactors() {
  if (!FACTOR_DATASET) {
    console.warn('emission-factors.json missing — skipping factor seed');
    return;
  }
  const version = FACTOR_DATASET.version;
  const ops = [];

  // Generic mode-level factors
  for (const [mode, row] of Object.entries(FACTOR_DATASET.modes)) {
    ops.push({
      updateOne: {
        filter: { mode, manufacturer: '', vehicle_category: '' },
        update: {
          $set: {
            co2_kg_per_km: row.co2_kg_per_km,
            source: row.source || '',
            source_url: row.source_url || '',
            source_year: row.source_year || null,
            region: 'IN',
            confidence_level: row.confidence_level || 'low',
            active: true,
            datasetVersion: version,
          },
        },
        upsert: true,
      },
    });
  }

  // Category-level factors
  for (const row of FACTOR_DATASET.vehicle_categories) {
    ops.push({
      updateOne: {
        filter: { mode: row.mode, manufacturer: '', vehicle_category: row.vehicle_category, fuel_type: row.fuel_type },
        update: {
          $set: {
            co2_kg_per_km: row.co2_kg_per_km || 0,
            kwh_per_km: row.kwh_per_km || null,
            source: 'Indicative category default (see dataset honesty policy)',
            source_url: '',
            source_year: null,
            region: 'IN',
            confidence_level: row.confidence_level || 'low',
            active: true,
            datasetVersion: version,
          },
        },
        upsert: true,
      },
    });
  }

  // Grid electricity factor (unit: kg CO2 per kWh, stored in co2_kg_per_km column)
  const grid = FACTOR_DATASET.grid_electricity;
  ops.push({
    updateOne: {
      filter: { mode: 'grid_electricity' },
      update: {
        $set: {
          co2_kg_per_km: grid.factor_kg_per_kwh,
          source: grid.source,
          source_url: grid.source_url,
          source_year: grid.source_year,
          region: grid.region,
          confidence_level: grid.confidence_level,
          active: true,
          datasetVersion: version,
        },
      },
      upsert: true,
    },
  });

  await EmissionFactor.bulkWrite(ops);
  console.log(`Emission factors seeded/upserted (${ops.length} rows, dataset v${version})`);
}

/**
 * Platform-wide challenge catalog (collegeId: null, departmentId: null).
 *
 * Challenges belong to the platform, not to a tenant: a personal-mode user has
 * no college to scope against, and an organization member sees these alongside
 * whatever their college adds. Idempotent (upsert by title) and deliberately
 * outside the destructive demo reset below, so the catalog survives a re-seed.
 */
async function seedPlatformChallenges() {
  const ops = challenges.map((ch) => ({
    updateOne: {
      filter: { title: ch.title, collegeId: null, departmentId: null },
      // isActive is left alone: the schema default covers inserts, and an admin
      // who deactivated a challenge should not have it silently switched back on.
      update: { $set: { ...ch, collegeId: null, departmentId: null } },
      upsert: true,
    },
  }));
  await Challenge.bulkWrite(ops);
  console.log(`${ops.length} platform-wide transport challenges seeded/upserted`);
}

async function seedHelper() {
  await seedEmissionFactors();
  await seedPlatformChallenges();

  const existingUsers = await User.countDocuments();
  const forceReseed = process.env.FORCE_RESEED === 'true';

  if (existingUsers > 0 && !forceReseed) {
    console.log(`Database already has ${existingUsers} users — skipping destructive demo seed (set FORCE_RESEED=true to override).`);
    return;
  }

  console.log('Resetting and seeding database for multi-tenancy & RBAC...');

  // 1. Clear existing collections to ensure fresh schema compatibility.
  //    Only tenant-owned challenges are dropped — the platform catalog above is
  //    shared by both user modes and is not demo data.
  await User.deleteMany({});
  await College.deleteMany({});
  await Department.deleteMany({});
  await Challenge.deleteMany({ collegeId: { $ne: null } });

  console.log('Database cleared.');

  // 2. Seed Super Admin
  await User.create({
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

  // 4. Seed Departments
  const cseDept = await Department.create({
    collegeId: college._id,
    name: 'Computer Science & Engineering',
    code: 'CSE'
  });
  await Department.create({
    collegeId: college._id,
    name: 'Electronics & Communication Engineering',
    code: 'ECE'
  });
  console.log('Departments seeded: CSE, ECE');

  // 5. Seed College Admin
  await User.create({
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
  await User.create({
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
  await User.create({
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

  // 8. Seed college- and department-scoped demo challenges. The platform catalog
  //    is already visible to every user in both modes; these exercise the
  //    organization scoping path on top of it.
  await Challenge.insertMany([
    {
      title: 'MIT Campus Cycle Week',
      description: 'Cycle to campus every day this week',
      category: 'transport', points: 50, badge: 'green_commuter', weekNumber: 1,
      collegeId: college._id, departmentId: null,
    },
    {
      title: 'CSE Shuttle Swap',
      description: 'Swap solo car commutes for the CSE block shuttle',
      category: 'transport', points: 40, badge: 'green_commuter', weekNumber: 2,
      collegeId: college._id, departmentId: cseDept._id,
    },
  ]);
  console.log('2 organization-scoped demo challenges seeded (1 college-wide, 1 CSE-only)');

  console.log('Seeding verification complete.');
}

module.exports = seedHelper;
