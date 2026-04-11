/**
 * Единая стратегия переподключения Supabase Realtime (экспоненциальный backoff, cap).
 * Используется в ChatContext (список диалогов), use-realtime-chat и legacy-хуках.
 *
 * @see docs/TECHNICAL_MANIFESTO.md
 */

import { applyRealtimeSessionJwt } from '@/lib/chat/realtime-session-jwt'
import { warnRealtimeChannelFailure } from '@/lib/chat/realtime-dev-warn'

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
 * @param {string} [opts.channelLabel] — метка для dev-предупреждений в консоли.
 */
export function subscribeRealtimeWithBackoff({
  supabase,
  createChannel,
  onChannelStatus,
  afterSubscribed,
  channelLabel,
}) {
  let cancelled = false
  let attempt = 0
  let retryTimer = null
  let deferRemoveTimer = null
  let activeChannel = null

  const run = () => {
    if (cancelled || !supabase) return

    void (async () => {
      await applyRealtimeSessionJwt(supabase)
      if (cancelled || !supabase) return

      const ch = createChannel(attempt)
      activeChannel = ch
      /** Синхронный removeChannel из callback подписки даёт рекурсию unsubscribe → stack overflow. */
      let disconnectHandled = false

      ch.subscribe((status) => {
        onChannelStatus?.(status, { attempt })

        if (status === 'SUBSCRIBED') {
          attempt = 0
          disconnectHandled = false
          Promise.resolve(afterSubscribed?.(ch)).catch(() => {})
          return
        }

        if (!REALTIME_RETRY_STATUSES.has(status)) return
        if (cancelled || disconnectHandled) return
        disconnectHandled = true

        const label = channelLabel || 'realtime-channel'
        void warnRealtimeChannelFailure(label, status, { attempt })

        const chToRemove = ch
        const delay = realtimeBackoffDelayMs(attempt)
        attempt += 1

        if (deferRemoveTimer) {
          clearTimeout(deferRemoveTimer)
          deferRemoveTimer = null
        }
        deferRemoveTimer = setTimeout(() => {
          deferRemoveTimer = null
          if (cancelled) return
          try {
            if (supabase && activeChannel === chToRemove) {
              supabase.removeChannel(chToRemove)
            }
          } finally {
            if (activeChannel === chToRemove) activeChannel = null
          }
          if (cancelled) return
          retryTimer = setTimeout(() => {
            retryTimer = null
            run()
          }, delay)
        }, 0)
      })
    })()
  }

  run()

  return () => {
    cancelled = true
    if (deferRemoveTimer) {
      clearTimeout(deferRemoveTimer)
      deferRemoveTimer = null
    }
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    const toRemove = activeChannel
    activeChannel = null
    if (toRemove && supabase) {
      setTimeout(() => {
        try {
          supabase.removeChannel(toRemove)
        } catch {
          /* ignore */
        }
      }, 0)
    }
  }
}
