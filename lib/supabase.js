import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Log initialization status (will appear in Vercel Function logs)
console.log('[SUPABASE INIT]', {
  url: supabaseUrl ? 'SET' : 'MISSING',
  anon: supabaseAnonKey ? 'SET' : 'MISSING',
  service: supabaseServiceKey ? 'SET' : 'MISSING'
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[SUPABASE] Missing public credentials - falling back to mock mode');
}

if (!supabaseServiceKey) {
  console.error('[SUPABASE CRITICAL] SUPABASE_SERVICE_ROLE_KEY is missing! Admin operations will fail.');
}

// Public client (for frontend/public operations)
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Admin client (for server-side operations with full access)
export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Log client status
console.log('[SUPABASE CLIENTS]', {
  public: supabase ? 'INITIALIZED' : 'NULL',
  admin: supabaseAdmin ? 'INITIALIZED' : 'NULL'
});

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey && supabaseServiceKey);
};

export default supabase;
