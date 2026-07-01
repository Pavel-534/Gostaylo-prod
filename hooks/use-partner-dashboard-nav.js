'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const PARTNER_PREFETCH_PATHS = [
  '/partner/dashboard',
  '/partner/listings',
  '/partner/bookings',
]

/**
 * Prefetch partner workspace routes + navigate with visible pending state (PWA UX).
 */
export function usePartnerDashboardNav() {
  const router = useRouter()
  const pathname = usePathname()
  const [navigating, setNavigating] = useState(false)

  useEffect(() => {
    if (pathname?.startsWith('/partner')) {
      setNavigating(false)
    }
  }, [pathname])

  useEffect(() => {
    for (const path of PARTNER_PREFETCH_PATHS) {
      try {
        router.prefetch(path)
      } catch {
        /* ignore */
      }
    }
  }, [router])

  const goToPartnerDashboard = useCallback(() => {
    if (navigating) return
    setNavigating(true)
    router.push('/partner/dashboard')
  }, [navigating, router])

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
