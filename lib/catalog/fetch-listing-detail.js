import { queryFetchJson, QueryFetchError } from '@/lib/api/query-fetch'
import { mapListingDetailFromApi } from '@/lib/catalog/map-listing-detail-api'

/**
 * @param {string} listingId
 * @returns {Promise<object | null | { moderationPending: true }>}
 */
export async function fetchListingDetail(listingId) {
  const id = String(listingId || '').trim()
  if (!id) return null
  try {
    const raw = await queryFetchJson(`/api/v2/listings/${encodeURIComponent(id)}`)
    return mapListingDetailFromApi(raw)
  } catch (err) {
    if (
      err instanceof QueryFetchError &&
      (err.code === 'LISTING_UNDER_MODERATION' || err.raw?.code === 'LISTING_UNDER_MODERATION')
    ) {
      return { moderationPending: true }
    }
    return null
  }
}
