import { format, isSameDay } from 'date-fns'
import { normalizeListingCategorySlugForSearch } from '@/lib/listing-category-slug'
import { isTransportIntervalWizardProfile } from '@/lib/config/category-wizard-profile-db'
import { appendExtraFiltersToParams, hasActiveExtraFilters, parseCatalogSort } from '@/lib/search/listings-page-url'
import { CATALOG_DISTANCE_SORT_RADIUS_KM } from '@/lib/recommendations/constants'
import { resolveCatalogSortCenter } from '@/lib/geo/catalog-sort-centers'
import { isCatalogCursorPaginationClientEnabled } from '@/lib/search/discovery-pipeline-flag-client'

/** Matches unified discovery default (`discovery-filter-contract.js`). */
export const CATALOG_CURSOR_PAGE_LIMIT = 24

export function withBangkokTime(dateObj, hhmm = '07:00') {
  if (!dateObj) return null
  const d = format(dateObj, 'yyyy-MM-dd')
  const t = /^\d{2}:\d{2}$/.test(String(hhmm || '')) ? String(hhmm) : '07:00'
  return `${d}T${t}:00+07:00`
}

export function boundsParamsReady(bounds) {
  if (!bounds || typeof bounds !== 'object') return false
  const { south, north, west, east } = bounds
  return [south, north, west, east].every((n) => typeof n === 'number' && Number.isFinite(n))
}

/**
 * Сериализуемый объект для queryKey (TanStack Query).
 * @param {object} input
 */
export function buildCatalogSearchKeyParams(input) {
  const {
    selectedCategory,
    categoryWizardProfile = null,
    debouncedWhere,
    debouncedDateRange,
    debouncedGuests,
    checkInTime = '07:00',
    checkOutTime = '07:00',
    appliedMapBounds = null,
    extraFilters = null,
    textQuery = '',
    useSemantic = false,
    limit = '100',
    catalogSort = 'recommended',
    cursor = null,
  } = input

  const parsedSort = parseCatalogSort(catalogSort)
  const cursorPaginationActive = isCatalogCursorPaginationClientEnabled(parsedSort)
  const resolvedLimit = cursorPaginationActive
    ? String(CATALOG_CURSOR_PAGE_LIMIT)
    : String(limit || '100')

  const categoryForApi = normalizeListingCategorySlugForSearch(selectedCategory)
  const intervalMode = isTransportIntervalWizardProfile(categoryWizardProfile, categoryForApi)
  const hasDates = Boolean(debouncedDateRange?.from && debouncedDateRange?.to)
  const hasBounds = boundsParamsReady(appliedMapBounds)
  const hasExtra = hasActiveExtraFilters(extraFilters)

  return {
    category: categoryForApi,
    where: debouncedWhere || 'all',
    checkIn: debouncedDateRange?.from
      ? intervalMode
        ? withBangkokTime(debouncedDateRange.from, checkInTime)
        : format(debouncedDateRange.from, 'yyyy-MM-dd')
      : null,
    checkOut:
      debouncedDateRange?.to &&
      (intervalMode || !isSameDay(debouncedDateRange.from, debouncedDateRange.to))
        ? intervalMode
          ? withBangkokTime(debouncedDateRange.to, checkOutTime)
          : format(debouncedDateRange.to, 'yyyy-MM-dd')
        : null,
    checkInTime: intervalMode && hasDates ? checkInTime : null,
    checkOutTime: intervalMode && hasDates ? checkOutTime : null,
    guests: debouncedGuests || '1',
    q: String(textQuery || '').trim().length >= 2 ? String(textQuery).trim() : null,
    semantic: useSemantic ? '1' : null,
    bounds: hasBounds ? appliedMapBounds : null,
    extraFilters: hasExtra ? extraFilters : null,
    limit: resolvedLimit,
    sort: parsedSort,
    sortCenter: resolveCatalogSortCenter({ where: debouncedWhere, bounds: appliedMapBounds }),
    cursor: cursorPaginationActive && cursor ? String(cursor).trim() : null,
    _flags: { hasDates, hasBounds, hasExtra, intervalMode, cursorPaginationActive },
  }
}

/**
 * @param {ReturnType<typeof buildCatalogSearchKeyParams>} keyParams
 */
export function catalogSearchKeyParamsToUrlSearchParams(keyParams) {
  const params = new URLSearchParams()
  const {
    category,
    where,
    checkIn,
    checkOut,
    checkInTime,
    checkOutTime,
    guests,
    q,
    semantic,
    bounds,
    extraFilters,
    limit,
    sort,
    sortCenter,
    cursor,
  } = keyParams

  if (category && category !== 'all') params.set('category', category)
  if (where && where !== 'all') params.set('where', where)
  if (checkIn) params.set('checkIn', checkIn)
  if (checkOut) params.set('checkOut', checkOut)
  if (checkInTime) params.set('checkInTime', checkInTime)
  if (checkOutTime) params.set('checkOutTime', checkOutTime)
  if (guests) params.set('guests', guests)
  if (q) {
    params.set('q', q)
    if (semantic === '1') params.set('semantic', '1')
  }
  if (boundsParamsReady(bounds)) {
    params.set('south', String(bounds.south))
    params.set('north', String(bounds.north))
    params.set('west', String(bounds.west))
    params.set('east', String(bounds.east))
  }
  appendExtraFiltersToParams(params, extraFilters || {})
  if (sort && sort !== 'recommended') params.set('sort', sort)
  if (sort === 'distance' && sortCenter) {
    params.set('lat', String(sortCenter.lat))
    params.set('lng', String(sortCenter.lng))
    params.set('radius', String(CATALOG_DISTANCE_SORT_RADIUS_KM))
  }
  if (limit) params.set('limit', String(limit))
  if (cursor) params.set('cursor', String(cursor))
  return params
}
