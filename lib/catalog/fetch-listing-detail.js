import { queryFetchJson } from '@/lib/api/query-fetch'
import { mapListingDetailFromApi } from '@/lib/catalog/map-listing-detail-api'

/**
 * @param {string} listingId
 * @returns {Promise<object | null>}
 */
export async function fetchListingDetail(listingId) {
  const id = String(listingId || '').trim()
  if (!id) return null
  const raw = await queryFetchJson(`/api/v2/listings/${encodeURIComponent(id)}`)
  return mapListingDetailFromApi(raw)
}
