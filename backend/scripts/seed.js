require('dotenv').config();
const mongoose = require('mongoose');
const seedHelper = require('./seedHelper');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecoguardian';

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.');
  
  await seedHelper();
  
  console.log('Seed complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
