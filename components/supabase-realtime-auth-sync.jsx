'use client'

/**
 * Подставляет JWT в Supabase Realtime, чтобы postgres_changes проходили RLS (auth.uid() = sub).
 * Без этого клиент с anon-ключом без сессии Supabase Auth не получает события по messages/conversations.
 */

import { useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'

const REFRESH_MS = 50 * 60 * 1000

export function SupabaseRealtimeAuthSync() {
  const { user } = useAuth()

  useEffect(() => {
    if (!supabase) return

    if (!user?.id) {
      try {
        supabase.realtime.setAuth(null)
      } catch {
        /* ignore */
      }
      return undefined
    }

    let cancelled = false
    let intervalId = null

    const sync = async () => {
      try {
        const res = await fetch('/api/v2/auth/realtime-token', { credentials: 'include' })
        if (cancelled || !res.ok) return
        const data = await res.json().catch(() => ({}))
        if (cancelled || !data?.access_token) return
        supabase.realtime.setAuth(data.access_token)
      } catch {
        /* ignore */
      }
    }

    void sync()
    intervalId = setInterval(() => void sync(), REFRESH_MS)

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
      try {
        supabase.realtime.setAuth(null)
      } catch {
        /* ignore */
      }
    }
  }, [user?.id])

  return null
}
