/**
 * Перед подпиской на postgres_changes в Realtime подставляет JWT сессии сайта,
 * чтобы RLS (auth.uid()) совпадал с профилем. Иначе события по messages/conversations не приходят.
 *
 * Вызывается из subscribeRealtimeWithBackoff на клиенте перед createChannel.
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 */
export async function applyRealtimeSessionJwt(supabase) {
  if (!supabase || typeof window === 'undefined') return
  try {
    const res = await fetch('/api/v2/auth/realtime-token', {
      credentials: 'include',
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      if (data?.access_token) {
        supabase.realtime.setAuth(data.access_token)
        return
      }
    }
    supabase.realtime.setAuth(null)
  } catch {
    try {
      supabase.realtime.setAuth(null)
    } catch {
      /* ignore */
    }
  }
}
