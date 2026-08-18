/**
 * Recently viewed listings — localStorage + server merge after login (Stage 167.1).
 * Stage 167.6 — resolve against ACTIVE catalog (drop deleted/hidden stale local rows).
 * Stage 201.99 — TanStack Query: remount paints cache/local instantly, no focus refetch.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RECENTLY_VIEWED_MAX } from '@/lib/recommendations/recently-viewed-merge'
import {
  RECENTLY_VIEWED_STORAGE_KEY,
  hydrateRecentlyViewedListings,
  readLocalRecentListings,
  writeLocalRecentListings,
} from '@/lib/recommendations/hydrate-recently-viewed'
import {
  readGuestViewedListingIdsClient,
  recordGuestListingViewClient,
} from '@/lib/guest/guest-signals-client.js'
import { queryKeys } from '@/lib/query-keys'
import { HOME_WIDGET_QUERY_OPTIONS } from '@/lib/query-prefetch/home-query-constants'

/**
 * @param {{ userId?: string | null }} [options]
 */
export function useRecentlyViewed({ userId = null } = {}) {
  const uid = String(userId || '').trim()
  const queryClient = useQueryClient()
  const queryKey = queryKeys.recommendations.recentlyViewed(uid || null)
  const mergedForUserRef = useRef(null)

  const persistServerView = useCallback((listingId) => {
    const lid = String(listingId || '').trim()
    if (!uid || !lid) return
    void fetch('/api/v2/listing-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId: lid }),
    }).catch(() => {})
  }, [uid])

  const { data: recentListings = [] } = useQuery({
    queryKey,
    queryFn: () => hydrateRecentlyViewedListings(uid),
    ...HOME_WIDGET_QUERY_OPTIONS,
    placeholderData: () => readLocalRecentListings(),
  })

  useEffect(() => {
    if (!uid || mergedForUserRef.current === uid) return
    mergedForUserRef.current = uid
    const cookieIds = readGuestViewedListingIdsClient()
    for (const lid of cookieIds) {
      persistServerView(lid)
    }
  }, [uid, persistServerView])

  const addToRecent = useCallback(
    (listing) => {
      if (!listing || !listing.id) return

      queryClient.setQueryData(queryKey, (prev) => {
        const current = Array.isArray(prev) && prev.length ? prev : readLocalRecentListings()
        const filtered = current.filter((item) => item.id !== listing.id)
        const updated = [
          {
            id: listing.id,
            title: listing.title,
            district: listing.district,
            base_price_thb: listing.base_price_thb || listing.basePriceThb,
            guest_display_price_thb:
              listing.guest_display_price_thb ||
              listing.guestDisplayPriceThb ||
              listing.base_price_thb ||
              listing.basePriceThb,
            images: listing.images,
            cover_image: listing.cover_image || listing.coverImage,
            property_type: listing.property_type || listing.metadata?.property_type,
            categorySlug:
              listing.categorySlug ||
              listing.category?.slug ||
              listing.categories?.slug ||
              null,
            category: listing.category || listing.categories || null,
            bedrooms: listing.bedrooms || listing.metadata?.bedrooms,
            bathrooms: listing.bathrooms || listing.metadata?.bathrooms,
            viewed_at: new Date().toISOString(),
          },
          ...filtered,
        ].slice(0, RECENTLY_VIEWED_MAX)

        writeLocalRecentListings(updated)
        return updated
      })

      recordGuestListingViewClient(listing.id)
      persistServerView(listing.id)
    },
    [persistServerView, queryClient, queryKey],
  )

  const clearRecent = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(RECENTLY_VIEWED_STORAGE_KEY)
      }
      queryClient.setQueryData(queryKey, [])
    } catch {
      /* ignore */
    }
  }, [queryClient, queryKey])

  return {
    recentListings,
    addToRecent,
    clearRecent,
  }
}
