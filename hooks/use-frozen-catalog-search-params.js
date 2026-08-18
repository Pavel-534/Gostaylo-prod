'use client'

/**
 * While the catalog tree is parked on Home or PDP, Next `useSearchParams()` is not the list URL.
 * Freeze the last `/listings` query so filters/list do not reset.
 */

import { useMemo, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { isStorefrontCatalogListPath } from '@/lib/navigation/storefront-search-keep-alive'

export function useFrozenCatalogSearchParams() {
  const live = useSearchParams()
  const pathname = usePathname()
  const isList = isStorefrontCatalogListPath(pathname)
  const frozenKeyRef = useRef(isList ? live.toString() : '')
  if (isList) frozenKeyRef.current = live.toString()
  const key = isList ? live.toString() : frozenKeyRef.current

  return useMemo(() => {
    if (isList) return live
    return new URLSearchParams(key)
  }, [isList, live, key])
}

export function useIsStorefrontCatalogListRoute() {
  return isStorefrontCatalogListPath(usePathname())
}
