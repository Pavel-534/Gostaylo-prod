'use client'

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { retainTypingGlobalChannel } from '@/lib/chat/typing-global-channel'

/**
 * Broadcast «печатает…» через общий канал `typing:global:v1` (ref-count в lib/chat/typing-global-channel.js).
 * Индикация собеседника в треде — из ChatContext.typingByConversation (тот же канал, без второй подписки).
 */
export function useChatTyping(conversationId, userId, displayName) {
  const channelRef = useRef(null)
  const readyRef = useRef(false)
  const lastSentRef = useRef(0)
  const localTypingRef = useRef(false)
  const stopTimerRef = useRef(null)

  useEffect(() => {
    if (!conversationId || !userId || !supabase) return

    readyRef.current = false
    let cancelled = false
    const { getChannel, release } = retainTypingGlobalChannel(supabase)

    void (async () => {
      const channel = await getChannel()
      if (cancelled || !channel) return
      channelRef.current = channel
      readyRef.current = true
    })()

    return () => {
      cancelled = true
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
      release()
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

  return { broadcastTyping, broadcastTypingStop }
}
