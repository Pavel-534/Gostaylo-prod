/**
 * Client-only: clear persisted auth artifacts after server cleared HttpOnly cookies.
 * Keeps keys in sync with `contexts/auth/auth-actions.js` (OAuth return) and referral capture.
 * Stage 128.0: также `clearClientQueryCache()` — TanStack Query in-memory (wallet, partner, …).
 */

import { invalidateAllClientRequests } from '@/lib/api/client-request-dedup'
import { clearClientQueryCache } from '@/lib/query-client'
import { clearVanityWelcomeSession } from '@/lib/referral/vanity-welcome-session'

const LS_KEYS_ON_LOGOUT = [
  'gostaylo_user',
  'gostaylo_auth_token',
  'gostaylo_pending_ref_code',
  'gostaylo_oauth_return_to',
]

function clearSupabaseAuthStorage(store) {
  try {
    for (let i = store.length - 1; i >= 0; i--) {
      const k = store.key(i)
      if (!k) continue
      if (k.startsWith('sb-') && (k.includes('-auth-token') || k.endsWith('-auth-token'))) {
        store.removeItem(k)
      }
    }
  } catch {
    /* ignore */
  }
}

/** Clear localStorage / sessionStorage / document cookies used by app + Supabase browser client. */
export function clearBrowserPersistedAuthState() {
  if (typeof window === 'undefined') return

  invalidateAllClientRequests()
  clearClientQueryCache()

  clearVanityWelcomeSession()

  try {
    for (const k of LS_KEYS_ON_LOGOUT) {
      localStorage.removeItem(k)
    }
    localStorage.removeItem('gostaylo_user_id')
  } catch {
    /* ignore */
  }

  clearSupabaseAuthStorage(localStorage)
  clearSupabaseAuthStorage(sessionStorage)

  try {
    const secure = window.location.protocol === 'https:'
    const kill = `; Path=/; Max-Age=0; SameSite=Lax${secure ? '; Secure' : ''}`
    document.cookie = `gostaylo_pending_ref=${kill}`
    document.cookie = `gostaylo_oauth_legal=${kill}`
  } catch {
    /* ignore */
  }
}
