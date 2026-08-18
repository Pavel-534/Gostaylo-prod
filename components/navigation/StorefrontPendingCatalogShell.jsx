'use client'

/**
 * Stage 201.104 — paint catalog skeleton as soon as Search is pending on Home.
 * Stage 201.110 — only arm while the live route is Home. PDP Back pending
 * `/listings` (soft-back fallback) used to cover Home forever after history.back().
 */

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ListingsCatalogSkeleton } from '@/components/listings-catalog-skeleton'
import { AIRENTO_NAV_PENDING_EVENT } from '@/lib/navigation/optimistic-nav-href'
import {
  isStorefrontHomePath,
  shouldPaintPendingCatalogSkeleton,
} from '@/lib/navigation/pending-catalog-skeleton'

function livePathname() {
  if (typeof window === 'undefined') return '/'
  return String(window.location.pathname || '').replace(/\/+$/, '') || '/'
}

export function StorefrontPendingCatalogShell({ children }) {
  const pathname = usePathname()
  const [pendingListings, setPendingListings] = useState(false)

  useEffect(() => {
    const onPending = (event) => {
      const href = event?.detail?.href
      setPendingListings(shouldPaintPendingCatalogSkeleton(livePathname(), href))
    }
    window.addEventListener(AIRENTO_NAV_PENDING_EVENT, onPending)
    return () => window.removeEventListener(AIRENTO_NAV_PENDING_EVENT, onPending)
  }, [])

  useEffect(() => {
    if (!isStorefrontHomePath(pathname)) setPendingListings(false)
  }, [pathname])

  if (isStorefrontHomePath(pathname) && pendingListings) {
    return <ListingsCatalogSkeleton />
  }

  return children
}
