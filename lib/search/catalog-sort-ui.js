/**
 * Catalog sort UI SSOT — labels + option list for select and mobile sheet.
 */

import { CATALOG_SORT_VALUES } from '@/lib/recommendations/constants'

export const CATALOG_SORT_LABEL_KEYS = {
  recommended: 'catalogSortRecommended',
  price_asc: 'catalogSortPriceAsc',
  price_desc: 'catalogSortPriceDesc',
  distance: 'catalogSortDistance',
}

/**
 * @param {{ distanceDisabled?: boolean }} [opts]
 * @returns {typeof CATALOG_SORT_VALUES[number][]}
 */
export function listCatalogSortValues({ distanceDisabled = false } = {}) {
  return CATALOG_SORT_VALUES.filter((key) => !(key === 'distance' && distanceDisabled))
}
