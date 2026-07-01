/**
 * Stage 177.1 — build DiscoveryQueryPlan from contract + registry.
 */

import {
  FILTER_REGISTRY,
  ORDERED_FILTER_KEYS,
  isRegistryFilterActive,
} from '@/lib/search/filter-registry'
import { isDiscoveryStableCatalogSort } from '@/lib/search/discovery-cursor-codec'
import { isDiscoveryUnifiedPipelineEnabled } from '@/lib/search/discovery-pipeline-flag'

/** @typedef {import('@/lib/search/filter-registry').DiscoveryFilterContract} DiscoveryFilterContract */
/** @typedef {import('@/lib/search/filter-registry').DiscoveryQueryPlan} DiscoveryQueryPlan */
/** @typedef {import('@/lib/search/filter-registry').DiscoverySurface} DiscoverySurface */
/** @typedef {import('@/lib/search/filter-registry').DiscoverySqlOrderClause} DiscoverySqlOrderClause */

export const DISCOVERY_MAX_SPATIAL_IDS = 10_000

/** @type {DiscoverySqlOrderClause[]} */
export const DISCOVERY_STABLE_CATALOG_ORDER_BY = [
  { column: 'created_at', ascending: false },
  { column: 'id', ascending: false },
]

/**
 * @param {DiscoveryFilterContract} contract
 * @param {DiscoverySurface} surface
 * @returns {DiscoveryQueryPlan}
 */
export function createEmptyDiscoveryQueryPlan(contract, surface) {
  return {
    contract,
    surface,
    registryFiltersApplied: [],
    availability: {
      engine: 'none',
      rpc: null,
      checkIn: null,
      checkOut: null,
      guestsCount: 1,
      softAvailability: true,
    },
    price: {
      mode: 'sql',
      minThb: null,
      maxThb: null,
    },
    postSteps: [],
    spatial: {
      engine: 'none',
      rpc: null,
      rpcArgs: null,
      listingIds: null,
      bboxLegacy: null,
    },
    sql: {
      categoryIds: null,
      listingIds: null,
      amenities: [],
      jsonbPredicates: [],
      scalarPredicates: [],
      priceMinThb: null,
      priceMaxThb: null,
      bedroomsMin: null,
      bathroomsMin: null,
      guestsMin: null,
      instantBookingOnly: false,
      propertyType: null,
      transmission: null,
      fuelType: null,
      engineCcMin: null,
      withCaptain: false,
      vesselType: null,
      cabinsMin: null,
      skipPriceBecauseCalendar: false,
      fetchLimit: Math.min(Math.max(contract.browse?.limit || 50, 50), 500),
      pageSize: null,
      cursor: null,
      orderBy: [],
      paginationMode: 'fetch_limit',
      overFetch: 0,
    },
  }
}

/**
 * @param {DiscoveryQueryPlan} plan
 * @param {typeof FILTER_REGISTRY[string]} def
 * @param {DiscoveryFilterContract} contract
 */
export async function applyFilterDefinitionToPlan(plan, def, contract) {
  if (def.resolve) {
    await def.resolve(contract)
  }
  if (def.applyPlan) {
    await def.applyPlan(contract, plan)
  }
}

/**
 * Shallow clone so resolve() can attach categoryIds on a frozen parse result.
 * @param {DiscoveryFilterContract} contract
 * @returns {DiscoveryFilterContract}
 */
function cloneDiscoveryContractForPlan(contract) {
  return {
    ...contract,
    housing: {
      ...contract.housing,
      amenities: [...(contract.housing?.amenities || [])],
    },
    vertical: {
      ...contract.vertical,
    },
    browse: {
      ...contract.browse,
      cursor: contract.browse?.cursor ? { ...contract.browse.cursor } : null,
    },
    categoryIds: contract.categoryIds ? [...contract.categoryIds] : null,
    geo: contract.geo ? { ...contract.geo } : null,
  }
}

/**
 * @param {DiscoveryQueryPlan} plan
 * @param {DiscoveryFilterContract} contract
 * @param {DiscoverySurface} surface
 */
function applyCursorPaginationToPlan(plan, contract, surface) {
  const cursorMode =
    isDiscoveryUnifiedPipelineEnabled() &&
    surface === 'catalog' &&
    isDiscoveryStableCatalogSort(contract.browse?.sort)

  if (!cursorMode) {
    return
  }

  const pageSize = Math.min(Math.max(contract.browse?.limit || 24, 1), 50)
  plan.sql.pageSize = pageSize
  plan.sql.orderBy = DISCOVERY_STABLE_CATALOG_ORDER_BY.map((clause) => ({ ...clause }))
  plan.sql.paginationMode = 'cursor'
  plan.sql.overFetch = 1
  plan.sql.cursor = contract.browse?.cursor ? { ...contract.browse.cursor } : null
}

/**
 * @param {DiscoveryQueryPlan} plan
 * @returns {('availability'|'calendar_price')[]}
 */
export function computeDiscoveryPostSteps(plan) {
  /** @type {('availability'|'calendar_price')[]} */
  const steps = []

  const datesActive =
    plan.registryFiltersApplied?.includes('stay.dates') ||
    plan.availability?.engine === 'batch_rpc'

  if (datesActive) {
    steps.push('availability')
  }

  const hasCalendarPriceLimits =
    plan.price?.mode === 'calendar' &&
    (plan.price?.minThb != null || plan.price?.maxThb != null)

  if (hasCalendarPriceLimits) {
    steps.push('calendar_price')
  }

  return steps
}

