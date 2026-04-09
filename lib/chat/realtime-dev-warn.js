/**
 * Только development: подсказка при сбое Realtime (JWT / RLS / публикация).
 */

const lastByKey = new Map()

/**
 * @param {string} channelLabel
 * @param {string} status
 * @param {{ attempt?: number }} [ctx]
 */
export async function warnRealtimeChannelFailure(channelLabel, status, ctx = {}) {
  if (process.env.NODE_ENV === 'production') return

  const key = `${channelLabel}:${status}`
  const now = Date.now()
  const prev = lastByKey.get(key) || 0
  if (now - prev < 25_000) return
  lastByKey.set(key, now)

  const attempt = ctx.attempt != null ? ` attempt=${ctx.attempt}` : ''
  let tokenHint = 'не удалось проверить /api/v2/auth/realtime-token'
  try {
    const res = await fetch('/api/v2/auth/realtime-token', {
      credentials: 'include',
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 401) {
      tokenHint = 'сессия не залогинена (401 на realtime-token)'
    } else if (res.status === 503 || !data?.access_token) {
      tokenHint =
        'сервер не выдал access_token (503 / пустой ответ) — проверьте SUPABASE_JWT_SECRET на сервере (JWT Secret в Supabase Dashboard)'
    } else {
      tokenHint =
        'эндпоинт realtime-token ответил с токеном; для postgres_changes смотрите RLS и publication таблиц в Supabase'
    }
  } catch {
    tokenHint = 'сеть/ошибка fetch realtime-token'
  }

  console.warn(
    `[GoStayLo Realtime] канал «${channelLabel}» статус ${status}${attempt}. ${tokenHint}`,
  )
}
