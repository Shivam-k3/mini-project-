require('dotenv').config();
const supabase = require('../services/supabase');
const seedHelper = require('./seedHelper');

async function seed() {
  if (!supabase.isConfigured()) {
    console.error('Supabase not configured. Set SUPABASE_URL + SUPABASE_SECRET_KEY in backend/.env.');
    process.exit(1);
  }
  console.log('Seeding PostgreSQL (Supabase)...');
  await seedHelper();
  console.log('Seed complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