/** Registry keys (excluding category/dates alone) that warrant non-cursor fetch headroom. */
const DISCOVERY_HEAVY_FETCH_HEADROOM_KEYS = new Set([
  'geo.bbox',
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
])

/**
 * @param {DiscoveryFilterContract} contract
 * @returns {boolean}
 */
export function contractNeedsDiscoveryFetchHeadroom(contract) {
  if (contract.geo?.mode === 'bbox') return true
  if ((contract.housing?.amenities?.length || 0) > 0) return true
  if (contract.categorySlug) return true

  return ORDERED_FILTER_KEYS.some(
    (key) =>
      DISCOVERY_HEAVY_FETCH_HEADROOM_KEYS.has(key) && isRegistryFilterActive(contract, key),
  )
}

/**
 * @param {DiscoveryFilterContract} contract
 * @param {{ surface: DiscoverySurface }} ctx
 * @returns {Promise<DiscoveryQueryPlan>}
 */
export async function buildDiscoveryQueryPlan(contract, ctx) {
  const working = cloneDiscoveryContractForPlan(contract)
  const plan = createEmptyDiscoveryQueryPlan(working, ctx.surface)

  const usesCursorPagination =
    isDiscoveryUnifiedPipelineEnabled() &&
    ctx.surface === 'catalog' &&
    isDiscoveryStableCatalogSort(working.browse?.sort)

  if (!usesCursorPagination) {
    const needsHeadroom = contractNeedsDiscoveryFetchHeadroom(working)
    const headroom = needsHeadroom
      ? Math.min(Math.max(working.browse?.limit || 50, 100) * 5, 500)
      : Math.min(Math.max((working.browse?.limit || 50) * 5, 50), 500)
    plan.sql.fetchLimit = headroom
  }

  for (const key of ORDERED_FILTER_KEYS) {
    const def = FILTER_REGISTRY[key]
    if (!def) continue
    if (def.surfaces && !def.surfaces.includes(ctx.surface)) continue
    if (!isRegistryFilterActive(working, key)) continue
    await applyFilterDefinitionToPlan(plan, def, working)
  }

  if (plan.spatial?.rpcArgs && plan.sql.categoryIds?.length) {
    plan.spatial.rpcArgs.categoryIds = plan.sql.categoryIds
  }

  applyCursorPaginationToPlan(plan, working, ctx.surface)

  plan.postSteps = computeDiscoveryPostSteps(plan)

  return plan
}

/**
 * Stable snapshot for parity diff (catalog vs map).
 * @param {DiscoveryQueryPlan} plan
 */
export function discoveryPlanParitySnapshot(plan) {
  return JSON.stringify({
    registryFiltersApplied: [...(plan.registryFiltersApplied || [])].sort(),
    categoryIds: plan.sql.categoryIds ? [...plan.sql.categoryIds].sort() : null,
    amenities: plan.sql.amenities ? [...plan.sql.amenities].sort() : [],
    scalarPredicates: plan.sql.scalarPredicates || [],
    jsonbPredicates: plan.sql.jsonbPredicates || [],
    jsonbPredicatesCount: (plan.sql.jsonbPredicates || []).length,
    vertical: {
      transmission: plan.sql.transmission ?? null,
      fuelType: plan.sql.fuelType ?? null,
      engineCcMin: plan.sql.engineCcMin ?? null,
      withCaptain: plan.sql.withCaptain === true,
      vesselType: plan.sql.vesselType ?? null,
      cabinsMin: plan.sql.cabinsMin ?? null,
    },
    skipPriceBecauseCalendar: Boolean(plan.sql.skipPriceBecauseCalendar),
    availability: plan.availability
      ? {
          engine: plan.availability.engine,
          rpc: plan.availability.rpc,
          checkIn: plan.availability.checkIn,
          checkOut: plan.availability.checkOut,
          guestsCount: plan.availability.guestsCount,
          softAvailability: plan.availability.softAvailability,
        }
      : null,
    price: plan.price
      ? {
          mode: plan.price.mode,
          minThb: plan.price.minThb,
          maxThb: plan.price.maxThb,
        }
      : null,
    postSteps: [...(plan.postSteps || [])],
    spatial: {
      engine: plan.spatial.engine,
      rpc: plan.spatial.rpc,
      rpcArgs: plan.spatial.rpcArgs
        ? {
            south: plan.spatial.rpcArgs.south,
            west: plan.spatial.rpcArgs.west,
            north: plan.spatial.rpcArgs.north,
            east: plan.spatial.rpcArgs.east,
            categoryIds: plan.spatial.rpcArgs.categoryIds
              ? [...plan.spatial.rpcArgs.categoryIds].sort()
              : null,
          }
        : null,
    },
  })
}

/**
 * @param {DiscoveryFilterContract} contract
 * @returns {Promise<{ catalog: DiscoveryQueryPlan, map: DiscoveryQueryPlan, diff: string[]|null }>}
 */
export async function diffDiscoveryPlansForSurfaces(contract) {
  const catalog = await buildDiscoveryQueryPlan(contract, { surface: 'catalog' })
  const map = await buildDiscoveryQueryPlan(contract, { surface: 'map' })
  const catalogSnap = discoveryPlanParitySnapshot(catalog)
  const mapSnap = discoveryPlanParitySnapshot(map)

  if (catalogSnap === mapSnap) {
    return { catalog, map, diff: null }
  }

  return {
    catalog,
    map,
    diff: [`catalog plan snapshot differs from map plan snapshot`],
  }
}
