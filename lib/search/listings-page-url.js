/**
 * Парсинг и сбор query для /listings (шаринг и синхронизация).
 * ADR-101 Wave 1 — `parsePublicSearchFiltersFromParams` / `buildPublicSearchParams` (What/Where/When/Who SSOT).
 */

import { format, isSameDay, parseISO } from 'date-fns'
import { normalizeListingCategorySlugForSearch } from '@/lib/listing-category-slug'
import {
  CATALOG_SORT_DEFAULT,
  CATALOG_SORT_VALUES,
} from '@/lib/recommendations/constants'
import { parseCatalogSort as parseCatalogSortPolicy } from '@/lib/recommendations/ranking-policy'
import { isDiscoveryStableCatalogSort } from '@/lib/search/discovery-cursor-codec'

/** Верхняя граница слайдера цены (THB); совпадает с UI фильтров */
export const LISTINGS_PRICE_SLIDER_MAX_THB = 80000

/**
 * @param {string | null | undefined} value
 * @returns {typeof CATALOG_SORT_VALUES[number] | 'created_at'}
 */
export function parseCatalogSort(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (isDiscoveryStableCatalogSort(raw)) return raw
  return parseCatalogSortPolicy({
    get: (key) => (key === 'sort' ? value : null),
  })
}

/**
 * @param {URLSearchParams} sp
 * @returns {typeof CATALOG_SORT_VALUES[number]}
 */
export function parseCatalogSortFromParams(sp) {
  return parseCatalogSort(sp.get('sort'))
}

export function parseBBoxFromParams(sp) {
  const south = parseFloat(sp.get('south'))
  const north = parseFloat(sp.get('north'))
  const west = parseFloat(sp.get('west'))
  const east = parseFloat(sp.get('east'))
  if (![south, north, west, east].every((n) => Number.isFinite(n))) return null
  if (south >= north || west >= east) return null
  return { south, north, west, east }
}

export function bboxToSearchParams(bbox, params) {
  if (!bbox) return
  params.set('south', String(bbox.south))
  params.set('north', String(bbox.north))
  params.set('west', String(bbox.west))
  params.set('east', String(bbox.east))
}

/** @typedef {{
 *   minPriceThb: number | null,
 *   maxPriceThb: number | null,
 *   bedroomsMin: number | null,
 *   bathroomsMin: number | null,
 *   amenities: string[],
 *   instantBookingOnly: boolean,
 *   transmission: string,
 *   fuelType: string,
 *   engineCcMin: number | null,
 *   cabinsMin: number | null,
 *   nannyLangs: string[],
 *   nannyExperienceMin: number | null,
 *   nannySpecialization: string,
 *   serviceHomeVisitOnly: boolean,
 * }} ListingsExtraFilters */

export const defaultExtraFilters = () => ({
  minPriceThb: null,
  maxPriceThb: null,
  bedroomsMin: null,
  bathroomsMin: null,
  amenities: [],
  instantBookingOnly: false,
  transmission: '',
  fuelType: '',
  engineCcMin: null,
  cabinsMin: null,
  nannyLangs: [],
  nannyExperienceMin: null,
  nannySpecialization: '',
  serviceHomeVisitOnly: false,
})

/**
 * Immutable copy for filter draft state (ADR-102).
 * @param {Partial<ListingsExtraFilters> | null | undefined} filters
 * @returns {ListingsExtraFilters}
 */
export function cloneExtraFilters(filters) {
  const base = defaultExtraFilters()
  if (!filters || typeof filters !== 'object') return base
  return {
    ...base,
    ...filters,
    amenities: [...(filters.amenities || [])],
    nannyLangs: [...(filters.nannyLangs || [])],
  }
}

/**
 * Structural equality for ADR-102 draft vs committed extra filters.
 * @param {Partial<ListingsExtraFilters> | null | undefined} a
 * @param {Partial<ListingsExtraFilters> | null | undefined} b
 */
export function areExtraFiltersEqual(a, b) {
  const left = cloneExtraFilters(a)
  const right = cloneExtraFilters(b)
  const sorted = (arr) => [...(arr || [])].map(String).sort().join('\u0001')
  return (
    left.minPriceThb === right.minPriceThb &&
    left.maxPriceThb === right.maxPriceThb &&
    left.bedroomsMin === right.bedroomsMin &&
    left.bathroomsMin === right.bathroomsMin &&
    left.instantBookingOnly === right.instantBookingOnly &&
    left.transmission === right.transmission &&
    left.fuelType === right.fuelType &&
    left.engineCcMin === right.engineCcMin &&
    left.cabinsMin === right.cabinsMin &&
    left.nannyExperienceMin === right.nannyExperienceMin &&
    left.nannySpecialization === right.nannySpecialization &&
    left.serviceHomeVisitOnly === right.serviceHomeVisitOnly &&
    sorted(left.amenities) === sorted(right.amenities) &&
    sorted(left.nannyLangs) === sorted(right.nannyLangs)
  )
}

