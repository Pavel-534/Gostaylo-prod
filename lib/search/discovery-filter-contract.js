/**
 * Stage 177.1 — DiscoveryFilterContract: parse + validate SSOT.
 */

import {
  firstIntParam,
} from '@/lib/api/search/params'
import { parseFromRegistry } from '@/lib/search/filter-registry'
import { decodeDiscoveryCursor, isDiscoveryStableCatalogSort } from '@/lib/search/discovery-cursor-codec'
import { isDiscoveryUnifiedPipelineEnabled } from '@/lib/search/discovery-pipeline-flag'
import { parseDiscoveryStayParams } from '@/lib/search/discovery-stay-params'

export { parseDiscoveryStayParams } from '@/lib/search/discovery-stay-params'

/** @typedef {import('@/lib/search/filter-registry').DiscoverySurface} DiscoverySurface */

const AMENITY_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,48}$/
const MAX_AMENITIES = 24
const MAX_BROWSE_LIMIT = 500
const UNIFIED_CATALOG_DEFAULT_LIMIT = 24
const UNIFIED_CATALOG_MAX_LIMIT = 50

/**
 * @param {import('@/lib/search/filter-registry').DiscoveryFilterContract} draft
 * @returns {boolean}
 */
export function isUnifiedCatalogBrowse(draft) {
  return isDiscoveryUnifiedPipelineEnabled() && draft.browse?.surface === 'catalog'
}

/**
 * @param {{ surface?: DiscoverySurface, isLite?: boolean }} [options]
 * @returns {import('@/lib/search/filter-registry').DiscoveryFilterContract}
 */
export function createEmptyDiscoveryContract(options = {}) {
  return {
    version: 1,
    q: null,
    semantic: false,
    categorySlug: null,
    categoryIds: null,
    geo: null,
    stay: {
      checkIn: null,
      checkOut: null,
      checkInTime: null,
      checkOutTime: null,
      guests: null,
      softAvailability: true,
    },
    price: {
      minThb: null,
      maxThb: null,
    },
    housing: {
      bedroomsMin: null,
      bathroomsMin: null,
      amenities: [],
      instantBookingOnly: false,
      propertyType: null,
    },
    vertical: {
      transmission: null,
      fuelType: null,
      engineCcMin: null,
      cabinsMin: null,
      withCaptain: false,
      vesselType: null,
      nannyLangs: [],
      nannyExperienceMin: null,
      nannySpecialization: null,
      serviceHomeVisitOnly: false,
    },
    where: null,
    locationLegacy: null,
    cityLegacy: null,
    browse: {
      limit: 50,
      featured: true,
      sort: null,
      cursor: null,
      cursorRaw: null,
      isLite: options.isLite !== false,
      surface: options.surface || 'catalog',
    },
    map: {
      cluster: false,
      clusterCellM: 3500,
    },
  }
}

/**
 * @param {import('@/lib/search/filter-registry').DiscoveryFilterContract} contract
 * @returns {import('@/lib/search/filter-registry').DiscoveryFilterContract}
 */
export function freezeDiscoveryContract(contract) {
  const stay = { ...contract.stay }
  const housing = { ...contract.housing }
  const vertical = { ...contract.vertical }
  delete stay._guestsInvalid
  delete housing._bedroomsInvalid
  delete housing._bathroomsInvalid
  delete housing._propertyTypeInvalid
  delete vertical._transmissionInvalid
  delete vertical._fuelTypeInvalid
  delete vertical._engineCcInvalid
  delete vertical._vesselTypeInvalid
  delete vertical._cabinsInvalid
  delete vertical._withCaptainInvalid
  delete vertical._serviceLangInvalid
  delete vertical._serviceExperienceInvalid
  delete vertical._serviceHomeVisitInvalid

  return Object.freeze({
    ...contract,
    stay: Object.freeze(stay),
    housing: Object.freeze(housing),
    vertical: Object.freeze(vertical),
  })
}

/**
 * @param {URLSearchParams} sp
 * @param {import('@/lib/search/filter-registry').DiscoveryFilterContract} draft
 */
