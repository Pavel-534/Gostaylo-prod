/**
 * Recently viewed hydrate — localStorage + optional server merge + ACTIVE resolve.
 * Used by TanStack Query so Home/PDP remounts paint from cache (Stage 201.99).
 */

import {
  mergeRecentListings,
} from '@/lib/recommendations/recently-viewed-merge'
import { fetchResolvedRecentListings } from '@/lib/recommendations/resolve-recent-listings-client'

export const RECENTLY_VIEWED_STORAGE_KEY = 'gostaylo_recent_viewed'

export function readLocalRecentListings() {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeLocalRecentListings(items) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* ignore quota */
  }
}

/**
 * @param {string} [userId]
 * @returns {Promise<object[]>}
 */
export async function hydrateRecentlyViewedListings(userId = '') {
  const local = readLocalRecentListings()
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
  writeLocalRecentListings(validated)
  return validated
}
