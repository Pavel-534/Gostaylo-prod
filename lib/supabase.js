import { createClient } from '@supabase/supabase-js';

// Публичные ключи (SSOT с OAuth: `lib/supabase/oauth-browser-client.js` — те же имена env)
const supabasePublicUrl = normalizeSupabaseBaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseServerUrl = normalizeSupabaseBaseUrl(
  process.env.SUPABASE_SERVER_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
);
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function normalizeSupabaseBaseUrl(url) {
  if (!url || !String(url).trim()) return '';
  return String(url).trim().replace(/\/$/, '');
}

/** Браузер / Realtime / OAuth start — прокси или публичный origin (Split: `NEXT_PUBLIC_SUPABASE_URL`). */
export function getSupabasePublicUrl() {
  return supabasePublicUrl;
}

/** Сервер (API, middleware, OAuth token exchange) — прямой Supabase host (Split: `SUPABASE_SERVER_URL`). */
export function getSupabaseServerUrl() {
  return supabaseServerUrl;
}

// Public client (for frontend/public operations)
// Will be null if env vars are missing
export const supabase = supabasePublicUrl && supabaseAnonKey
  ? createClient(supabasePublicUrl, supabaseAnonKey, {
      realtime: {
        params: { eventsPerSecond: 20 },
      },
    })
  : null;

// Admin client (for server-side operations with full access)
// Will be null if service key is missing
export const supabaseAdmin = supabaseServerUrl && supabaseServiceKey
  ? createClient(supabaseServerUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return !!(supabasePublicUrl && supabaseAnonKey);
};

// Helper to check admin access
export const isAdminConfigured = () => {
  return !!(supabaseServerUrl && supabaseServiceKey);
};

// Debug helper - call this in API routes to check status
export const getSupabaseStatus = () => ({
  publicUrl: supabasePublicUrl ? 'SET' : 'MISSING',
  serverUrl: supabaseServerUrl ? 'SET' : 'MISSING',
  anon: supabaseAnonKey ? 'SET' : 'MISSING',
  service: supabaseServiceKey ? 'SET' : 'MISSING',
  publicClient: supabase ? 'OK' : 'NULL',
  adminClient: supabaseAdmin ? 'OK' : 'NULL'
});

export default supabase;
