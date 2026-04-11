/**
 * Перед подпиской на postgres_changes в Realtime подставляет JWT сессии сайта.
 * Вызывается из subscribeRealtimeWithBackoff перед createChannel.
 *
 * Защита от шторма: один параллельный fetch; не вызываем setAuth с тем же токеном повторно —
 * иначе Supabase рвёт каналы → backoff → снова fetch → тысячи запросов и stack overflow в removeChannel.
 */

/** @type {Promise<void> | null} */
let inFlight = null
let lastSetToken = null

/** Сброс при выходе / смене пользователя. */
export function resetRealtimeSessionJwtCache() {
  inFlight = null
  lastSetToken = null
}

/** Вызывать после `setAuth` из `SupabaseRealtimeAuthSync`, чтобы backoff не дёргал тот же токен повторно. */
export function noteRealtimeSessionJwtFromExternal(accessToken) {
  if (typeof accessToken === 'string' && accessToken.length > 0) {
    lastSetToken = accessToken
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 */
export async function applyRealtimeSessionJwt(supabase) {
  if (!supabase || typeof window === 'undefined') return

  if (inFlight) {
    await inFlight
    return
  }

  inFlight = (async () => {
    try {
      const res = await fetch('/api/v2/auth/realtime-token', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data?.access_token) {
          if (lastSetToken === data.access_token) {
            return
          }
          lastSetToken = data.access_token
          supabase.realtime.setAuth(data.access_token)
          return
        }
      }
      lastSetToken = null
      supabase.realtime.setAuth(null)
    } catch {
      try {
        supabase.realtime.setAuth(null)
      } catch {
        /* ignore */
      }
    } finally {
      inFlight = null
    }
  })()

  await inFlight
}
