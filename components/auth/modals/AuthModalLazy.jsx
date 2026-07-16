'use client'

/**
 * Lazy Auth modal — Radix Dialog/Drawer graph loads only when modal opens (Stage 171.34).
 */
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { preloadAuthModalShell } from '@/lib/auth/preload-auth-modal'

const AuthModalShell = dynamic(
  () => import('@/components/auth/modals/AuthModalShell').then((mod) => ({ default: mod.AuthModalShell })),
  { ssr: false, loading: () => null },
)

function AuthModalLoadingOverlay() {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/20 p-4 sm:items-center"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-12 w-12 animate-pulse rounded-2xl bg-white shadow-lg sm:h-14 sm:w-14" />
    </div>
  )
}

export function AuthModalLazy({ loginModalOpen, ...shellProps }) {
  const [chunkReady, setChunkReady] = useState(false)

  useEffect(() => {
    if (!loginModalOpen) {
      setChunkReady(false)
      return undefined
    }

    let cancelled = false
    preloadAuthModalShell().then(() => {
      if (!cancelled) setChunkReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [loginModalOpen])

  if (!loginModalOpen) return null
  if (!chunkReady) return <AuthModalLoadingOverlay />

  return <AuthModalShell loginModalOpen={loginModalOpen} {...shellProps} />
}
