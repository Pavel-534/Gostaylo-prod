'use client'

/**
 * Stage 189.3 — client SSOT for GET/DELETE /api/v2/auth/connections.
 */
import { useCallback, useEffect, useState } from 'react'

/**
 * @returns {{
 *   connections: Array<{ provider: string, connected: boolean, available: boolean, canUnlink: boolean }>,
 *   loading: boolean,
 *   errorCode: string | null,
 *   refresh: () => Promise<void>,
 *   unlink: (provider: string) => Promise<{ ok: boolean, error_code?: string }>,
 * }}
 */
export function useAccountConnections({ enabled = true } = {}) {
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(Boolean(enabled))
  const [errorCode, setErrorCode] = useState(null)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setConnections([])
      setLoading(false)
      return
    }
    setLoading(true)
    setErrorCode(null)
    try {
      const res = await fetch('/api/v2/auth/connections', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) {
        setErrorCode(json?.error_code || 'AUTH_INTERNAL')
        setConnections([])
        return
      }
      setConnections(Array.isArray(json.connections) ? json.connections : [])
    } catch {
      setErrorCode('AUTH_INTERNAL')
      setConnections([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const unlink = useCallback(async (provider) => {
    try {
      const res = await fetch('/api/v2/auth/connections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) {
        return { ok: false, error_code: json?.error_code || 'AUTH_INTERNAL' }
      }
      await refresh()
      return { ok: true }
    } catch {
      return { ok: false, error_code: 'AUTH_INTERNAL' }
    }
  }, [refresh])

  return { connections, loading, errorCode, refresh, unlink }
}
