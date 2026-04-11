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

/** Декод payload JWT (без проверки подписи) — для сравнения sub/exp. */
function decodeJwtPayload(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? b64 : b64 + '='.repeat(4 - (b64.length % 4))
    const json = JSON.parse(atob(pad))
    return json && typeof json === 'object' ? json : null
  } catch {
    return null
  }
}

/**
 * Не вызывать setAuth с «свежим» JWT тем же пользователем, пока старый ещё жив —
 * иначе каждый fetch даёт новую строку (другой iat) → постоянный reconnect всех каналов
 * → removeChannel/unsubscribe → Maximum call stack size exceeded.
 */
function shouldSkipRealtimeSetAuth(prevToken, nextToken) {
  if (!prevToken || !nextToken) return false
  const prev = decodeJwtPayload(prevToken)
  const next = decodeJwtPayload(nextToken)
  if (!prev?.sub || !next?.sub || String(prev.sub) !== String(next.sub)) return false
  const prevExpMs = Number(prev.exp) * 1000
  if (!Number.isFinite(prevExpMs) || prevExpMs <= 0) return false
  /** Не меньше ~10 мин до exp: иначе каждый fetch (другой iat) рвёт каналы; но за 10 мин до конца — обновляем (интервал 50 мин). */
  const skewMs = 600_000
  if (Date.now() >= prevExpMs - skewMs) return false
  return true
}

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
 * Вызывает realtime.setAuth только если токен реально сменился или скоро истечёт.
 * @returns {boolean} true, если был вызван setAuth
 */
export function applyRealtimeAccessTokenToClient(supabase, accessToken) {
  if (!supabase || typeof accessToken !== 'string' || !accessToken) return false
  if (lastSetToken === accessToken || shouldSkipRealtimeSetAuth(lastSetToken, accessToken)) {
    return false
  }
  lastSetToken = accessToken
  supabase.realtime.setAuth(accessToken)
  return true
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
      if (lastSetToken) {
        const p = decodeJwtPayload(lastSetToken)
        const expMs = Number(p?.exp) * 1000
        if (Number.isFinite(expMs) && Date.now() < expMs - 300_000) {
          // Даже без нового fetch повторно прокидываем токен в realtime клиент:
          // после переподключения сокета это помогает восстановить postgres_changes без refresh страницы.
          try {
            supabase.realtime.setAuth(lastSetToken)
          } catch {
            /* ignore */
          }
          return
        }
      }
      const res = await fetch('/api/v2/auth/realtime-token', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data?.access_token) {
          applyRealtimeAccessTokenToClient(supabase, data.access_token)
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
