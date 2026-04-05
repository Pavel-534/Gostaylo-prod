/**
 * Единая стратегия переподключения Supabase Realtime (экспоненциальный backoff, cap).
 * Используется в ChatContext (список диалогов), use-realtime-chat и legacy-хуках.
 *
 * @see docs/TECHNICAL_MANIFESTO.md
 */

export const REALTIME_BACKOFF_CAP_MS = 30_000
export const REALTIME_BACKOFF_BASE_MS = 1_000

/** Статусы канала, после которых пересоздаём подписку. */
export const REALTIME_RETRY_STATUSES = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'])

export function realtimeBackoffDelayMs(attempt) {
  return Math.min(
    REALTIME_BACKOFF_CAP_MS,
    REALTIME_BACKOFF_BASE_MS * 2 ** Math.min(attempt, 5),
  )
}

/**
 * @param {object} opts
 * @param {import('@supabase/supabase-js').SupabaseClient} opts.supabase
 * @param {(attempt: number) => import('@supabase/supabase-js').RealtimeChannel} opts.createChannel
 *   Канал со всеми `.on(...)`, **без** вызова `.subscribe` — его делает эта функция.
 * @param {(status: string, ctx: { attempt: number }) => void} [opts.onChannelStatus]
 * @param {(channel: import('@supabase/supabase-js').RealtimeChannel) => void | Promise<void>} [opts.afterSubscribed]
 *   Вызов после `SUBSCRIBED` (например `channel.track` для presence).
 */
export function subscribeRealtimeWithBackoff({
  supabase,
  createChannel,
  onChannelStatus,
  afterSubscribed,
}) {
  let cancelled = false
  let attempt = 0
  let retryTimer = null
  let activeChannel = null

  const run = () => {
    if (cancelled || !supabase) return

    const ch = createChannel(attempt)
    activeChannel = ch

    ch.subscribe((status) => {
      onChannelStatus?.(status, { attempt })

      if (status === 'SUBSCRIBED') {
        attempt = 0
        Promise.resolve(afterSubscribed?.(ch)).catch(() => {})
        return
      }

      if (!REALTIME_RETRY_STATUSES.has(status)) return
      if (cancelled) return

      supabase.removeChannel(ch)
      if (activeChannel === ch) activeChannel = null

      const delay = realtimeBackoffDelayMs(attempt)
      attempt += 1
      retryTimer = setTimeout(() => {
        retryTimer = null
        run()
      }, delay)
    })
  }

  run()

  return () => {
    cancelled = true
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    if (activeChannel && supabase) {
      supabase.removeChannel(activeChannel)
      activeChannel = null
    }
  }
}
