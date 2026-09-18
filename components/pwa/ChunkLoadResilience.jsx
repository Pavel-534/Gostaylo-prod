'use client'

import { useEffect } from 'react'
import {
  claimChunkGracefulReload,
  hardReloadForChunkFailure,
} from '@/lib/navigation/chunk-load-reload.js'
import { isClientNavFailure } from '@/lib/navigation/is-client-nav-failure.js'

/**
 * Graceful reload when Next.js hashed chunks 404 / timeout mid-session
 * (deploy during active tab, or airento.ru VPS proxy blip on `/_next/static`).
 * Stage 202.43 — shared guard + timeout / dynamic-import messages.
 */
export function ChunkLoadResilience() {
  useEffect(() => {
    const maybeReload = (errorLike) => {
      if (!isClientNavFailure(errorLike)) return
      if (!claimChunkGracefulReload()) return
      console.warn('[ChunkLoadResilience] chunk failure — graceful reload')
      window.location.reload()
    }

    const onError = (event) => {
      const message = event?.message || event?.error?.message || ''
      const name = event?.error?.name || ''
      maybeReload({ name, message })
    }

    const onRejection = (event) => {
      const reason = event?.reason
      maybeReload(
        typeof reason === 'string'
          ? { message: reason }
          : reason || { message: String(reason || '') },
      )
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

export { hardReloadForChunkFailure }
