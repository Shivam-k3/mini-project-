/**
 * Database bootstrap (Phase 3H — MongoDB removed).
 *
 * Supabase Auth + PostgreSQL are the SOLE datastore. This module no longer
 * connects to MongoDB; it only verifies the Supabase configuration the app is
 * going to talk to. MongoDB/mongoose/mongodb-memory-server are fully retired.
 */
const supabase = require('../services/supabase');

const connectDB = async () => {
  if (!supabase.isConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      console.error('Fatal: Supabase is not configured in production environment');
      process.exit(1);
    }
    console.warn('Supabase is not configured — API auth/tenancy features will be unavailable');
    return;
  }

  // Poke the Supabase API to confirm the client credentials actually work.
  try {
    const { count } = await supabase.profilesClient()
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .limit(1);
    console.log(`Supabase (PostgreSQL) connected — profiles reachable${count == null ? '' : ` (${count})`}`);
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`Fatal: Cannot reach Supabase in production: ${error.message}`);
      process.exit(1);
    }
    console.warn(`Supabase connectivity check failed: ${error.message}`);
  }
};

module.exports = connectDB;
