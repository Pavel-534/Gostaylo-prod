'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { subscribeRealtimeWithBackoff } from '@/lib/chat/realtime-subscribe-with-backoff'

/**
 * Broadcast «печатает…» по каналу Realtime (отдельно от presence).
 */
export function useChatTyping(conversationId, userId, displayName) {
  const [peerTypingName, setPeerTypingName] = useState(null)
  const clearRef = useRef(null)
  const channelRef = useRef(null)
  const readyRef = useRef(false)
  const lastSentRef = useRef(0)
  const localTypingRef = useRef(false)
  const stopTimerRef = useRef(null)

  useEffect(() => {
    if (!conversationId || !userId || !supabase) return

    readyRef.current = false
    const stop = subscribeRealtimeWithBackoff({
      supabase,
      createChannel: () => {
        const channel = supabase.channel('typing:global:v1', {
          config: { broadcast: { self: false } },
        })
        channelRef.current = channel
        return channel
          .on('broadcast', { event: 'typing_start' }, ({ payload }) => {
            if (!payload?.userId || String(payload.userId) === String(userId)) return
            if (String(payload.conversationId || '') !== String(conversationId || '')) return
            setPeerTypingName(payload.name || 'Участник')
            if (clearRef.current) clearTimeout(clearRef.current)
            clearRef.current = setTimeout(() => setPeerTypingName(null), 4500)
          })
          .on('broadcast', { event: 'typing_stop' }, ({ payload }) => {
            if (!payload?.userId || String(payload.userId) === String(userId)) return
            if (String(payload.conversationId || '') !== String(conversationId || '')) return
            setPeerTypingName(null)
          })
      },
      afterSubscribed: async () => {
        readyRef.current = true
      },
    })

    return () => {
      if (clearRef.current) clearTimeout(clearRef.current)
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
      if (localTypingRef.current && channelRef.current) {
        try {
          channelRef.current.send({
            type: 'broadcast',
            event: 'typing_stop',
            payload: { userId, conversationId },
          })
        } catch {
          // ignore
        }
      }
      readyRef.current = false
      localTypingRef.current = false
      channelRef.current = null
      stop()
    }
  }, [conversationId, userId])

  const broadcastTypingStop = useCallback(() => {
    if (!channelRef.current || !userId || !localTypingRef.current) return
    localTypingRef.current = false
    try {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing_stop',
        payload: { userId, conversationId },
      })
    } catch {
      /* ignore */
    }
  }, [conversationId, userId])

  const broadcastTyping = useCallback(() => {
    if (!readyRef.current || !channelRef.current || !userId) return
    const now = Date.now()
    if (now - lastSentRef.current < 400) return
    lastSentRef.current = now
    try {
      if (!localTypingRef.current) {
        localTypingRef.current = true
        channelRef.current.send({
          type: 'broadcast',
          event: 'typing_start',
          payload: { userId, conversationId, name: displayName || 'User' },
        })
      }
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
      stopTimerRef.current = setTimeout(() => {
        broadcastTypingStop()
      }, 1400)

      channelRef.current.send({
        type: 'broadcast',
        event: 'typing_start',
        payload: { userId, conversationId, name: displayName || 'User' },
      })
    } catch {
      /* Realtime / send может бросить при сетевых сбоях — не роняем UI */
    }
  }, [userId, conversationId, displayName, broadcastTypingStop])

  return { peerTypingName, broadcastTyping, broadcastTypingStop }
}
