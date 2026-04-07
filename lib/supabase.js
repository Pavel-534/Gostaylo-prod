import { createClient } from '@supabase/supabase-js';

// These will be populated at runtime from Vercel environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Public client (for frontend/public operations)
// Will be null if env vars are missing
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: { eventsPerSecond: 20 },
      },
    })
  : null;

// Admin client (for server-side operations with full access)
// Will be null if service key is missing
export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey);
};

// Helper to check admin access
export const isAdminConfigured = () => {
  return !!(supabaseUrl && supabaseServiceKey);
};

// Debug helper - call this in API routes to check status
export const getSupabaseStatus = () => ({
  url: supabaseUrl ? 'SET' : 'MISSING',
  anon: supabaseAnonKey ? 'SET' : 'MISSING', 
  service: supabaseServiceKey ? 'SET' : 'MISSING',
  publicClient: supabase ? 'OK' : 'NULL',
  adminClient: supabaseAdmin ? 'OK' : 'NULL'
});

export default supabase;