export function parseDiscoveryBrowseParams(sp, draft) {
  const limit = firstIntParam(sp, 'limit')
  const unifiedCatalog = isUnifiedCatalogBrowse(draft)

  if (unifiedCatalog) {
    const rawLimit = limit != null && limit > 0 ? limit : UNIFIED_CATALOG_DEFAULT_LIMIT
    draft.browse.limit = Math.min(rawLimit, UNIFIED_CATALOG_MAX_LIMIT)
  } else if (limit != null && limit > 0) {
    draft.browse.limit = limit
  }

  const sortRaw = sp.get('sort')
  draft.browse.sort = sortRaw && String(sortRaw).trim() ? String(sortRaw).trim() : null

  const cursorRaw = sp.get('cursor')
  if (draft.browse.surface === 'catalog' && cursorRaw && String(cursorRaw).trim()) {
    draft.browse.cursorRaw = String(cursorRaw).trim()
    const decoded = decodeDiscoveryCursor(draft.browse.cursorRaw)
    if (decoded.ok) {
      draft.browse.cursor = decoded.value
    }
  }

  draft.browse.featured = sp.get('featured') !== 'false'
  draft.map.cluster = sp.get('cluster') === '1'
  const cellM = parseFloat(sp.get('clusterCellM') || '')
  if (Number.isFinite(cellM) && cellM > 0) {
    draft.map.clusterCellM = cellM
  }
}

/**
 * @param {URLSearchParams} sp
 * @param {import('@/lib/search/filter-registry').DiscoveryFilterContract} draft
 */
export function parseDiscoveryTextParams(sp, draft) {
  const q = sp.get('q')
  draft.q = q && String(q).trim() ? String(q).trim() : null
  draft.semantic = sp.get('semantic') === '1'
  draft.where = sp.get('where')
  draft.locationLegacy = sp.get('location')
  draft.cityLegacy = sp.get('city')
}

/**
 * @param {import('@/lib/search/filter-registry').DiscoveryFilterContract} contract
 * @returns {import('@/lib/search/filter-registry').DiscoveryValidationIssue[]}
 */
