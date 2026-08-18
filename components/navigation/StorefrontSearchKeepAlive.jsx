'use client'

/**
 * Stage 201.97 / 201.98 — park Home + catalog across bottom-tab Search.
 * Next App Router unmounts the page slot; these panes live in the storefront shell.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { ListingsCatalogSkeleton } from '@/components/listings-catalog-skeleton'
import { HomePageSkeleton } from '@/components/home-page-skeleton'
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
const PlatformHomeContent = dynamic(
  () => import('@/components/PlatformHomeContent').then((m) => m.PlatformHomeContent),
  { ssr: true, loading: () => <HomePageSkeleton /> },
)

export function StorefrontSearchKeepAlivePane({ children }) {
  const pathname = usePathname()
  const isList = isStorefrontCatalogListPath(pathname)
  const keepAlivePath = isStorefrontSearchKeepAlivePath(pathname)
  const isHome = (String(pathname || '').replace(/\/+$/, '') || '/') === '/'

  const [catalogParked, setCatalogParked] = useState(false)
  const [homeParked, setHomeParked] = useState(false)
  const [revealRequested, setRevealRequested] = useState(false)
  const catalogScrollYRef = useRef(0)
  const homeScrollYRef = useRef(0)
  const prevCatalogFgRef = useRef(false)
  const catalogParkedRef = useRef(false)

  const catalogForeground = isList || (catalogParked && isHome && revealRequested)
  const homeForeground = isHome && !catalogForeground
  const hidePageSlot = Boolean(homeForeground || catalogForeground)
  const showCatalog = Boolean(isList || catalogParked)
  const showHome = Boolean(isHome || homeParked)

  catalogParkedRef.current = catalogParked

  useEffect(() => {
    if (isHome) setHomeParked(true)
    if (isList) {
      setCatalogParked(true)
      setRevealRequested(false)
    }
    if (!keepAlivePath) {
      setHomeParked(false)
      setCatalogParked(false)
      setRevealRequested(false)
    }
  }, [isHome, isList, keepAlivePath])

  useEffect(() => {
    const wasCatalog = prevCatalogFgRef.current
    if (typeof window === 'undefined') {
      prevCatalogFgRef.current = catalogForeground
      return undefined
    }
    if (!wasCatalog && catalogForeground) {
      homeScrollYRef.current = Math.max(0, Math.round(window.scrollY || 0))
      persistLiveRouteScroll()
      const y = catalogScrollYRef.current
      requestAnimationFrame(() => window.scrollTo(0, y))
    }
    if (wasCatalog && !catalogForeground) {
      catalogScrollYRef.current = Math.max(0, Math.round(window.scrollY || 0))
      persistLiveRouteScroll()
      const y = homeScrollYRef.current
      requestAnimationFrame(() => window.scrollTo(0, y))
    }
    prevCatalogFgRef.current = catalogForeground
    return undefined
  }, [catalogForeground])

  const reveal = useCallback(() => {
    if (!catalogParkedRef.current) return false
    persistLiveRouteScroll()
    setRevealRequested(true)
    return true
  }, [])

  useEffect(() => registerStorefrontSearchKeepAliveReveal(reveal), [reveal])

  return (
    <>
      <div hidden={hidePageSlot}>{children}</div>
      {showHome ? (
        <div
          hidden={!homeForeground}
          inert={!homeForeground ? '' : undefined}
          data-testid="storefront-home-keep-alive"
          data-home-foreground={homeForeground ? 'true' : 'false'}
        >
          <PlatformHomeContent />
        </div>
      ) : null}
      {showCatalog ? (
        <div
          hidden={!catalogForeground}
          inert={!catalogForeground ? '' : undefined}
          data-testid="storefront-search-keep-alive"
          data-catalog-foreground={catalogForeground ? 'true' : 'false'}
        >
          <ListingsCatalogClient />
        </div>
      ) : null}
    </>
  )
}
