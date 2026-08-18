/**
 * Stage 169.1 — For You / «Популярно рядом» visible list SSOT.
 * Stage 201.108 — exclude featured/top ids; cold guest min is 2 cards.
 */

function listingId(row) {
  return String(row?.id || '').trim()
}

/**
 * @param {object[] | null | undefined} listings
 * @returns {string[]}
 */
export function listingIdsForRailDedupe(listings) {
  const ids = []
  const seen = new Set()
  for (const row of Array.isArray(listings) ? listings : []) {
    const id = listingId(row)
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

/**
 * @param {object[]} listings — full API response
 * @param {object} opts
 * @param {number} opts.minResults — min remaining count to show rail at all
 * @param {boolean} opts.isMobile — viewport ≤ RECOMMENDATION_MOBILE_MAX_WIDTH_PX
 * @param {boolean} opts.isCatalogXsHidden — hide for_you_catalog on very small screens
 * @param {number} opts.mobileMaxCards — max cards when isMobile
 * @param {Iterable<string> | null} [opts.excludeListingIds] — e.g. home featured/top grid
 * @returns {{ visible: object[], shouldRender: boolean }}
 */
export function resolveForYouRailDisplay(
  listings,
  { minResults, isMobile, isCatalogXsHidden, mobileMaxCards, excludeListingIds },
) {
  const exclude = new Set(
    [...(excludeListingIds || [])].map((id) => String(id || '').trim()).filter(Boolean),
  )
  const rows = (Array.isArray(listings) ? listings : []).filter((row) => {
    const id = listingId(row)
    return id && !exclude.has(id)
  })
  const min = Math.max(1, Number(minResults) || 1)

  if (rows.length < min) {
    return { visible: [], shouldRender: false }
  }
  if (isCatalogXsHidden) {
    return { visible: [], shouldRender: false }
  }

  const cap = Math.max(1, Number(mobileMaxCards) || 1)
  const visible = isMobile ? rows.slice(0, cap) : rows

  return {
    visible,
    shouldRender: visible.length > 0,
  }
}
