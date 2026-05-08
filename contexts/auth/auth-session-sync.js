'use client'

import { useEffect, useCallback } from 'react'

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

      const serverUser = await getCurrentUser()
      if (serverUser) {
        const normalized = normalizeAuthUser(serverUser)
        setUser(normalized)
        localStorage.setItem('gostaylo_user', JSON.stringify(normalized))
      } else if (stored) {
        localStorage.removeItem('gostaylo_user')
        setUser(null)
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
    } catch {
      return null
    }
  }, [setUser, normalizeAuthUser, getCurrentUser])

  useEffect(() => {
    const onSessionRefresh = () => {
      refreshUserFromServer()
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