export function parseExtraFiltersFromParams(sp) {
  const pf = (keys) => {
    for (const k of keys) {
      const v = sp.get(k)
      if (v != null && v !== '') {
        const n = parseFloat(v)
        if (Number.isFinite(n)) return n
      }
    }
    return null
  }
  const pi = (keys) => {
    for (const k of keys) {
      const v = sp.get(k)
      if (v != null && v !== '') {
        const n = parseInt(v, 10)
        if (Number.isFinite(n)) return n
      }
    }
    return null
  }
  const comma = (key) =>
    (sp.get(key) || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

  return {
    minPriceThb: pf(['min_price', 'minPrice']),
    maxPriceThb: pf(['max_price', 'maxPrice']),
    bedroomsMin: pi(['bedrooms', 'bedrooms_min']),
    bathroomsMin: pi(['bathrooms', 'bathrooms_min']),
    amenities: comma('amenities'),
    instantBookingOnly: ['1', 'true', 'yes', 'on'].includes(
      String(sp.get('instant_booking') ?? sp.get('instantBooking') ?? '').toLowerCase(),
    ),
    transmission: sp.get('transmission')?.trim() || '',
    fuelType: sp.get('fuel_type')?.trim() || sp.get('fuelType')?.trim() || '',
    engineCcMin: pf(['engine_cc_min', 'engineCcMin']),
    cabinsMin: pi(['cabins_min', 'cabinsMin']),
    nannyLangs: comma('nanny_langs'),
    nannyExperienceMin: pi(['nanny_experience_min', 'nannyExperienceMin']),
    nannySpecialization: sp.get('nanny_specialization')?.trim() || sp.get('nannySpecialization')?.trim() || '',
    serviceHomeVisitOnly: ['1', 'true', 'yes', 'on'].includes(
      String(sp.get('service_home_visit') ?? sp.get('home_visit_only') ?? '').toLowerCase(),
    ),
  }
}

export function hasActiveExtraFilters(f) {
  if (!f) return false
  if (f.minPriceThb != null && f.minPriceThb > 0) return true
  if (
    f.maxPriceThb != null &&
    f.maxPriceThb > 0 &&
    f.maxPriceThb < LISTINGS_PRICE_SLIDER_MAX_THB
  )
    return true
  if (f.bedroomsMin != null && f.bedroomsMin > 0) return true
  if (f.bathroomsMin != null && f.bathroomsMin > 0) return true
  if (f.amenities?.length) return true
  if (f.instantBookingOnly) return true
  if (f.transmission) return true
  if (f.fuelType) return true
  if (f.engineCcMin != null && f.engineCcMin > 0) return true
  if (f.cabinsMin != null && f.cabinsMin > 0) return true
  if (f.nannyLangs?.length) return true
  if (f.nannyExperienceMin != null && f.nannyExperienceMin > 0) return true
  if (f.nannySpecialization) return true
  if (f.serviceHomeVisitOnly) return true
  return false
}

export function appendExtraFiltersToParams(params, f) {
  if (f.minPriceThb != null && f.minPriceThb > 0) params.set('min_price', String(Math.round(f.minPriceThb)))
  if (
    f.maxPriceThb != null &&
    f.maxPriceThb > 0 &&
    f.maxPriceThb < LISTINGS_PRICE_SLIDER_MAX_THB
  ) {
    params.set('max_price', String(Math.round(f.maxPriceThb)))
  }
  if (f.bedroomsMin != null && f.bedroomsMin > 0) params.set('bedrooms', String(f.bedroomsMin))
  if (f.bathroomsMin != null && f.bathroomsMin > 0) params.set('bathrooms', String(f.bathroomsMin))
  if (f.amenities?.length) params.set('amenities', f.amenities.join(','))
  if (f.instantBookingOnly) params.set('instant_booking', '1')
  if (f.transmission) params.set('transmission', f.transmission)
  if (f.fuelType) params.set('fuel_type', f.fuelType)
  if (f.engineCcMin != null && f.engineCcMin > 0) params.set('engine_cc_min', String(f.engineCcMin))
  if (f.cabinsMin != null && f.cabinsMin > 0) params.set('cabins_min', String(f.cabinsMin))
  if (f.nannyLangs?.length) params.set('nanny_langs', f.nannyLangs.join(','))
  if (f.nannyExperienceMin != null && f.nannyExperienceMin > 0) {
    params.set('nanny_experience_min', String(f.nannyExperienceMin))
  }
  if (f.nannySpecialization) params.set('nanny_specialization', f.nannySpecialization)
  if (f.serviceHomeVisitOnly) params.set('service_home_visit', '1')
}

/**
 * Есть ли «смысловые» фильтры в query (как в app/api/v2/listings/search/route.js).
 * Не учитывает limit/featured — только то, что меняет выборку.
 */
const MEANINGFUL_LISTINGS_BROWSE_KEYS = [
  'q',
  'where',
  'location',
  'city',
  'lat',
  'lon',
  'south',
  'north',
  'west',
  'east',
  'category',
  'checkIn',
  'checkOut',
  'guests',
  'minPrice',
  'maxPrice',
  'min_price',
  'max_price',
  'bedrooms',
  'bedrooms_min',
  'bathrooms',
  'bathrooms_min',
  'amenities',
  'instant_booking',
  'instantBooking',
  'transmission',
  'fuel_type',
  'fuelType',
  'engine_cc_min',
  'engineCcMin',
  'cabins_min',
  'cabinsMin',
  'nanny_langs',
  'nanny_experience_min',
  'nannyExperienceMin',
  'nanny_specialization',
  'nannySpecialization',
  'service_home_visit',
  'home_visit_only',
]

function toURLSearchParamsLoose(input) {
  if (input instanceof URLSearchParams) return input
  const u = new URLSearchParams()
  if (!input || typeof input !== 'object') return u
  for (const key of Object.keys(input)) {
    const val = input[key]
    if (val === undefined) continue
    if (Array.isArray(val)) val.forEach((v) => u.append(key, String(v)))
    else u.set(key, String(val))
  }
  return u
}

/** Next.js page `searchParams` → URLSearchParams (SSR metadata, ItemList). */
export function nextSearchParamsRecordToURLSearchParams(input) {
  return toURLSearchParamsLoose(input)
}

export function hasMeaningfulListingsBrowseQuery(searchParams) {
  const sp = toURLSearchParamsLoose(searchParams)
  for (const k of MEANINGFUL_LISTINGS_BROWSE_KEYS) {
    const v = sp.get(k)
    if (v != null && v !== '' && String(v).toLowerCase() !== 'all') return true
  }
  return false
}

/** @typedef {{ from: Date | null, to: Date | null }} PublicSearchDateRange */

/**
 * @typedef {Object} PublicSearchFiltersSnapshot
 * @property {string} selectedCategory
 * @property {string} where
 * @property {PublicSearchDateRange} dateRange
 * @property {string} checkInTime
 * @property {string} checkOutTime
 * @property {string} guests
 * @property {{ adults: number, children: number, infants: number }} guestsBreakdown
 * @property {string} textQuery
 * @property {boolean} smartSearchOn
 */

/**
 * @typedef {Object} BuildPublicSearchParamsOptions
 * @property {boolean} [includeSemantic]
 * @property {boolean} [semanticSiteEnabled]
 * @property {boolean} [transportIntervalMode]
 * @property {boolean} [omitSameDayCheckout] — home: не писать checkOut если from === to
 * @property {ReturnType<typeof defaultExtraFilters> | null} [extraFilters]
 * @property {{ south: number, north: number, west: number, east: number } | null} [appliedBbox]
 * @property {string | null} [catalogSort]
 */

/** Canonical «Куда» для URL и UI (ADR-101). */
export function canonicalPublicSearchWhere(w) {
  if (w == null) return 'all'
  const s = String(w).trim()
  if (!s || s.toLowerCase() === 'all') return 'all'
  return s
}

/** HH:mm из query; fallback 07:00. */
export function parsePublicSearchTimeParam(v, fallback = '07:00') {
  const s = String(v || '').trim()
  return /^\d{2}:\d{2}$/.test(s) ? s : fallback
}

/** Smart search toggle: URL semantic → localStorage → default true. */
export function parseSmartSearchOnFromParams(sp) {
  const params = sp instanceof URLSearchParams ? sp : toURLSearchParamsLoose(sp)
  const sem = params.get('semantic')
  if (sem === '0') return false
  if (sem === '1') return true
  if (typeof window !== 'undefined') {
    try {
      const ls = localStorage.getItem('gostaylo_smart_search')
      if (ls === '0') return false
      if (ls === '1') return true
    } catch {
      /* ignore */
    }
  }
  return true
}

/**
 * Разбор core-фильтров What/Where/When/Who (+ q, semantic) из URL.
 * @param {URLSearchParams | Record<string, string | string[] | undefined> | null | undefined} input
 * @returns {PublicSearchFiltersSnapshot}
 */
export function parsePublicSearchFiltersFromParams(input) {
  const sp = input instanceof URLSearchParams ? input : toURLSearchParamsLoose(input)

  const selectedCategory = normalizeListingCategorySlugForSearch(sp.get('category') || 'all')
  const where = canonicalPublicSearchWhere(
    sp.get('where') || sp.get('location') || sp.get('city') || 'all',
  )
  const guests = sp.get('guests') || '1'
  const guestTotal = Math.max(1, parseInt(guests, 10) || 1)

  /** @type {PublicSearchDateRange} */
  let dateRange = { from: null, to: null }
  const checkInRaw = sp.get('checkIn')
  const checkOutRaw = sp.get('checkOut')
  if (checkInRaw) {
    try {
      dateRange.from = parseISO(checkInRaw)
    } catch {
      dateRange.from = null
    }
  }
  if (checkOutRaw) {
    try {
      dateRange.to = parseISO(checkOutRaw)
    } catch {
      dateRange.to = null
    }
  }

  return {
    selectedCategory,
    where,
    dateRange,
    checkInTime: parsePublicSearchTimeParam(sp.get('checkInTime')),
    checkOutTime: parsePublicSearchTimeParam(sp.get('checkOutTime')),
    guests,
    guestsBreakdown: { adults: guestTotal, children: 0, infants: 0 },
    textQuery: sp.get('q') || '',
    smartSearchOn: parseSmartSearchOnFromParams(sp),
  }
}

/**
 * Сбор URLSearchParams для core-фильтров (+ optional catalog extras).
 * @param {PublicSearchFiltersSnapshot} filters
 * @param {BuildPublicSearchParamsOptions} [options]
 * @returns {URLSearchParams}
 */
export function buildPublicSearchParams(filters, options = {}) {
  const {
    includeSemantic = false,
    semanticSiteEnabled = true,
    transportIntervalMode = false,
    omitSameDayCheckout = false,
    extraFilters = null,
    appliedBbox = null,
    catalogSort = null,
  } = options

  const params = new URLSearchParams()
  const {
    selectedCategory,
    where,
    dateRange,
    checkInTime,
    checkOutTime,
    guests,
    textQuery,
    smartSearchOn,
  } = filters

  if (selectedCategory && selectedCategory !== 'all') {
    params.set('category', selectedCategory)
  }
  if (where && where !== 'all') {
    params.set('where', where)
  }
  if (dateRange?.from) {
    params.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
  }
  if (dateRange?.to) {
    const skipSameDay =
      omitSameDayCheckout &&
      dateRange.from &&
      isSameDay(dateRange.from, dateRange.to)
    if (!skipSameDay) {
      params.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
    }
  }
  if (
    transportIntervalMode &&
    dateRange?.from &&
    dateRange?.to &&
    (!omitSameDayCheckout || !isSameDay(dateRange.from, dateRange.to))
  ) {
    params.set('checkInTime', checkInTime || '07:00')
    params.set('checkOutTime', checkOutTime || '07:00')
  }
  if (guests && guests !== '1') {
    params.set('guests', guests)
  }
  const qt = String(textQuery || '').trim()
  if (qt.length >= 2) {
    params.set('q', qt)
  }
  if (includeSemantic && semanticSiteEnabled !== false) {
    params.set('semantic', smartSearchOn ? '1' : '0')
  }
  bboxToSearchParams(appliedBbox, params)
  if (extraFilters) {
    appendExtraFiltersToParams(params, extraFilters)
  }
  if (catalogSort && catalogSort !== 'recommended') {
    params.set('sort', catalogSort)
  }

  return params
}

/** Сериализация query для сравнения «уже в URL». */
export function serializePublicSearchQuery(filters, options = {}) {
  return buildPublicSearchParams(filters, options).toString()
}
