/**
 * Build catalog TanStack search key params from URL (server + client SSOT).
 * Mirrors first client `useListingsFetch` fetch (no debounce lag on cold load).
 */

import { effectiveCategoryWizardProfileRaw } from '@/lib/config/category-hierarchy'
import { buildCatalogSearchKeyParams } from '@/lib/catalog/build-catalog-search-params'
import {
  nextSearchParamsRecordToURLSearchParams,
  parsePublicSearchFiltersFromParams,
  parseExtraFiltersFromParams,
  parseBBoxFromParams,
  parseCatalogSortFromParams,
} from '@/lib/search/listings-page-url'

/**
 * Stable cache key for `React.cache` (sorted query string).
 * @param {import('next').SearchParams | Record<string, string | string[] | undefined> | null | undefined} searchParamsRecord
 */
export function serializeCatalogSearchParamsKey(searchParamsRecord) {
  const sp = nextSearchParamsRecordToURLSearchParams(searchParamsRecord)
  const sorted = new URLSearchParams([...sp.entries()].sort((a, b) => a[0].localeCompare(b[0])))
  return sorted.toString()
}

/**
 * @param {URLSearchParams | import('next').SearchParams | Record<string, string | string[] | undefined>} input
 * @param {Array<Record<string, unknown>>} categories — mapped client categories
 */
export function buildCatalogSearchKeyParamsFromUrl(input, categories) {
  const sp =
    input instanceof URLSearchParams
      ? input
      : nextSearchParamsRecordToURLSearchParams(input)

  const filters = parsePublicSearchFiltersFromParams(sp)
  const extraFilters = parseExtraFiltersFromParams(sp)
  const appliedBbox = parseBBoxFromParams(sp)
  const catalogSort = parseCatalogSortFromParams(sp)

  const categoryWizardProfile =
    filters.selectedCategory && filters.selectedCategory !== 'all'
      ? effectiveCategoryWizardProfileRaw(filters.selectedCategory, categories)
      : null

  const q = String(filters.textQuery || '').trim()
  const initialSemanticFromUrl = sp.get('semantic') === '1' && q.length >= 2
  const useSemantic = initialSemanticFromUrl && filters.smartSearchOn !== false

  return buildCatalogSearchKeyParams({
    selectedCategory: filters.selectedCategory,
    categoryWizardProfile,
    debouncedWhere: filters.where,
    debouncedDateRange: filters.dateRange,
    debouncedGuests: filters.guests,
    checkInTime: filters.checkInTime,
    checkOutTime: filters.checkOutTime,
    appliedMapBounds: appliedBbox,
    extraFilters,
    textQuery: q.length >= 2 ? q : '',
    useSemantic,
    catalogSort,
  })
}
