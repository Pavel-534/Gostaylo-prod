'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { subscribeRealtimeWithBackoff } from '@/lib/chat/realtime-subscribe-with-backoff'

const PresenceContext = createContext({
  onlineUserIds: [],
  isUserOnline: () => false,
})

const SITE_PRESENCE_CHANNEL = 'gostaylo-site-presence:v1'

export function PresenceProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.id ? String(user.id) : null
  const [onlineUserIds, setOnlineUserIds] = useState([])
  const channelRef = useRef(null)
  const heartbeatRef = useRef(null)
  const lastPersistedRef = useRef(0)

  const persistLastSeen = useCallback(() => {
    if (!userId) return
    const now = Date.now()
    if (now - lastPersistedRef.current < 8000) return
    lastPersistedRef.current = now
    const url = '/api/v2/presence/last-seen'
    const payload = JSON.stringify({ at: new Date(now).toISOString() })
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([payload], { type: 'application/json' })
        navigator.sendBeacon(url, blob)
        return
      }
    } catch {
      // Fallback to fetch
    }
    void fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  }, [userId])

  useEffect(() => {
    if (!userId || !supabase) {
      setOnlineUserIds([])
      return
    }

    const collectUserIds = (rows) => {
      const ids = []
      for (const p of rows) {
        if (!p || typeof p !== 'object') continue
        const id = p.user_id ?? p.userId ?? p.payload?.user_id
        if (id) ids.push(String(id))
      }
      return ids
    }

    const syncPresence = () => {
      const channel = channelRef.current
      if (!channel) return
      const state = channel.presenceState()
      const rows = Object.values(state).flat()
      const ids = collectUserIds(rows)
      setOnlineUserIds(Array.from(new Set(ids)))
    }

    const stop = subscribeRealtimeWithBackoff({
      supabase,
      createChannel: () => {
        const ch = supabase.channel(SITE_PRESENCE_CHANNEL, {
          config: { presence: { key: userId } },
        })
        channelRef.current = ch
        return ch
          .on('presence', { event: 'sync' }, syncPresence)
          .on('presence', { event: 'join' }, syncPresence)
          .on('presence', { event: 'leave' }, syncPresence)
      },
      afterSubscribed: async (ch) => {
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current)
          heartbeatRef.current = null
        }
        await ch.track({
          user_id: userId,
          online_at: new Date().toISOString(),
        })
        heartbeatRef.current = setInterval(() => {
          void ch.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          })
        }, 40000)
      },
    })

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
      channelRef.current = null
      stop()
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persistLastSeen()
    }
    const onPageHide = () => persistLastSeen()
    const onBeforeUnload = () => persistLastSeen()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
      persistLastSeen()
    }
  }, [userId, persistLastSeen])

  const onlineSet = useMemo(() => new Set(onlineUserIds), [onlineUserIds])
  const isUserOnline = useCallback((targetUserId) => {
    if (!targetUserId) return false
    return onlineSet.has(String(targetUserId))
  }, [onlineSet])

  const value = useMemo(() => ({ onlineUserIds, isUserOnline }), [onlineUserIds, isUserOnline])
  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
}

export function usePresenceContext() {
  return useContext(PresenceContext)
}
