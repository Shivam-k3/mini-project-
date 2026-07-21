const User = require('../models/User');
const Challenge = require('../models/Challenge');

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
  console.log('Checking database content for seeding...');
  
  const adminExists = await User.findOne({ email: 'admin@ecoguardian.ai' });
  if (!adminExists) {
    await User.create({
      name: 'Admin',
      email: 'admin@ecoguardian.ai',
      password: 'admin123',
      role: 'admin',
      gamification: { ecoScore: 100, greenPoints: 1000, streak: 30, badges: ['eco_hero'] },
    });
    console.log('Admin user seeded: admin@ecoguardian.ai / admin123');
  } else {
    console.log('Admin user already exists');
  }

  const demoExists = await User.findOne({ email: 'demo@ecoguardian.ai' });
  if (!demoExists) {
    await User.create({
      name: 'Demo User',
      email: 'demo@ecoguardian.ai',
      password: 'demo123',
      gamification: { ecoScore: 65, greenPoints: 250, streak: 5, badges: ['first_entry'] },
    });
    console.log('Demo user seeded: demo@ecoguardian.ai / demo123');
  } else {
    console.log('Demo user already exists');
  }

  const existingChallenges = await Challenge.countDocuments();
  if (existingChallenges === 0) {
    await Challenge.insertMany(challenges);
    console.log(`${challenges.length} challenges seeded`);
  } else {
    console.log('Challenges already exist');
  }

  console.log('Seeding verification complete.');
}

module.exports = seedHelper;
