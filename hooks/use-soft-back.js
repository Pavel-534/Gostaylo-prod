'use client'

/**
 * Stage 200.17 / 201.74 — soft back: progress signal + history / catalog restore.
 */

import { useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { dispatchOptimisticNavPending } from '@/lib/navigation/optimistic-nav-href'
import { markPendingRouteScrollRestore } from '@/lib/navigation/route-scroll-memory'
import {
  isCatalogListingsHref,
  peekCatalogReturnHref,
} from '@/lib/navigation/catalog-return-href'

/**
 * @param {string | null | undefined} pathname
 * @returns {boolean}
 */
function isListingPdpPath(pathname) {
  const path = String(pathname || '').replace(/\/+$/, '') || '/'
  return /^\/listings\/[^/]+/.test(path)
}

/**
 * @param {string} [fallbackHref='/']
 */
export function useSoftBack(fallbackHref = '/') {
  const router = useRouter()
  const pathname = usePathname()
  const fallback = String(fallbackHref || '/').trim() || '/'

  return useCallback(() => {
    const catalogReturn = isListingPdpPath(pathname) ? peekCatalogReturnHref() : null
    const target = catalogReturn || fallback

    dispatchOptimisticNavPending(target)
    markPendingRouteScrollRestore()

    // PDP opened from catalog → restore exact `/listings?…` (map/filters), replace PDP entry.
    if (catalogReturn && isCatalogListingsHref(catalogReturn)) {
      router.replace(catalogReturn)
      return
    }

    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push(target)
  }, [fallback, pathname, router])
}
