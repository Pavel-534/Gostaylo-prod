'use client'

import { useEffect, useCallback } from 'react'

/**
 * Session hydrate + refresh (Stage 200.132: transient /me failures must not wipe session).
 * `auth-change` is emitted after refresh — listeners must apply `event.detail`, not re-call refresh
 * (avoids infinite refresh loops, e.g. former renter profile bug).
 */
export function useAuthSessionSync({ setUser, setLoading, normalizeAuthUser, getCurrentUser }) {
  // Load user on mount (from cookie session)
  useEffect(() => {
    const loadUser = async () => {
      const stored = localStorage.getItem('gostaylo_user')
      if (stored) {
        try {
          setUser(normalizeAuthUser(JSON.parse(stored)))
        } catch {
          // ignore
        }
      }

      try {
        const serverUser = await getCurrentUser()
        if (serverUser) {
          const normalized = normalizeAuthUser(serverUser)
          setUser(normalized)
          localStorage.setItem('gostaylo_user', JSON.stringify(normalized))
        } else if (stored) {
          // Explicit unauthenticated from server — drop stale client cache
          localStorage.removeItem('gostaylo_user')
          setUser(null)
        }
      } catch (e) {
        // Network / 5xx — keep optimistic stored user
        console.warn('[AUTH] session hydrate failed; keeping cached user', e)
      }

      setLoading(false)
    }

    loadUser()

    const handleStorage = (e) => {
      if (e.key === 'gostaylo_user') {
        setUser(e.newValue ? JSON.parse(e.newValue) : null)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [setLoading, setUser, normalizeAuthUser, getCurrentUser])

  const refreshUserFromServer = useCallback(async () => {
    try {
      const serverUser = await getCurrentUser()
      if (serverUser) {
        const normalized = normalizeAuthUser(serverUser)
        setUser(normalized)
        localStorage.setItem('gostaylo_user', JSON.stringify(normalized))
        window.dispatchEvent(new CustomEvent('auth-change', { detail: normalized }))
        return normalized
      }
      localStorage.removeItem('gostaylo_user')
      setUser(null)
      window.dispatchEvent(new CustomEvent('auth-change', { detail: null }))
      return null
    } catch (e) {
      console.warn('[AUTH] refreshUserFromServer transient failure; session kept', e)
      return undefined
    }
  }, [setUser, normalizeAuthUser, getCurrentUser])

  useEffect(() => {
    const onSessionRefresh = () => {
      void refreshUserFromServer()
    }
    window.addEventListener('gostaylo-refresh-session', onSessionRefresh)
    window.addEventListener('gostaylo-switch-role', onSessionRefresh)
    return () => {
      window.removeEventListener('gostaylo-refresh-session', onSessionRefresh)
      window.removeEventListener('gostaylo-switch-role', onSessionRefresh)
    }
  }, [refreshUserFromServer])

  return { refreshUserFromServer }
}
