/**
 * Stage 169.1 — For You rail visible list SSOT (threshold + mobile cap + catalog xs hide).
 */

/**
 * @param {object[]} listings — full API response
 * @param {object} opts
 * @param {number} opts.minResults — min API count to show rail at all
 * @param {boolean} opts.isMobile — viewport ≤ RECOMMENDATION_MOBILE_MAX_WIDTH_PX
 * @param {boolean} opts.isCatalogXsHidden — hide for_you_catalog on very small screens
 * @param {number} opts.mobileMaxCards — max cards when isMobile
 * @returns {{ visible: object[], shouldRender: boolean }}
 */
export function resolveForYouRailDisplay(
  listings,
  { minResults, isMobile, isCatalogXsHidden, mobileMaxCards },
) {
  const rows = Array.isArray(listings) ? listings : []
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
