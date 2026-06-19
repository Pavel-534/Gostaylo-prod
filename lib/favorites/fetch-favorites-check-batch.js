import { FAVORITES_CHECK_BATCH_MAX } from '@/lib/favorites/constants.js'
import { normalizeListingIdList } from '@/lib/favorites/parse-listing-ids.js'

/**
 * @param {string[]} chunk
 * @param {AbortSignal} [signal]
 * @returns {Promise<Record<string, boolean>>}
 */
async function fetchFavoritesCheckChunk(chunk, signal) {
  const params = new URLSearchParams()
  params.set('listingIds', chunk.join(','))
  const res = await fetch(`/api/v2/favorites/check?${params.toString()}`, { signal })
  const data = await res.json()
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Favorites batch check failed')
  }
  return data.favorites && typeof data.favorites === 'object' ? data.favorites : {}
}

/**
 * Client batch favorite check — chunks requests at {@link FAVORITES_CHECK_BATCH_MAX}.
 *
 * @param {Array<string | number | null | undefined>} listingIds
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<Record<string, boolean>>}
 */
export async function fetchFavoritesCheckBatch(listingIds, options = {}) {
  const ids = normalizeListingIdList(listingIds)
  if (ids.length === 0) return {}

  /** @type {Record<string, boolean>} */
  const merged = {}
  for (let i = 0; i < ids.length; i += FAVORITES_CHECK_BATCH_MAX) {
    const chunk = ids.slice(i, i + FAVORITES_CHECK_BATCH_MAX)
    const part = await fetchFavoritesCheckChunk(chunk, options.signal)
    Object.assign(merged, part)
  }
  return merged
}
