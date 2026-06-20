/**
 * Client helper — resolve local recent ids against ACTIVE public listings.
 */

import { RECENTLY_VIEWED_MAX } from '@/lib/recommendations/recently-viewed-merge'

/**
 * @param {object[]} items — merged local recent rows (need id + viewed_at)
 * @returns {Promise<object[]>}
 */
export async function fetchResolvedRecentListings(items) {
  const ordered = Array.isArray(items) ? items : []
  const ids = ordered
    .map((item) => String(item?.id ?? item?.listing_id ?? '').trim())
    .filter(Boolean)
    .slice(0, RECENTLY_VIEWED_MAX)

  if (!ids.length) return []

  const viewedAtById = Object.fromEntries(
    ordered.map((item) => {
      const id = String(item?.id ?? item?.listing_id ?? '').trim()
      return [id, item?.viewed_at ?? item?.viewedAt ?? null]
    }),
  )

  const params = new URLSearchParams({ ids: ids.join(',') })
  const res = await fetch(`/api/v2/listing-views/resolve?${params.toString()}`)
  if (!res.ok) return []

  const data = await res.json()
  if (!data?.success || !Array.isArray(data.items)) return []

  return data.items
    .map((item) => {
      const id = String(item?.id ?? '').trim()
      if (!id) return null
      const viewedAt = viewedAtById[id]
      return viewedAt ? { ...item, viewed_at: viewedAt } : item
    })
    .filter(Boolean)
    .sort((a, b) => (Date.parse(b.viewed_at) || 0) - (Date.parse(a.viewed_at) || 0))
}
