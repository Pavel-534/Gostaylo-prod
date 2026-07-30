'use client'

/**
 * Stage 200.13 — SSOT optimistic shell navigation.
 *
 * Problem: App Router RSC/chunk load leaves bottom tabs “dead” for ~1s
 * (active state waits on pathname). Fix: paint pending tab immediately,
 * prefetch destinations, signal ScrollProgressBar via `airento:nav-pending`.
 */

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  AIRENTO_NAV_PENDING_EVENT,
  matchesOptimisticNavHref,
} from '@/lib/navigation/optimistic-nav-href'

export {
  AIRENTO_NAV_PENDING_EVENT,
  STOREFRONT_NAV_PREFETCH_PATHS,
  PARTNER_NAV_PREFETCH_PATHS,
  PUBLIC_HEADER_NAV_PREFETCH_PATHS,
  PARTNER_SIDEBAR_PREFETCH_PATHS,
  PROFILE_HUB_PREFETCH_PATHS,
  USER_MENU_PREFETCH_PATHS,
  dispatchOptimisticNavPending,
  matchesOptimisticNavHref,
} from '@/lib/navigation/optimistic-nav-href'
/**
 * @param {{ prefetchPaths?: readonly string[] }} [opts]
 */
export function useOptimisticNavHref(opts = {}) {
  const pathname = usePathname()
  const router = useRouter()
  const prefetchPaths = opts.prefetchPaths || []
  const [pendingHref, setPendingHref] = useState(null)

  useEffect(() => {
    setPendingHref(null)
  }, [pathname])

  useEffect(() => {
    if (!router?.prefetch || !prefetchPaths.length) return
    for (const path of prefetchPaths) {
      try {
        router.prefetch(path)
      } catch {
        /* ignore */
      }
    }
  }, [router, prefetchPaths])

  const markPending = useCallback((href) => {
    const next = String(href || '').trim()
    if (!next || next === '#') return
    setPendingHref(next)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(AIRENTO_NAV_PENDING_EVENT, { detail: { href: next } }),
      )
    }
  }, [])

  const clearPending = useCallback(() => setPendingHref(null), [])

  return { pendingHref, markPending, clearPending, matchesOptimisticNavHref }
}
