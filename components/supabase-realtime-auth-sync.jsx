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

        // Один раз за сессию вкладки: проверка claims (см. GET /api/v2/auth/realtime-claims).
        try {
          if (typeof window === 'undefined') return
          const flag = 'gostaylo_rt_claims_logged_v1'
          if (sessionStorage.getItem(flag)) return
          const cr = await fetch('/api/v2/auth/realtime-claims', { credentials: 'include' })
          if (!cr.ok) return
          const claims = await cr.json().catch(() => ({}))
          if (claims?.ok) {
            sessionStorage.setItem(flag, '1')
            // eslint-disable-next-line no-console -- намеренно один раз: диагностика Realtime JWT
            console.info('[GoStayLo Realtime] claims OK', {
              profile_id: claims.profile_id,
              app_role: claims.app_role,
              session_role: claims.session_role,
            })
          }
        } catch {
          /* ignore */
        }
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
