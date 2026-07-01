/**
 * Stage 177.2c E2 — discovery calendar executor (availability + cursor refill).
 * Run: npm run test:discovery-calendar
 */

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')

/**
 * @typedef {(
 *   listings: object[],
 *   filters: object,
 *   options?: object,
 * ) => Promise<{
 *   availableListings: object[],
 *   filteredOutByAvailability: number,
 *   filteredOutByAvailabilityErrors: number,
 *   filteredOutByCapacity: number,
 *   hasDateFilter: boolean,
 * }>} AvailabilityFilterMock
 */

/** @type {AvailabilityFilterMock} */
let availabilityFilterImpl = async (listings) => ({
  availableListings: listings,
  filteredOutByAvailability: 0,
  filteredOutByAvailabilityErrors: 0,
  filteredOutByCapacity: 0,
  hasDateFilter: true,
})

/**
 * @param {string} id
 * @param {Record<string, unknown>} [opts]
 */
function listing(id, opts = {}) {
  return {
    id,
    created_at: opts.created_at ?? '2026-06-22T10:00:00.000Z',
    base_price_thb: opts.base_price_thb ?? 5000,
    max_capacity: opts.max_capacity ?? 4,
    categories: opts.categories ?? { slug: 'stays' },
    ...opts,
  }
}

/**
 * @param {Record<string, unknown>} [overrides]
 */
function calendarPlan(overrides = {}) {
  return {
    postSteps: ['availability'],
    availability: {
      engine: 'batch_rpc',
      rpc: 'batch_check_listing_availability',
      checkIn: '2026-07-01',
      checkOut: '2026-07-05',
      guestsCount: 1,
      softAvailability: true,
    },
    price: { mode: 'sql', minThb: null, maxThb: null },
    sql: { paginationMode: 'fetch_limit', pageSize: 24 },
    ...overrides,
  }
}

