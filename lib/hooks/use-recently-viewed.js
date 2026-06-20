/**
 * Recently viewed listings — localStorage + server merge after login (Stage 167.1).
 * Stage 167.6 — resolve against ACTIVE catalog (drop deleted/hidden stale local rows).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  mergeRecentListings,
  RECENTLY_VIEWED_MAX,
} from '@/lib/recommendations/recently-viewed-merge'
import { fetchResolvedRecentListings } from '@/lib/recommendations/resolve-recent-listings-client'
import {
  readGuestViewedListingIdsClient,
  recordGuestListingViewClient,
} from '@/lib/guest/guest-signals-client.js'

const STORAGE_KEY = 'gostaylo_recent_viewed'

function readLocalRecent() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalRecent(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* ignore quota */
  }
}

/**
 * @param {{ userId?: string | null }} [options]
 */
export function useRecentlyViewed({ userId = null } = {}) {
  const [recentListings, setRecentListings] = useState([])
  const mergedForUserRef = useRef(null)

  const persistServerView = useCallback((listingId) => {
    const uid = String(userId || '').trim()
    const lid = String(listingId || '').trim()
    if (!uid || !lid) return
    void fetch('/api/v2/listing-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId: lid }),
    }).catch(() => {})
  }, [userId])

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      const local = readLocalRecent()
      const uid = String(userId || '').trim()
      let merged = local

      if (uid) {
        try {
          const res = await fetch('/api/v2/listing-views')
          if (res.ok) {
            const data = await res.json()
            const serverItems = data?.success && Array.isArray(data.items) ? data.items : []
            merged = mergeRecentListings(local, serverItems)
          }
        } catch {
          merged = local
        }
      }

      const validated = await fetchResolvedRecentListings(merged)
      if (cancelled) return

      writeLocalRecent(validated)
      setRecentListings(validated)

      if (uid && mergedForUserRef.current !== uid) {
        mergedForUserRef.current = uid
        const cookieIds = readGuestViewedListingIdsClient()
        for (const lid of cookieIds) {
          persistServerView(lid)
        }
      }
    }

    void hydrate()

    return () => {
      cancelled = true
    }
  }, [userId, persistServerView])

  const addToRecent = useCallback(
    (listing) => {
      if (!listing || !listing.id) return

      setRecentListings((prev) => {
        const filtered = prev.filter((item) => item.id !== listing.id)
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
            bedrooms: listing.bedrooms || listing.metadata?.bedrooms,
            bathrooms: listing.bathrooms || listing.metadata?.bathrooms,
            viewed_at: new Date().toISOString(),
          },
          ...filtered,
        ].slice(0, RECENTLY_VIEWED_MAX)

        writeLocalRecent(updated)
        return updated
      })

      recordGuestListingViewClient(listing.id)
      persistServerView(listing.id)
    },
    [persistServerView],
  )

  const clearRecent = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      setRecentListings([])
    } catch {
      /* ignore */
    }
  }, [])

  return {
    recentListings,
    addToRecent,
    clearRecent,
  }
}
