'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } },
})

/**
 * Broadcast «печатает…» по каналу Realtime (отдельно от presence).
 */
export function useChatTyping(conversationId, userId, displayName) {
  const [peerTypingName, setPeerTypingName] = useState(null)
  const clearRef = useRef(null)
  const channelRef = useRef(null)
  const readyRef = useRef(false)
  const lastSentRef = useRef(0)

  useEffect(() => {
    if (!conversationId || !userId) return

    readyRef.current = false
    const channel = supabase.channel(`typing:${conversationId}`, {
      config: { broadcast: { self: false } },
    })

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!payload?.userId || String(payload.userId) === String(userId)) return
        setPeerTypingName(payload.name || 'Участник')
        if (clearRef.current) clearTimeout(clearRef.current)
        clearRef.current = setTimeout(() => setPeerTypingName(null), 4000)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') readyRef.current = true
      })

    channelRef.current = channel
    return () => {
      if (clearRef.current) clearTimeout(clearRef.current)
      readyRef.current = false
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [conversationId, userId])

  const broadcastTyping = useCallback(() => {
    if (!readyRef.current || !channelRef.current || !userId) return
    const now = Date.now()
    if (now - lastSentRef.current < 400) return
    lastSentRef.current = now
    try {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId, name: displayName || 'User' },
      })
    } catch {
      /* Realtime / send может бросить при сетевых сбоях — не роняем UI */
    }
  }, [userId, displayName])

  return { peerTypingName, broadcastTyping }
}
