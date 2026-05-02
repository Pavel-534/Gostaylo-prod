import { createBrowserClient } from '@supabase/auth-helpers-nextjs'

let singleton = null

/**
 * Анон-клиент Supabase для OAuth (browser / PKCE). Вызывать только из клиентских компонентов.
 */
export function getOAuthBrowserSupabase() {
  if (typeof window === 'undefined') return null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  if (!singleton) {
    singleton = createBrowserClient(url, anon)
  }
  return singleton
}
