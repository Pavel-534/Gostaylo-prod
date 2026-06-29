'use client'

import { useEffect } from 'react'

const RELOAD_GUARD_KEY = 'airento_chunk_reload_ts'
const RELOAD_COOLDOWN_MS = 15_000

function isChunkLoadFailureMessage(message) {
  const m = String(message || '')
  return m.includes('Loading chunk') || m.includes('CSS chunk') || m.includes('ChunkLoadError')
}

function shouldGracefulReload() {
  try {
    const last = parseInt(sessionStorage.getItem(RELOAD_GUARD_KEY) || '0', 10)
    if (Number.isFinite(last) && Date.now() - last < RELOAD_COOLDOWN_MS) return false
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
    return true
  } catch {
    return true
  }
}

/**
 * Graceful reload when Next.js hashed chunks 404 mid-session (deploy during active tab).
 */
export function ChunkLoadResilience() {
  useEffect(() => {
    const onError = (event) => {
      const message = event?.message || event?.error?.message || ''
      if (!isChunkLoadFailureMessage(message)) return
      if (!shouldGracefulReload()) return
      console.warn('[ChunkLoadResilience] chunk failure — graceful reload')
      window.location.reload()
    }

    const onRejection = (event) => {
      const reason = event?.reason
      const message =
        typeof reason === 'string'
          ? reason
          : reason?.message || reason?.name || ''
      if (!isChunkLoadFailureMessage(message)) return
      if (!shouldGracefulReload()) return
      console.warn('[ChunkLoadResilience] chunk promise rejection — graceful reload')
      window.location.reload()
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