export function collectDiscoveryValidationIssues(contract) {
  /** @type {import('@/lib/search/filter-registry').DiscoveryValidationIssue[]} */
  const issues = []

  if (contract.geo?.mode === 'bbox') {
    const { south, north, west, east } = contract.geo
    if (![south, north, west, east].every((n) => Number.isFinite(n))) {
      issues.push({
        code: 'BBOX_INVALID',
        path: 'geo.bbox',
        message: 'Viewport bounds must be finite numbers',
      })
    } else if (south >= north || west >= east) {
      issues.push({
        code: 'BBOX_INVALID',
        path: 'geo.bbox',
        message: 'Invalid viewport bounds ordering',
      })
    }
  }

  const amenities = contract.housing?.amenities || []
  if (amenities.length > MAX_AMENITIES) {
    issues.push({
      code: 'AMENITIES_INVALID',
      path: 'housing.amenities',
      message: `Too many amenities (max ${MAX_AMENITIES})`,
    })
  }
  for (const slug of amenities) {
    if (!AMENITY_SLUG_RE.test(slug)) {
      issues.push({
        code: 'AMENITIES_INVALID',
        path: 'housing.amenities',
        message: `Invalid amenity slug: ${slug}`,
      })
    }
  }

  const limit = contract.browse?.limit
  const unifiedCatalog = isUnifiedCatalogBrowse(contract)
  const maxBrowseLimit = unifiedCatalog ? UNIFIED_CATALOG_MAX_LIMIT : MAX_BROWSE_LIMIT

  if (!Number.isFinite(limit) || limit < 1 || limit > maxBrowseLimit) {
    issues.push({
      code: 'LIMIT_OUT_OF_RANGE',
      path: 'browse.limit',
      message: unifiedCatalog
        ? `limit must be between 1 and ${UNIFIED_CATALOG_MAX_LIMIT}`
        : `limit must be between 1 and ${MAX_BROWSE_LIMIT}`,
    })
  }

  const hasCursorRaw = Boolean(contract.browse?.cursorRaw && String(contract.browse.cursorRaw).trim())
  if (hasCursorRaw) {
    const decoded = decodeDiscoveryCursor(contract.browse.cursorRaw)
    if (!decoded.ok) {
      issues.push({
        code: decoded.issue.code,
        path: 'browse.cursor',
        message: decoded.issue.message,
      })
    }

    if (!isDiscoveryStableCatalogSort(contract.browse?.sort)) {
      issues.push({
        code: 'CURSOR_SORT_NOT_SUPPORTED',
        path: 'browse.cursor',
        message: 'Cursor pagination requires sort=created_at',
      })
    }
  }

  const minThb = contract.price?.minThb
  const maxThb = contract.price?.maxThb
  if (minThb != null && maxThb != null && minThb > maxThb) {
    issues.push({
      code: 'PRICE_RANGE_INVALID',
      path: 'price',
      message: 'min_price must be less than or equal to max_price',
    })
  }

  if (contract.housing?._bedroomsInvalid) {
    issues.push({
      code: 'BEDROOMS_INVALID',
      path: 'housing.bedroomsMin',
      message: 'bedrooms must be a positive integer',
    })
  }

  if (contract.housing?._bathroomsInvalid) {
    issues.push({
      code: 'BATHROOMS_INVALID',
      path: 'housing.bathroomsMin',
      message: 'bathrooms must be a positive integer',
    })
  }

  if (contract.stay?._guestsInvalid) {
    issues.push({
      code: 'GUESTS_INVALID',
      path: 'stay.guests',
      message: 'guests must be an integer between 1 and 99',
    })
  }

  if (contract.housing?._propertyTypeInvalid) {
    issues.push({
      code: 'PROPERTY_TYPE_INVALID',
      path: 'housing.propertyType',
      message: 'property_type must be a valid slug',
    })
  }

  if (contract.vertical?._transmissionInvalid) {
    issues.push({
      code: 'TRANSMISSION_INVALID',
      path: 'vertical.transmission',
      message: 'transmission must be automatic, manual, or cvt',
    })
  }

  if (contract.vertical?._fuelTypeInvalid) {
    issues.push({
      code: 'FUEL_TYPE_INVALID',
      path: 'vertical.fuelType',
      message: 'fuel_type must be a valid fuel slug',
    })
  }

  if (contract.vertical?._engineCcInvalid) {
    issues.push({
      code: 'ENGINE_CC_INVALID',
      path: 'vertical.engineCcMin',
      message: 'engine_cc_min must be a positive number',
    })
  }

  if (contract.vertical?._vesselTypeInvalid) {
    issues.push({
      code: 'VESSEL_TYPE_INVALID',
      path: 'vertical.vesselType',
      message: 'vessel_type must be a valid slug',
    })
  }

  if (contract.vertical?._cabinsInvalid) {
    issues.push({
      code: 'CABINS_INVALID',
      path: 'vertical.cabinsMin',
      message: 'cabins_min must be a positive integer',
    })
  }

  if (contract.vertical?._withCaptainInvalid) {
    issues.push({
      code: 'WITH_CAPTAIN_INVALID',
      path: 'vertical.withCaptain',
      message: 'with_captain must be a boolean flag',
    })
  }

  if (contract.vertical?._serviceLangInvalid) {
    issues.push({
      code: 'SERVICE_LANG_INVALID',
      path: 'vertical.nannyLangs',
      message: 'nanny_langs must be comma-separated language codes (ru, en, th, zh)',
    })
  }

  if (contract.vertical?._serviceExperienceInvalid) {
    issues.push({
      code: 'SERVICE_EXPERIENCE_INVALID',
      path: 'vertical.nannyExperienceMin',
      message: 'nanny_experience_min must be a positive integer',
    })
  }

  if (contract.vertical?._serviceHomeVisitInvalid) {
    issues.push({
      code: 'SERVICE_HOME_VISIT_INVALID',
      path: 'vertical.serviceHomeVisitOnly',
      message: 'service_home_visit must be a boolean flag',
    })
  }

  return issues
}

/**
 * @param {import('@/lib/search/filter-registry').DiscoveryFilterContract} contract
 * @returns {import('@/lib/search/filter-registry').DiscoveryParseResult}
 */
export function validateDiscoveryContract(contract) {
  const issues = collectDiscoveryValidationIssues(contract)
  if (issues.length) {
    return { ok: false, issues }
  }
  return { ok: true, value: freezeDiscoveryContract(contract) }
}

/**
 * @param {URLSearchParams} searchParams
 * @param {{ surface?: DiscoverySurface, isLite?: boolean }} [options]
 * @returns {Promise<import('@/lib/search/filter-registry').DiscoveryParseResult>}
 */
export async function parseDiscoveryFiltersFromSearchParams(searchParams, options = {}) {
  const draft = createEmptyDiscoveryContract(options)
  parseDiscoveryBrowseParams(searchParams, draft)
  parseDiscoveryTextParams(searchParams, draft)
  parseDiscoveryStayParams(searchParams, draft)
  await parseFromRegistry(searchParams, draft)
  return validateDiscoveryContract(draft)
}
