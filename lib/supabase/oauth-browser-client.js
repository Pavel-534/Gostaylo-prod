import { createBrowserClient } from '@supabase/auth-helpers-nextjs'

let singleton = null

/**
 * SSOT с `lib/supabase.js`: только `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (без service role в браузере).
 */
function readPublicSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  }
}

/** Origin для `redirectTo` в `signInWithOAuth` — текущий браузерный хост (preview / prod / localhost). */
export function getOAuthRedirectOrigin() {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

/**
 * Анон-клиент Supabase для OAuth (browser / PKCE). Вызывать только из клиентских компонентов.
 */
export function getOAuthBrowserSupabase() {
  if (typeof window === 'undefined') return null
  const { url, anonKey } = readPublicSupabaseEnv()
  if (!url || !anonKey) return null
  if (!singleton) {
    singleton = createBrowserClient(url, anonKey)
  }
  return singleton
}
