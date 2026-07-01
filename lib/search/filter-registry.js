/**
 * Stage 177.1–177.2b — declarative discovery filter registry (SSOT execution rules).
 */

import { normalizeListingCategorySlugForSearch } from '@/lib/listing-category-slug'
import { resolveListingCategoryIdsForSearchScope } from '@/lib/api/category-search-scope'
import {
  parseAmenitiesFromSearchParams,
  parseMapBounds,
  parseBooleanSearchParam,
} from '@/lib/api/search/params'
import {
  computeSkipPriceBecauseCalendar,
  hasValidDiscoveryStayDateRange,
} from '@/lib/search/discovery-stay-params'
import {
  isHousingFilterVerticalAllowed,
  isHousingScopedRegistryFilterKey,
} from '@/lib/search/discovery-housing-vertical-guard'
import { isTransportOrYachtRegistryFilterAllowedForContract } from '@/lib/search/discovery-transport-vertical-guard'
import {
  buildDiscoveryJsonbTextEqCiPredicate,
  normalizeDiscoveryPropertyTypeSlug,
} from '@/lib/api/search/discovery-jsonb-text-filter'
import {
  buildDiscoveryJsonbNumericGtePredicate,
} from '@/lib/search/discovery-jsonb-numeric-filter'
import {
  normalizeDiscoveryFuelTypeSlug,
  normalizeDiscoveryTransmissionSlug,
  normalizeDiscoveryVesselTypeSlug,
  parseUrlCabinsMinParam,
  parseUrlEngineCcMinParam,
  parseUrlWithCaptainFilterParam,
} from '@/lib/search/discovery-vertical-facet-parse'
import {
  parseUrlMinIntFilterParam,
  parseUrlNonNegativePriceThb,
} from '@/lib/search/discovery-parse-params'

/** @typedef {'catalog'|'map'} DiscoverySurface */
/** @typedef {'sql'|'rpc'|'post'|'availability'|'ranking'} FilterExecutionLayer */
/** @typedef {'all'|'housing'|'transport'|'yacht'|'service'} FilterVerticalScope */

/**
 * @typedef {Object} DiscoveryGeoBbox
 * @property {'bbox'} mode
 * @property {number} south
 * @property {number} north
 * @property {number} west
 * @property {number} east
 * @property {boolean} [quantized]
 */

/**
 * @typedef {DiscoveryGeoBbox|null} DiscoveryGeoFilter
 */

/**
 * @typedef {Object} DiscoveryFilterContract
 * @property {1} version
 * @property {string|null} q
 * @property {boolean} semantic
 * @property {string|null} categorySlug
 * @property {string[]|null} categoryIds
 * @property {DiscoveryGeoFilter} geo
 * @property {Object} stay
 * @property {Object} price
 * @property {Object} housing
 * @property {Object} vertical
 * @property {string|null} where
 * @property {string|null} locationLegacy
 * @property {string|null} cityLegacy
 * @property {Object} browse
 * @property {Object} map
 */

/**
 * @typedef {Object} DiscoveryValidationIssue
 * @property {string} code
 * @property {string} path
 * @property {string} message
 */

/**
 * @typedef {{ ok: true, value: DiscoveryFilterContract }|{ ok: false, issues: DiscoveryValidationIssue[] }} DiscoveryParseResult
 */

/**
 * @typedef {Object} DiscoverySqlOrderClause
 * @property {string} column
 * @property {boolean} ascending
 */

/**
 * @typedef {Object} DiscoverySqlCursor
 * @property {'created_at'} sortKey
 * @property {string} lastCreatedAt
 * @property {string} lastId
 */

/**
 * @typedef {Object} DiscoveryScalarPredicate
 * @property {string} column
 * @property {'eq'|'gte'|'lte'|'in'} op
 * @property {number|string|boolean|string[]} value
 */

/**
 * @typedef {Object} DiscoveryJsonbPredicate
 * @property {'@>'|'text_eq_ci'|'jsonb_numeric_gte'} op
 * @property {string} path
 * @property {unknown} value
 */

/**
 * @typedef {Object} DiscoveryQueryPlan
 * @property {DiscoveryFilterContract} contract
 * @property {Object} spatial
 * @property {Object} sql
 * @property {Object} availability
 * @property {{ mode: 'sql'|'calendar', minThb: number|null, maxThb: number|null }} price
 * @property {('availability'|'calendar_price')[]} postSteps
 * @property {string[]} registryFiltersApplied
 * @property {DiscoverySurface} surface
 */