describe('discovery calendar executor (Stage 177.2c E2)', () => {
  let applyDiscoveryAvailabilityToPage
  let discoveryCursorRefillIfSparse
  let buildDiscoveryCursorFromListingRow
  let decodeDiscoveryCursor
  let parseDiscoveryFiltersFromSearchParams
  let buildDiscoveryQueryPlan

  let __setDiscoveryAvailabilityFilterForTests
  let __resetDiscoveryAvailabilityFilterForTests

  const prevFlag = process.env.DISCOVERY_UNIFIED_PIPELINE

  before(async () => {
    process.env.DISCOVERY_UNIFIED_PIPELINE = '1'

    ;({
      applyDiscoveryAvailabilityToPage,
      __setDiscoveryAvailabilityFilterForTests,
      __resetDiscoveryAvailabilityFilterForTests,
    } = await import('../lib/search/discovery-availability-page.js'))

    __setDiscoveryAvailabilityFilterForTests((listings, filters, options) =>
      availabilityFilterImpl(listings, filters, options),
    )
    ;({ discoveryCursorRefillIfSparse } = await import(
      '../lib/search/discovery-cursor-refill.js'
    ))
    ;({ buildDiscoveryCursorFromListingRow } = await import(
      '../lib/search/discovery-cursor-page.js'
    ))
    ;({ decodeDiscoveryCursor } = await import('../lib/search/discovery-cursor-codec.js'))
    ;({ parseDiscoveryFiltersFromSearchParams } = await import(
      '../lib/search/discovery-filter-contract.js'
    ))
    ;({ buildDiscoveryQueryPlan } = await import('../lib/search/discovery-query-plan.js'))
  })

  after(() => {
    __resetDiscoveryAvailabilityFilterForTests?.()
    if (prevFlag === undefined) {
      delete process.env.DISCOVERY_UNIFIED_PIPELINE
    } else {
      process.env.DISCOVERY_UNIFIED_PIPELINE = prevFlag
    }
    availabilityFilterImpl = async (listings) => ({
      availableListings: listings,
      filteredOutByAvailability: 0,
      filteredOutByAvailabilityErrors: 0,
      filteredOutByCapacity: 0,
      hasDateFilter: true,
    })
  })

  it('A1 — all listings available attach _pricing', async () => {
    const rows = [listing('lst-a1'), listing('lst-a2')]
    availabilityFilterImpl = async (listings) => ({
      availableListings: listings.map((l) => ({
        ...l,
        _pricing: { averagePerNight: 3000, totalPrice: 12000 },
      })),
      filteredOutByAvailability: 0,
      filteredOutByAvailabilityErrors: 0,
      filteredOutByCapacity: 0,
      hasDateFilter: true,
    })

    const { rows: out, stats, pricingAttached } = await applyDiscoveryAvailabilityToPage(
      rows,
      calendarPlan(),
    )

    assert.equal(out.length, 2)
    assert.equal(pricingAttached, true)
    assert.equal(stats.hasDateFilter, true)
    assert.ok(out.every((l) => l._pricing?.averagePerNight > 0))
  })

  it('A2 — fully booked returns zero available rows', async () => {
    availabilityFilterImpl = async () => ({
      availableListings: [],
      filteredOutByAvailability: 1,
      filteredOutByAvailabilityErrors: 0,
      filteredOutByCapacity: 0,
      hasDateFilter: true,
    })

    const { rows, stats } = await applyDiscoveryAvailabilityToPage(
      [listing('lst-booked')],
      calendarPlan({ availability: { ...calendarPlan().availability, softAvailability: false } }),
    )

    assert.equal(rows.length, 0)
    assert.equal(stats.filteredOutByAvailability, 1)
  })

  it('A3 — partial availability keeps only free ids', async () => {
    availabilityFilterImpl = async () => ({
      availableListings: [listing('lst-free')],
      filteredOutByAvailability: 1,
      filteredOutByAvailabilityErrors: 0,
      filteredOutByCapacity: 0,
      hasDateFilter: true,
    })

    const { rows } = await applyDiscoveryAvailabilityToPage(
      [listing('lst-free'), listing('lst-busy')],
      calendarPlan(),
    )
    assert.deepEqual(rows.map((l) => l.id), ['lst-free'])
  })

  it('A4 — calendar min_price filters on _pricing guest display', async () => {
    availabilityFilterImpl = async () => ({
      availableListings: [
        listing('lst-cheap', { _pricing: { averagePerNight: 800 } }),
        listing('lst-pricey', { _pricing: { averagePerNight: 8000 } }),
      ],
      filteredOutByAvailability: 0,
      filteredOutByAvailabilityErrors: 0,
      filteredOutByCapacity: 0,
      hasDateFilter: true,
    })

    const plan = calendarPlan({
      postSteps: ['availability', 'calendar_price'],
      price: { mode: 'calendar', minThb: 2000, maxThb: null },
    })

    const { rows, stats } = await applyDiscoveryAvailabilityToPage(
      [listing('lst-cheap'), listing('lst-pricey')],
      plan,
    )

    assert.deepEqual(rows.map((l) => l.id), ['lst-pricey'])
    assert.equal(stats.filteredOutByCalendarPrice, 1)
  })

  it('A5 — guests above max_capacity filtered before availability delegate', async () => {
    availabilityFilterImpl = async () => ({
      availableListings: [],
      filteredOutByAvailability: 0,
      filteredOutByAvailabilityErrors: 0,
      filteredOutByCapacity: 1,
      hasDateFilter: true,
    })

    const plan = calendarPlan({
      availability: { ...calendarPlan().availability, guestsCount: 10 },
    })

    const { rows, stats } = await applyDiscoveryAvailabilityToPage(
      [listing('lst-small', { max_capacity: 4 })],
      plan,
    )

    assert.equal(rows.length, 0)
    assert.equal(stats.filteredOutByCapacity, 1)
  })

  it('A6 — softAvailability re-injects mismatch when fewer than 3 results', async () => {
    availabilityFilterImpl = async () => ({
      availableListings: [listing('lst-busy', { _isAvailabilityMismatch: true })],
      filteredOutByAvailability: 0,
      filteredOutByAvailabilityErrors: 0,
      filteredOutByCapacity: 0,
      hasDateFilter: true,
    })

    const { rows } = await applyDiscoveryAvailabilityToPage([listing('lst-busy')], calendarPlan())

    assert.equal(rows.length, 1)
    assert.equal(rows[0]._isAvailabilityMismatch, true)
  })

  it('A7 — RPC failure fail-open tags mismatch cards', async () => {
    availabilityFilterImpl = async (listings) => ({
      availableListings: listings.map((l) => ({ ...l, _isAvailabilityMismatch: true })),
      filteredOutByAvailability: 0,
      filteredOutByAvailabilityErrors: listings.length,
      filteredOutByCapacity: 0,
      hasDateFilter: true,
    })

    const { rows, stats } = await applyDiscoveryAvailabilityToPage(
      [listing('lst-fail-1'), listing('lst-fail-2')],
      calendarPlan(),
    )

    assert.equal(rows.length, 2)
    assert.ok(rows.every((l) => l._isAvailabilityMismatch))
    assert.equal(stats.filteredOutByAvailabilityErrors, 2)
  })

  it('A8 — catalog and map plans share availability post-steps for dates', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('checkIn=2026-07-01&checkOut=2026-07-05&min_price=2000'),
      { surface: 'catalog' },
    )
    const catalogPlan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    const mapPlan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'map' })

    assert.deepEqual(catalogPlan.postSteps, mapPlan.postSteps)
    assert.deepEqual(catalogPlan.availability, mapPlan.availability)
    assert.equal(catalogPlan.price.mode, 'calendar')
    assert.equal(mapPlan.price.mode, 'calendar')
  })

  it('C1 — cursor page rows all pass availability filter', async () => {
    const pageRows = Array.from({ length: 24 }, (_, i) =>
      listing(`lst-c1-${i}`, { created_at: `2026-06-22T10:${String(i).padStart(2, '0')}:00.000Z` }),
    )
    availabilityFilterImpl = async (listings) => ({
      availableListings: listings.map((l) => ({
        ...l,
        _pricing: { averagePerNight: 3000 },
      })),
      filteredOutByAvailability: 0,
      filteredOutByAvailabilityErrors: 0,
      filteredOutByCapacity: 0,
      hasDateFilter: true,
    })

    const { rows } = await applyDiscoveryAvailabilityToPage(
      pageRows,
      calendarPlan({ sql: { paginationMode: 'cursor', pageSize: 24 } }),
    )
    assert.equal(rows.length, 24)
    assert.ok(rows.every((l) => l._pricing))
  })

  it('C2 — sparse first page triggers refill until pageSize', async () => {
    availabilityFilterImpl = async (listings) => ({
      availableListings: listings.filter((l) => String(l.id).includes('free')),
      filteredOutByAvailability: listings.length,
      filteredOutByAvailabilityErrors: 0,
      filteredOutByCapacity: 0,
      hasDateFilter: true,
    })

    const plan = calendarPlan({
      sql: { paginationMode: 'cursor', pageSize: 4 },
    })

    const firstBatch = [
      listing('lst-busy-1'),
      listing('lst-busy-2'),
      listing('lst-free-3'),
      listing('lst-free-4'),
    ]

    let fetchCount = 0
    const refill = await discoveryCursorRefillIfSparse(
      [listing('lst-free-3')],
      firstBatch,
      plan,
      async () => {
        fetchCount += 1
        if (fetchCount === 1) {
          return {
            data: [
              listing('lst-free-5', { created_at: '2026-06-22T09:05:00.000Z' }),
              listing('lst-free-6', { created_at: '2026-06-22T09:04:00.000Z' }),
              listing('lst-busy-7', { created_at: '2026-06-22T09:03:00.000Z' }),
              listing('lst-free-8', { created_at: '2026-06-22T09:02:00.000Z' }),
              listing('lst-free-9', { created_at: '2026-06-22T09:01:00.000Z' }),
            ],
          }
        }
        return { data: [] }
      },
      { sqlHasMore: true, sqlNextCursor: 'cursor-page-2', pageSize: 4, maxRefill: 5 },
    )

    assert.equal(refill.acceptedRows.length, 4)
    assert.ok(refill.acceptedRows.every((l) => String(l.id).includes('free')))
    assert.equal(fetchCount, 1)
    assert.equal(refill.refillAttempts, 1)
    assert.equal(refill.hasMore, true)
  })

  it('C3 — next_cursor built from last accepted row not last probed SQL row', async () => {
    const accepted = Array.from({ length: 24 }, (_, i) =>
      listing(`lst-accepted-${i}`, {
        created_at: `2026-06-22T10:${String(i).padStart(2, '0')}:00.000Z`,
      }),
    )
    const cursor = buildDiscoveryCursorFromListingRow(accepted[23])
    assert.ok(cursor)

    const decoded = decodeDiscoveryCursor(cursor)
    assert.equal(decoded.ok, true)
    assert.equal(decoded.value.lastId, 'lst-accepted-23')

    const refill = await discoveryCursorRefillIfSparse(
      accepted,
      [],
      calendarPlan({ sql: { paginationMode: 'cursor', pageSize: 24 } }),
      async () => ({ data: [] }),
      {
        sqlHasMore: true,
        sqlNextCursor: 'sql-probed-cursor',
        pageSize: 24,
      },
    )

    assert.equal(refill.nextCursor, cursor)
    assert.notEqual(refill.nextCursor, 'sql-probed-cursor')
  })
})
