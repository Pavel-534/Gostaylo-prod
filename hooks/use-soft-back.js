'use client'

/**
 * Stage 200.17 / 201.74 / 201.89 — soft back: progress signal + history / catalog restore.
 * Stage 201.89 — re-apply `#map` after replace (App Router often drops hash → world map).
 */

import { useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { dispatchOptimisticNavPending } from '@/lib/navigation/optimistic-nav-href'
import { markPendingRouteScrollRestore } from '@/lib/navigation/route-scroll-memory'
import {
  isCatalogListingsHref,
  peekCatalogReturnHref,
} from '@/lib/navigation/catalog-return-href'
import { peekCatalogMapViewport } from '@/lib/navigation/catalog-map-viewport-memory'
import { writeCatalogMobileMapHash } from '@/lib/navigation/catalog-mobile-map-hash'

/**
 * @param {string | null | undefined} pathname
 * @returns {boolean}
 */
function isListingPdpPath(pathname) {
  const path = String(pathname || '').replace(/\/+$/, '') || '/'
  return /^\/listings\/[^/]+/.test(path)
}

/**
 * Next App Router `router.replace('/listings#map')` often lands without hash.
 * Re-write `#map` so the catalog mobile sheet + camera restore can open.
 */
function ensureCatalogMapHashAfterSoftBack(catalogReturn) {
  if (typeof window === 'undefined') return
  const wantMap =
    /#map\b/i.test(String(catalogReturn || '')) || Boolean(peekCatalogMapViewport())
  if (!wantMap) return
  const rehash = () => writeCatalogMobileMapHash(true)
  rehash()
  queueMicrotask(rehash)
  window.setTimeout(rehash, 0)
  window.setTimeout(rehash, 50)
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
    const canPop = typeof window !== 'undefined' && window.history.length > 1

    markPendingRouteScrollRestore()

    // Catalog → PDP: pending the remembered list URL. Home → PDP must not
    // pending `/listings` or Home stays on the catalog skeleton after back.
    if (catalogReturn && isCatalogListingsHref(catalogReturn)) {
      dispatchOptimisticNavPending(catalogReturn)
      if (canPop) {
        router.back()
        ensureCatalogMapHashAfterSoftBack(catalogReturn)
        return
      }
      const pathAndSearch = String(catalogReturn).replace(/#.*$/, '')
      const wantMap =
        /#map\b/i.test(catalogReturn) || Boolean(peekCatalogMapViewport())
      router.replace(wantMap ? `${pathAndSearch}#map` : pathAndSearch)
      ensureCatalogMapHashAfterSoftBack(catalogReturn)
      return
    }

    if (canPop) {
      dispatchOptimisticNavPending(isListingPdpPath(pathname) ? '/' : fallback)
      router.back()
      return
    }

    const target = catalogReturn || fallback
    dispatchOptimisticNavPending(target)
    router.push(target)
  }, [fallback, pathname, router])
}