/**
 * @typedef {Object} FilterDefinition
 * @property {string} key
 * @property {string[]} urlKeys
 * @property {FilterVerticalScope[]} verticals
 * @property {FilterExecutionLayer} layer
 * @property {DiscoverySurface[]} [surfaces]
 * @property {(sp: URLSearchParams, draft: DiscoveryFilterContract) => void} [parse]
 * @property {(contract: DiscoveryFilterContract) => Promise<void>} [resolve]
 * @property {(contract: DiscoveryFilterContract, plan: DiscoveryQueryPlan) => void|Promise<void>} [applyPlan]
 */

/**
 * @param {DiscoveryQueryPlan} plan
 * @param {DiscoveryScalarPredicate} predicate
 */
function pushScalarPredicate(plan, predicate) {
  if (!plan.sql.scalarPredicates) {
    plan.sql.scalarPredicates = []
  }
  plan.sql.scalarPredicates.push(predicate)
}

/**
 * @param {DiscoveryFilterContract} contract
 * @param {string} key
 * @returns {boolean}
 */
export function isHousingRegistryFilterAllowedForContract(contract, key) {
  if (!isHousingScopedRegistryFilterKey(key)) return true
  return isHousingFilterVerticalAllowed(contract)
}

/** @type {Record<string, FilterDefinition>} */
export const FILTER_REGISTRY = {
  category: {
    key: 'category',
    urlKeys: ['category'],
    verticals: ['all'],
    layer: 'sql',
    surfaces: ['catalog', 'map'],
    parse(sp, draft) {
      const raw = sp.get('category')
      if (!raw) return
      const slug = normalizeListingCategorySlugForSearch(raw)
      draft.categorySlug = slug && slug !== 'all' ? slug : null
    },
    async resolve(contract) {
      if (!contract.categorySlug) {
        contract.categoryIds = null
        return
      }
      if (contract.categoryIds?.length) return
      contract.categoryIds = await resolveListingCategoryIdsForSearchScope(contract.categorySlug)
    },
    applyPlan(contract, plan) {
      plan.sql.categoryIds = contract.categoryIds?.length ? [...contract.categoryIds] : null
      plan.registryFiltersApplied.push('category')
    },
  },

  'geo.bbox': {
    key: 'geo.bbox',
    urlKeys: ['south', 'north', 'west', 'east'],
    verticals: ['all'],
    layer: 'rpc',
    surfaces: ['catalog', 'map'],
    parse(sp, draft) {
      const bbox = parseMapBounds(sp)
      if (!bbox) return
      draft.geo = { mode: 'bbox', ...bbox, quantized: false }
    },
    applyPlan(contract, plan) {
      if (contract.geo?.mode !== 'bbox') return
      plan.spatial = {
        engine: 'postgis',
        rpc: 'listings_ids_in_bbox_gist_v1',
        rpcArgs: {
          south: contract.geo.south,
          west: contract.geo.west,
          north: contract.geo.north,
          east: contract.geo.east,
          categoryIds: plan.sql.categoryIds,
        },
        listingIds: null,
        bboxLegacy: null,
      }
      plan.registryFiltersApplied.push('geo.bbox')
    },
  },

  'stay.dates': {
    key: 'stay.dates',
    urlKeys: ['checkIn', 'checkOut'],
    verticals: ['all'],
    layer: 'availability',
    surfaces: ['catalog', 'map'],
    parse() {
      // SSOT: parseDiscoveryStayParams in discovery-filter-contract.js
    },
    applyPlan(contract, plan) {
      if (!hasValidDiscoveryStayDateRange(contract.stay)) return

      plan.availability = {
        engine: 'batch_rpc',
        rpc: 'batch_check_listing_availability',
        checkIn: contract.stay.checkIn,
        checkOut: contract.stay.checkOut,
        guestsCount: Math.max(1, contract.stay?.guests ?? 1),
        softAvailability: contract.stay?.softAvailability !== false,
      }
      plan.sql.skipPriceBecauseCalendar = true
      plan.price.mode = 'calendar'
      plan.registryFiltersApplied.push('stay.dates')
    },
  },

  'price.range': {
    key: 'price.range',
    urlKeys: ['min_price', 'minPrice', 'max_price', 'maxPrice'],
    verticals: ['all'],
    layer: 'sql',
    surfaces: ['catalog', 'map'],
    parse(sp, draft) {
      const minThb = parseUrlNonNegativePriceThb(sp, 'min_price', 'minPrice')
      const maxThb = parseUrlNonNegativePriceThb(sp, 'max_price', 'maxPrice')
      if (minThb != null) draft.price.minThb = minThb
      if (maxThb != null) draft.price.maxThb = maxThb
    },
    applyPlan(contract, plan) {
      if (contract.price?.minThb != null) {
        plan.price.minThb = contract.price.minThb
      }
      if (contract.price?.maxThb != null) {
        plan.price.maxThb = contract.price.maxThb
      }

      const calendarPriceMode = plan.price.mode === 'calendar' || plan.sql.skipPriceBecauseCalendar

      if (calendarPriceMode) {
        if (contract.price?.minThb != null || contract.price?.maxThb != null) {
          plan.registryFiltersApplied.push('price.range')
        }
        return
      }

      plan.sql.skipPriceBecauseCalendar = computeSkipPriceBecauseCalendar(contract.stay)

      if (plan.sql.skipPriceBecauseCalendar) {
        if (contract.price?.minThb != null || contract.price?.maxThb != null) {
          plan.registryFiltersApplied.push('price.range')
        }
        return
      }

      if (contract.price?.minThb != null) {
        plan.sql.priceMinThb = contract.price.minThb
        pushScalarPredicate(plan, {
          column: 'base_price_thb',
          op: 'gte',
          value: contract.price.minThb,
        })
      }
      if (contract.price?.maxThb != null) {
        plan.sql.priceMaxThb = contract.price.maxThb
        pushScalarPredicate(plan, {
          column: 'base_price_thb',
          op: 'lte',
          value: contract.price.maxThb,
        })
      }

      if (contract.price?.minThb != null || contract.price?.maxThb != null) {
        plan.registryFiltersApplied.push('price.range')
      }
    },
  },

  'housing.bedrooms': {
    key: 'housing.bedrooms',
    urlKeys: ['bedrooms', 'bedrooms_min'],
    verticals: ['housing', 'all'],
    layer: 'sql',
    surfaces: ['catalog', 'map'],
    parse(sp, draft) {
      const parsed = parseUrlMinIntFilterParam(sp, 'bedrooms', 'bedrooms_min')
      if (parsed.kind === 'active') {
        draft.housing.bedroomsMin = parsed.value
      } else if (parsed.kind === 'invalid') {
        draft.housing._bedroomsInvalid = true
      }
    },
    applyPlan(contract, plan) {
      const min = contract.housing?.bedroomsMin
      if (!Number.isFinite(min) || min < 1) return
      plan.sql.bedroomsMin = min
      pushScalarPredicate(plan, { column: 'bedrooms_count', op: 'gte', value: min })
      plan.registryFiltersApplied.push('housing.bedrooms')
    },
  },

  'housing.bathrooms': {
    key: 'housing.bathrooms',
    urlKeys: ['bathrooms', 'bathrooms_min'],
    verticals: ['housing', 'all'],
    layer: 'sql',
    surfaces: ['catalog', 'map'],
    parse(sp, draft) {
      const parsed = parseUrlMinIntFilterParam(sp, 'bathrooms', 'bathrooms_min')
      if (parsed.kind === 'active') {
        draft.housing.bathroomsMin = parsed.value
      } else if (parsed.kind === 'invalid') {
        draft.housing._bathroomsInvalid = true
      }
    },
    applyPlan(contract, plan) {
      const min = contract.housing?.bathroomsMin
      if (!Number.isFinite(min) || min < 1) return
      plan.sql.bathroomsMin = min
      pushScalarPredicate(plan, { column: 'bathrooms_count', op: 'gte', value: min })
      plan.registryFiltersApplied.push('housing.bathrooms')
    },
  },

  'stay.guests': {
    key: 'stay.guests',
    urlKeys: ['guests'],
    verticals: ['housing', 'all'],
    layer: 'availability',
    surfaces: ['catalog', 'map'],
    parse(sp, draft) {
      // guests parsed in parseDiscoveryStayParams; registry key is plan-only marker
    },
    applyPlan(contract, plan) {
      const guests = contract.stay?.guests
      if (!Number.isFinite(guests) || guests < 1) return
      plan.sql.guestsMin = guests
      // Capacity: post-step only via resolveListingGuestCapacity (availability.js).
      // Raw max_capacity in DB is often stale (1) while metadata.bedrooms implies higher.
      plan.registryFiltersApplied.push('stay.guests')
    },
  },

  'housing.property_type': {
    key: 'housing.property_type',
    urlKeys: ['property_type', 'housing_type'],
    verticals: ['housing', 'all'],
    layer: 'sql',
    surfaces: ['catalog', 'map'],
    parse(sp, draft) {
      const raw = sp.get('property_type') || sp.get('housing_type')
      if (!raw) return
      const normalized = normalizeDiscoveryPropertyTypeSlug(raw)
      if (normalized.invalid) {
        draft.housing._propertyTypeInvalid = true
        return
      }
      if (normalized.value) {
        draft.housing.propertyType = normalized.value
      }
    },
    applyPlan(contract, plan) {
      const propertyType = contract.housing?.propertyType
      if (!propertyType) return
      plan.sql.propertyType = propertyType
      if (!plan.sql.jsonbPredicates) {
        plan.sql.jsonbPredicates = []
      }
      plan.sql.jsonbPredicates.push(buildDiscoveryJsonbTextEqCiPredicate('property_type', propertyType))
      plan.registryFiltersApplied.push('housing.property_type')
    },
  },

  'housing.instant_booking': {
    key: 'housing.instant_booking',
    urlKeys: ['instant_booking', 'instantBooking'],
    verticals: ['all'],
    layer: 'sql',
    surfaces: ['catalog', 'map'],
    parse(sp, draft) {
      if (parseBooleanSearchParam(sp, 'instant_booking', 'instantBooking') === true) {
        draft.housing.instantBookingOnly = true
      }
    },
    applyPlan(contract, plan) {
      if (!contract.housing?.instantBookingOnly) return
      plan.sql.instantBookingOnly = true
      pushScalarPredicate(plan, { column: 'instant_booking', op: 'eq', value: true })
      plan.registryFiltersApplied.push('housing.instant_booking')
    },
  },

  'housing.amenities': {
    key: 'housing.amenities',
    urlKeys: ['amenities'],
    verticals: ['all', 'housing'],
    layer: 'sql',
    surfaces: ['catalog', 'map'],
    parse(sp, draft) {
      const amenities = parseAmenitiesFromSearchParams(sp)
      if (amenities.length) {
        draft.housing.amenities = amenities
      }
    },
    applyPlan(contract, plan) {
      const amenities = contract.housing?.amenities || []
      if (!amenities.length) return
      plan.sql.amenities = [...amenities]
      if (!plan.sql.jsonbPredicates) {
        plan.sql.jsonbPredicates = []
      }
      plan.sql.jsonbPredicates.push({
        op: '@>',
        path: 'amenities',
        value: amenities,
      })
      plan.registryFiltersApplied.push('housing.amenities')
    },
  },

  'transport.transmission': {
    key: 'transport.transmission',
    urlKeys: ['transmission'],
    verticals: ['transport'],
    layer: 'sql',
    surfaces: ['catalog', 'map'],
    parse(sp, draft) {
      const raw = sp.get('transmission')
      if (!raw) return
      const normalized = normalizeDiscoveryTransmissionSlug(raw)
      if (normalized.invalid) {
        draft.vertical._transmissionInvalid = true
        return
      }
      if (normalized.value) {
        draft.vertical.transmission = normalized.value
      }
    },
    applyPlan(contract, plan) {
      const transmission = contract.vertical?.transmission
      if (!transmission) return
      if (!plan.sql.jsonbPredicates) {
        plan.sql.jsonbPredicates = []
      }
      plan.sql.transmission = transmission
      plan.sql.jsonbPredicates.push(
        buildDiscoveryJsonbTextEqCiPredicate('transmission', transmission),
      )
      plan.registryFiltersApplied.push('transport.transmission')
    },
  },

  'transport.fuel_type': {
    key: 'transport.fuel_type',
    urlKeys: ['fuel_type', 'fuelType'],
    verticals: ['transport'],
    layer: 'sql',
    surfaces: ['catalog', 'map'],
    parse(sp, draft) {
      const raw = sp.get('fuel_type') || sp.get('fuelType')
      if (!raw) return
      const normalized = normalizeDiscoveryFuelTypeSlug(raw)
      if (normalized.invalid) {
        draft.vertical._fuelTypeInvalid = true
        return
      }
      if (normalized.value) {
        draft.vertical.fuelType = normalized.value
      }
    },
    applyPlan(contract, plan) {
      const fuelType = contract.vertical?.fuelType
      if (!fuelType) return
      if (!plan.sql.jsonbPredicates) {
        plan.sql.jsonbPredicates = []
      }
      plan.sql.fuelType = fuelType
      plan.sql.jsonbPredicates.push(buildDiscoveryJsonbTextEqCiPredicate('fuel_type', fuelType))
      plan.registryFiltersApplied.push('transport.fuel_type')
    },
  },

  'transport.engine_cc_min': {
    key: 'transport.engine_cc_min',
    urlKeys: ['engine_cc_min', 'engineCcMin'],
    verticals: ['transport'],
    layer: 'sql',
    surfaces: ['catalog', 'map'],
    parse(sp, draft) {
      const parsed = parseUrlEngineCcMinParam(sp, 'engine_cc_min', 'engineCcMin')
      if (parsed.kind === 'active') {
        draft.vertical.engineCcMin = parsed.value
      } else if (parsed.kind === 'invalid') {
        draft.vertical._engineCcInvalid = true
      }
    },
    applyPlan(contract, plan) {
      const min = contract.vertical?.engineCcMin
      if (!Number.isFinite(min) || min <= 0) return
      if (!plan.sql.jsonbPredicates) {
        plan.sql.jsonbPredicates = []
      }
      plan.sql.engineCcMin = min
      plan.sql.jsonbPredicates.push(buildDiscoveryJsonbNumericGtePredicate('engine_cc', min))
      plan.registryFiltersApplied.push('transport.engine_cc_min')
    },
  },

  'yacht.with_captain': {
    key: 'yacht.with_captain',
    urlKeys: ['with_captain', 'crew_included', 'withCaptain'],
    verticals: ['yacht', 'transport'],
    layer: 'sql',
    surfaces: ['catalog', 'map'],
    parse(sp, draft) {
      const parsed = parseUrlWithCaptainFilterParam(
        sp,
        'with_captain',
        'crew_included',
        'withCaptain',
      )
      if (parsed.kind === 'active') {
        draft.vertical.withCaptain = true
      } else if (parsed.kind === 'invalid') {
        draft.vertical._withCaptainInvalid = true
      }
    },
    applyPlan(contract, plan) {
      if (contract.vertical?.withCaptain !== true) return
      if (!plan.sql.jsonbPredicates) {
        plan.sql.jsonbPredicates = []
      }
      plan.sql.withCaptain = true
      plan.sql.jsonbPredicates.push({
        op: '@>',
        path: 'crew_included',
        value: true,
      })
      plan.registryFiltersApplied.push('yacht.with_captain')
    },
  },

  'yacht.vessel_type': {
    key: 'yacht.vessel_type',
    urlKeys: ['yacht_type', 'vessel_type'],
    verticals: ['yacht'],
    layer: 'sql',
    surfaces: ['catalog', 'map'],
    parse(sp, draft) {
      const raw = sp.get('yacht_type') || sp.get('vessel_type')
      if (!raw) return
      const normalized = normalizeDiscoveryVesselTypeSlug(raw)
      if (normalized.invalid) {
        draft.vertical._vesselTypeInvalid = true
        return
      }
      if (normalized.value) {
        draft.vertical.vesselType = normalized.value
      }
    },
    applyPlan(contract, plan) {
      const vesselType = contract.vertical?.vesselType
      if (!vesselType) return
      if (!plan.sql.jsonbPredicates) {
        plan.sql.jsonbPredicates = []
      }
      plan.sql.vesselType = vesselType
      plan.sql.jsonbPredicates.push(
        buildDiscoveryJsonbTextEqCiPredicate('subcategory', vesselType),
      )
      plan.registryFiltersApplied.push('yacht.vessel_type')
    },
  },

  'yacht.cabins_min': {
    key: 'yacht.cabins_min',
    urlKeys: ['cabins_min', 'cabinsMin'],
    verticals: ['yacht'],
    layer: 'sql',
    surfaces: ['catalog', 'map'],
    parse(sp, draft) {
      const parsed = parseUrlCabinsMinParam(sp, 'cabins_min', 'cabinsMin')
      if (parsed.kind === 'active') {
        draft.vertical.cabinsMin = parsed.value
      } else if (parsed.kind === 'invalid') {
        draft.vertical._cabinsInvalid = true
      }
    },
    applyPlan(contract, plan) {
      const min = contract.vertical?.cabinsMin
      if (!Number.isFinite(min) || min < 1) return
      if (!plan.sql.jsonbPredicates) {
        plan.sql.jsonbPredicates = []
      }
      plan.sql.cabinsMin = min
      plan.sql.jsonbPredicates.push(buildDiscoveryJsonbNumericGtePredicate('cabins', min))
      plan.registryFiltersApplied.push('yacht.cabins_min')
    },
  },
}

