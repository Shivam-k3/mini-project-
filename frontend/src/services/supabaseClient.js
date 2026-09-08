import { createClient } from '@supabase/supabase-js';

// Supabase client for the browser. Only the PUBLISHABLE/anonymous key is used
// here — the secret key and DATABASE_URL are server-only and never shipped to
// the frontend (see frontend/.env.example).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseKey);
}

export default supabase;
