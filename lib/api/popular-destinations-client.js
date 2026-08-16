/**
 * Stage 178.9 — dynamic popular destinations for mobile search sheet.
 * Stage 201.82 — supply-first: hide zero-inventory destinations (no Bali/Dubai ghosts).
 */

import { dedupeClientRequest } from '@/lib/api/client-request-dedup'
import { CACHE_KEY, TTL_LOCATION_SUGGEST_POPULAR_MS } from '@/lib/api/client-fetch-policy'
import { fetchLocationSuggest } from '@/lib/api/catalog-public-client'

/**
 * @typedef {{ value: string, label: string, listing_count?: number, subtitle?: string }} PopularDestinationChip
 */

/**
 * Offline / API-down: empty popular row — guest still has «Везде» + typed suggest.
 * @param {string} [_language]
 * @returns {PopularDestinationChip[]}
 */
export function getPopularDestinationsFallback(_language = 'ru') {
  return []
}

/**
 * Top destinations ranked by active listing inventory (listing_count > 0 only).
 * @param {{ lang?: string, limit?: number }} [opts]
 * @returns {Promise<{ ok: boolean, items: PopularDestinationChip[], fromFallback: boolean }>}
 */
export async function fetchPopularDestinations(opts = {}) {
  const lang = opts.lang || 'ru'
  const limit = Math.min(12, Math.max(4, opts.limit ?? 8))
  const cacheKey = `${CACHE_KEY.locationSuggest}:popular:supply:${lang}:${limit}`

  return dedupeClientRequest(
    cacheKey,
    async () => {
      try {
        const res = await fetchLocationSuggest({ q: '', lang, limit: Math.max(limit, 12) })
        const items = (res.items || [])
          .filter((item) => item?.value && item.value !== 'all')
          .filter((item) => Number(item.listing_count) > 0)
          .map((item) => ({
            value: item.value,
            label: item.label || item.value,
            listing_count: item.listing_count ?? 0,
            subtitle: item.subtitle,
          }))
          .slice(0, limit)

        if (res.ok) {
          return { ok: true, items, fromFallback: false }
        }
      } catch {
        /* network */
      }

      return {
        ok: false,
        items: getPopularDestinationsFallback(lang),
        fromFallback: true,
      }
    },
    { ttlMs: TTL_LOCATION_SUGGEST_POPULAR_MS },
  )
}