/** Cascade order: category → geo → dates → housing → transport/yacht facets */
export const ORDERED_FILTER_KEYS = [
  'category',
  'geo.bbox',
  'stay.dates',
  'price.range',
  'housing.bedrooms',
  'housing.bathrooms',
  'stay.guests',
  'housing.property_type',
  'housing.instant_booking',
  'housing.amenities',
  'transport.transmission',
  'transport.fuel_type',
  'transport.engine_cc_min',
  'yacht.with_captain',
  'yacht.vessel_type',
  'yacht.cabins_min',
]

/**
 * @param {URLSearchParams} sp
 * @param {DiscoveryFilterContract} draft
 */
export async function parseFromRegistry(sp, draft) {
  for (const key of ORDERED_FILTER_KEYS) {
    const def = FILTER_REGISTRY[key]
    def.parse?.(sp, draft)
  }
}

/**
 * @param {DiscoveryFilterContract} contract
 * @param {string} key
 * @returns {boolean}
 */
export function isRegistryFilterActive(contract, key) {
  if (!isHousingRegistryFilterAllowedForContract(contract, key)) {
    return false
  }
  if (!isTransportOrYachtRegistryFilterAllowedForContract(contract, key)) {
    return false
  }

  switch (key) {
    case 'category':
      return Boolean(contract.categorySlug)
    case 'geo.bbox':
      return contract.geo?.mode === 'bbox'
    case 'stay.dates':
      return hasValidDiscoveryStayDateRange(contract.stay)
    case 'price.range':
      return contract.price?.minThb != null || contract.price?.maxThb != null
    case 'housing.bedrooms':
      return Number.isFinite(contract.housing?.bedroomsMin) && contract.housing.bedroomsMin >= 1
    case 'housing.bathrooms':
      return Number.isFinite(contract.housing?.bathroomsMin) && contract.housing.bathroomsMin >= 1
    case 'stay.guests':
      return Number.isFinite(contract.stay?.guests) && contract.stay.guests >= 1
    case 'housing.property_type':
      return Boolean(contract.housing?.propertyType)
    case 'housing.instant_booking':
      return contract.housing?.instantBookingOnly === true
    case 'housing.amenities':
      return (contract.housing?.amenities?.length || 0) > 0
    case 'transport.transmission':
      return Boolean(contract.vertical?.transmission)
    case 'transport.fuel_type':
      return Boolean(contract.vertical?.fuelType)
    case 'transport.engine_cc_min':
      return Number.isFinite(contract.vertical?.engineCcMin) && contract.vertical.engineCcMin > 0
    case 'yacht.with_captain':
      return contract.vertical?.withCaptain === true
    case 'yacht.vessel_type':
      return Boolean(contract.vertical?.vesselType)
    case 'yacht.cabins_min':
      return Number.isFinite(contract.vertical?.cabinsMin) && contract.vertical.cabinsMin >= 1
    default:
      return false
  }
}

/**
 * @param {DiscoveryFilterContract} contract
 * @returns {string[]}
 */
export function listActiveRegistryFilterKeys(contract) {
  return ORDERED_FILTER_KEYS.filter((key) => isRegistryFilterActive(contract, key))
}

