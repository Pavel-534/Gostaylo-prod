/**
 * Stage 169.1 — For You / «Популярно рядом» visible list SSOT.
 * Stage 201.108 — exclude featured/top ids; cold guest min is 2 cards.
 * Stage 201.111 — never hide the rail when the API already returned ≥ min;
 * prefer unique, then unique vs first N featured, then allow overlap.
 */

import { FOR_YOU_EXCLUDE_FEATURED_HEAD } from './constants.js'

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
  const excludeAll = [
    ...(excludeListingIds || []),
  ].map((id) => String(id || '').trim()).filter(Boolean)
  const exclude = new Set(excludeAll)
  const source = (Array.isArray(listings) ? listings : []).filter((row) => listingId(row))
  const unique = source.filter((row) => !exclude.has(listingId(row)))
  const head = new Set(excludeAll.slice(0, FOR_YOU_EXCLUDE_FEATURED_HEAD))
  const uniqueVsHead = source.filter((row) => !head.has(listingId(row)))
  const min = Math.max(1, Number(minResults) || 1)

  let rows = unique
  if (rows.length < min && uniqueVsHead.length >= min) rows = uniqueVsHead
  if (rows.length < min) rows = source

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
