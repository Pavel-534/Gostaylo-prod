/**
 * Stage 177.2c — availability + calendar price post-steps for discovery SQL pages.
 */

import { listingMatchesSearchPriceRange } from '@/lib/search/effective-unit-price-for-search'

/** @typedef {import('@/lib/search/filter-registry').DiscoveryQueryPlan} DiscoveryQueryPlan */

/**
 * @typedef {Object} DiscoveryAvailabilityPageStats
 * @property {number} filteredOutByAvailability
 * @property {number} filteredOutByAvailabilityErrors
 * @property {number} filteredOutByCapacity
 * @property {number} filteredOutByCalendarPrice
 * @property {boolean} hasDateFilter
 */

/** @type {import('@/lib/api/search/availability').filterListingsByAvailability|null} */
let availabilityFilterOverride = null

/** @type {import('@/lib/api/search/availability').filterListingsByAvailability|null} */
let cachedAvailabilityFilter = null

/**
 * Test-only hook — avoids loading CalendarService chain in unit tests.
 * @param {import('@/lib/api/search/availability').filterListingsByAvailability|null} fn
 */
export function __setDiscoveryAvailabilityFilterForTests(fn) {
  availabilityFilterOverride = fn
}

export function __resetDiscoveryAvailabilityFilterForTests() {
  availabilityFilterOverride = null
}

/**
 * @param {object[]} listings
 * @param {object} filters
 * @param {object} [options]
 */
async function runDiscoveryAvailabilityFilter(listings, filters, options) {
  if (availabilityFilterOverride) {
    return availabilityFilterOverride(listings, filters, options)
  }
  if (!cachedAvailabilityFilter) {
    const mod = await import('@/lib/api/search/availability')
    cachedAvailabilityFilter = mod.filterListingsByAvailability
  }
  return cachedAvailabilityFilter(listings, filters, options)
}

/**
 * @param {DiscoveryQueryPlan|null|undefined} plan
 * @returns {boolean}
 */
export function discoveryPlanHasAvailabilityStep(plan) {
  return Boolean(
    plan?.postSteps?.includes('availability') || plan?.availability?.engine === 'batch_rpc',
  )
}

/**
 * @param {DiscoveryQueryPlan|null|undefined} plan
 * @returns {boolean}
 */
export function discoveryPlanHasCalendarPriceStep(plan) {
  return Boolean(
    plan?.postSteps?.includes('calendar_price') ||
      (plan?.price?.mode === 'calendar' &&
        (plan?.price?.minThb != null || plan?.price?.maxThb != null)),
  )
}

/**
 * @param {object[]} pageRows
 * @param {DiscoveryQueryPlan} plan
 * @returns {Promise<{
 *   rows: object[],
 *   stats: DiscoveryAvailabilityPageStats,
 *   pricingAttached: boolean,
 * }>}
 */
export async function applyDiscoveryAvailabilityToPage(pageRows, plan) {
  const inputRows = Array.isArray(pageRows) ? pageRows : []

  if (!discoveryPlanHasAvailabilityStep(plan)) {
    return {
      rows: inputRows,
      stats: {
        filteredOutByAvailability: 0,
        filteredOutByAvailabilityErrors: 0,
        filteredOutByCapacity: 0,
        filteredOutByCalendarPrice: 0,
        hasDateFilter: false,
      },
      pricingAttached: false,
    }
  }

  const softAvailability = plan.availability?.softAvailability !== false
  const filters = {
    checkIn: plan.availability.checkIn,
    checkOut: plan.availability.checkOut,
    guests: plan.availability.guestsCount ?? 1,
    softAvailability,
  }

  const availabilityResult = await runDiscoveryAvailabilityFilter(inputRows, filters, {
    allowSoftMismatch: softAvailability,
  })

  let rows = availabilityResult.availableListings
  let filteredOutByCalendarPrice = 0

  if (discoveryPlanHasCalendarPriceStep(plan)) {
    const before = rows.length
    rows = rows.filter((listing) =>
      listingMatchesSearchPriceRange(listing, plan.price.minThb, plan.price.maxThb),
    )
    filteredOutByCalendarPrice = Math.max(0, before - rows.length)
  }

  return {
    rows,
    stats: {
      filteredOutByAvailability: availabilityResult.filteredOutByAvailability,
      filteredOutByAvailabilityErrors: availabilityResult.filteredOutByAvailabilityErrors,
      filteredOutByCapacity: availabilityResult.filteredOutByCapacity,
      filteredOutByCalendarPrice,
      hasDateFilter: availabilityResult.hasDateFilter,
    },
    pricingAttached: true,
  }
}
