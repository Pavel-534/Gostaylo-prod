'use client'

/**
 * Stage 201.97 — park catalog React tree across Home ↔ Search.
 * Next App Router unmounts the page slot; this pane lives in the storefront shell.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { ListingsCatalogSkeleton } from '@/components/listings-catalog-skeleton'
import {
  isStorefrontCatalogListPath,
  isStorefrontSearchKeepAlivePath,
  registerStorefrontSearchKeepAliveReveal,
} from '@/lib/navigation/storefront-search-keep-alive'
import { persistLiveRouteScroll } from '@/lib/navigation/route-scroll-memory'

const ListingsCatalogClient = dynamic(
  () => import('@/app/(storefront)/listings/listings-catalog-client'),
  { ssr: true, loading: () => <ListingsCatalogSkeleton /> },
)

export function StorefrontSearchKeepAlivePane({ children }) {
  const pathname = usePathname()
  const isList = isStorefrontCatalogListPath(pathname)
  const keepAlivePath = isStorefrontSearchKeepAlivePath(pathname)
  const isHome = (String(pathname || '').replace(/\/+$/, '') || '/') === '/'

  const [parked, setParked] = useState(false)
  const [revealRequested, setRevealRequested] = useState(false)
  const catalogScrollYRef = useRef(0)
  const prevForegroundRef = useRef(false)
  const parkedRef = useRef(false)

  const foreground = isList || (parked && isHome && revealRequested)
  const hidePageSlot = Boolean(foreground)
  const showCatalog = Boolean(isList || parked)

  parkedRef.current = parked

  useEffect(() => {
    if (isList) {
      setParked(true)
      setRevealRequested(false)
      return
    }
    if (!keepAlivePath) {
      setParked(false)
      setRevealRequested(false)
    }
  }, [isList, keepAlivePath])

  useEffect(() => {
    const wasForeground = prevForegroundRef.current
    if (wasForeground && !foreground && typeof window !== 'undefined') {
      catalogScrollYRef.current = Math.max(0, Math.round(window.scrollY || 0))
      persistLiveRouteScroll()
    }
    if (!wasForeground && foreground && typeof window !== 'undefined') {
      const y = catalogScrollYRef.current
      requestAnimationFrame(() => {
        window.scrollTo(0, y)
      })
    }
    prevForegroundRef.current = foreground
  }, [foreground])

  const reveal = useCallback(() => {
    if (!parkedRef.current) return false
    persistLiveRouteScroll()
    setRevealRequested(true)
    return true
  }, [])

  useEffect(() => registerStorefrontSearchKeepAliveReveal(reveal), [reveal])

  return (
    <>
      <div hidden={hidePageSlot}>{children}</div>
      {showCatalog ? (
        <div
          hidden={!foreground}
          inert={!foreground ? '' : undefined}
          data-testid="storefront-search-keep-alive"
          data-catalog-foreground={foreground ? 'true' : 'false'}
        >
          <ListingsCatalogClient />
        </div>
      ) : null}
    </>
  )
}
