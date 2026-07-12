/**
 * Stage 178.9 — dynamic popular destinations for mobile search sheet.
 * SSOT fetch: inventory-ranked suggest API (empty q); static fallback offline.
 */

import { dedupeClientRequest } from '@/lib/api/client-request-dedup'
import { CACHE_KEY, TTL_LOCATION_SUGGEST_POPULAR_MS } from '@/lib/api/client-fetch-policy'
import { fetchLocationSuggest } from '@/lib/api/catalog-public-client'
import { POPULAR_DESTINATIONS_FLAT } from '@/lib/locations/popular-destinations'

const FALLBACK_SLUGS = ['phuket', 'moscow', 'bangkok', 'bali', 'dubai', 'spb']

/**
 * @typedef {{ value: string, label: string, listing_count?: number, subtitle?: string }} PopularDestinationChip
 */

/**
 * @param {string} language
 * @returns {PopularDestinationChip[]}
 */
export function getPopularDestinationsFallback(language = 'ru') {
  const lang = language || 'ru'
  const bySlug = new Map(POPULAR_DESTINATIONS_FLAT.map((item) => [item.value, item]))
  return FALLBACK_SLUGS.map((slug) => {
    const item = bySlug.get(slug)
    return {
      value: slug,
      label: item?.labels?.[lang] || item?.labels?.en || slug,
      listing_count: 0,
    }
  })
}

/**
 * Top destinations ranked by active listing inventory.
 * @param {{ lang?: string, limit?: number }} [opts]
 * @returns {Promise<{ ok: boolean, items: PopularDestinationChip[], fromFallback: boolean }>}
 */
export async function fetchPopularDestinations(opts = {}) {
  const lang = opts.lang || 'ru'
  const limit = Math.min(12, Math.max(4, opts.limit ?? 8))
  const cacheKey = `${CACHE_KEY.locationSuggest}:popular:${lang}:${limit}`

  return dedupeClientRequest(
    cacheKey,
    async () => {
      try {
        const res = await fetchLocationSuggest({ q: '', lang, limit })
        const items = (res.items || [])
          .filter((item) => item?.value && item.value !== 'all')
          .map((item) => ({
            value: item.value,
            label: item.label || item.value,
            listing_count: item.listing_count ?? 0,
            subtitle: item.subtitle,
          }))

        if (res.ok && items.length > 0) {
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
