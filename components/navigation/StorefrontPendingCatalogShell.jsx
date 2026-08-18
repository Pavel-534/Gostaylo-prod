'use client'

/**
 * Stage 201.104 — paint catalog skeleton as soon as Search is pending on Home.
 * App Router still sits on `/` until listings RSC finishes; without this the
 * dock turns teal while the hero stays on screen for several seconds.
 */

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ListingsCatalogSkeleton } from '@/components/listings-catalog-skeleton'
import { AIRENTO_NAV_PENDING_EVENT } from '@/lib/navigation/optimistic-nav-href'

function isListingsHref(href) {
  const path = String(href || '').split('?')[0].replace(/\/+$/, '') || '/'
  return path === '/listings'
}

function isHomePath(pathname) {
  return (String(pathname || '').replace(/\/+$/, '') || '/') === '/'
}

export function StorefrontPendingCatalogShell({ children }) {
  const pathname = usePathname()
  const [pendingListings, setPendingListings] = useState(false)

  useEffect(() => {
    const onPending = (event) => {
      if (isListingsHref(event?.detail?.href)) setPendingListings(true)
    }
    window.addEventListener(AIRENTO_NAV_PENDING_EVENT, onPending)
    return () => window.removeEventListener(AIRENTO_NAV_PENDING_EVENT, onPending)
  }, [])

  useEffect(() => {
    if (!isHomePath(pathname)) setPendingListings(false)
  }, [pathname])

  if (isHomePath(pathname) && pendingListings) {
    return <ListingsCatalogSkeleton />
  }

  return children
}
