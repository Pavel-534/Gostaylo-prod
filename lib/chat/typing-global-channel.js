/**
 * Единый Realtime Broadcast-канал для typing (`typing:global:v1`).
 * Один экземпляр на клиент Supabase, ref-count: ChatContext (инбокс) + useChatTyping (отправка в треде).
 * Иначе два отдельных subscribe/removeChannel ломают друг друга.
 */

import { subscribeRealtimeWithBackoff } from '@/lib/chat/realtime-subscribe-with-backoff'

export const TYPING_GLOBAL_CHANNEL = 'typing:global:v1'

/** @type {null | { supabase: import('@supabase/supabase-js').SupabaseClient, channel: import('@supabase/supabase-js').RealtimeChannel | null, refCount: number, stopBackoff: (() => void) | null, subscribed: boolean, subWaiters: Array<() => void>, onStart: Set<(p: object) => void>, onStop: Set<(p: object) => void> }} */
let pool = null

function flushSubWaiters() {
  if (!pool) return
  const w = pool.subWaiters.splice(0)
  for (const r of w) {
    try {
      r()
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ onTypingStart?: (payload: object) => void, onTypingStop?: (payload: object) => void }} [opts]
 * @returns {{ getChannel: () => Promise<import('@supabase/supabase-js').RealtimeChannel | null>, release: () => void }}
 */
export function retainTypingGlobalChannel(supabase, opts = {}) {
  if (!supabase || typeof window === 'undefined') {
    return {
      getChannel: async () => null,
      release: () => {},
    }
  }

  if (!pool || pool.supabase !== supabase) {
    if (pool && pool.supabase !== supabase) {
      flushSubWaiters()
      pool.stopBackoff?.()
      pool = null
    }
    pool = {
      supabase,
      channel: null,
      refCount: 0,
      stopBackoff: null,
      subscribed: false,
      subWaiters: [],
      onStart: new Set(),
      onStop: new Set(),
    }

    pool.stopBackoff = subscribeRealtimeWithBackoff({
      supabase,
      channelLabel: TYPING_GLOBAL_CHANNEL,
      createChannel: () => {
        const ch = supabase.channel(TYPING_GLOBAL_CHANNEL, {
          config: { broadcast: { self: false } },
        })
        pool.channel = ch
        return ch
          .on('broadcast', { event: 'typing_start' }, ({ payload }) => {
            for (const fn of pool.onStart) {
              try {
                fn(payload)
              } catch {
                /* ignore */
              }
            }
          })
          .on('broadcast', { event: 'typing_stop' }, ({ payload }) => {
            for (const fn of pool.onStop) {
              try {
                fn(payload)
              } catch {
                /* ignore */
              }
            }
          })
      },
      afterSubscribed: (ch) => {
        pool.channel = ch
        pool.subscribed = true
        flushSubWaiters()
      },
    })
  }

  const { onTypingStart, onTypingStop } = opts
  if (typeof onTypingStart === 'function') pool.onStart.add(onTypingStart)
  if (typeof onTypingStop === 'function') pool.onStop.add(onTypingStop)
  pool.refCount++

  let released = false

  return {
    getChannel: async () => {
      if (!pool) return null
      if (!pool.subscribed) {
        await new Promise((resolve) => {
          if (!pool) {
            resolve()
            return
          }
          pool.subWaiters.push(resolve)
        })
      }
      return pool?.channel ?? null
    },
    release: () => {
      if (released) return
      released = true
      if (!pool) return
      if (typeof onTypingStart === 'function') pool.onStart.delete(onTypingStart)
      if (typeof onTypingStop === 'function') pool.onStop.delete(onTypingStop)
      pool.refCount--
      if (pool.refCount <= 0) {
        flushSubWaiters()
        pool.stopBackoff?.()
        pool.stopBackoff = null
        pool = null
      }
    },
  }
}
