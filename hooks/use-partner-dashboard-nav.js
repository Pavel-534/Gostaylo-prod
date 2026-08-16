'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'

const PARTNER_PREFETCH_PATHS = [
  '/partner/dashboard',
  '/partner/listings',
  '/partner/bookings',
]

/**
 * Prefetch partner workspace routes + navigate with visible pending state (PWA UX).
 * Stage 201.56 — refresh session then hard-nav into /partner (middleware + stale JWT race).
 */
export function usePartnerDashboardNav() {
  const router = useRouter()
  const pathname = usePathname()
  const { refreshUserFromServer, openLoginModal } = useAuth()
  const [navigating, setNavigating] = useState(false)

  useEffect(() => {
    if (pathname?.startsWith('/partner')) {
      setNavigating(false)
    }
  }, [pathname])

  useEffect(() => {
    // Only prefetch when already inside partner shell (cookie already role-ok).
    if (!pathname?.startsWith('/partner')) return
    for (const path of PARTNER_PREFETCH_PATHS) {
      try {
        router.prefetch(path)
      } catch {
        /* ignore */
      }
    }
  }, [router, pathname])

  const goToPartnerDashboard = useCallback(() => {
    if (navigating) return
    setNavigating(true)
    void (async () => {
      try {
        const refreshed = await refreshUserFromServer?.()
        if (refreshed === null) {
          setNavigating(false)
          openLoginModal?.({ redirect: '/partner/dashboard' })
          return
        }
      } catch {
        /* transient */
      }
      if (typeof window !== 'undefined') {
        window.location.assign('/partner/dashboard')
        return
      }
      router.push('/partner/dashboard')
    })()
  }, [navigating, router, refreshUserFromServer, openLoginModal])

  return { goToPartnerDashboard, navigating }
}

export function prefetchPartnerWorkspace(router) {
  if (!router?.prefetch) return
  for (const path of PARTNER_PREFETCH_PATHS) {
    try {
      router.prefetch(path)
    } catch {
      /* ignore */
    }
  }
}
