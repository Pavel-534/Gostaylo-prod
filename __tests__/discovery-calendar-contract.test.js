/**
 * Stage 177.2c E1 — discovery calendar registry & query plan (contract matrix).
 * Run: npm run test:discovery-calendar
 */

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')

describe('discovery calendar contract (Stage 177.2c E1)', () => {
  let parseDiscoveryFiltersFromSearchParams
  let buildDiscoveryQueryPlan
  let computeDiscoveryPostSteps
  let discoveryPlanParitySnapshot
  let diffDiscoveryPlansForSurfaces
  let ORDERED_FILTER_KEYS
  let listActiveRegistryFilterKeys

  const prevFlag = process.env.DISCOVERY_UNIFIED_PIPELINE

  before(async () => {
    process.env.DISCOVERY_UNIFIED_PIPELINE = '1'
    ;({ parseDiscoveryFiltersFromSearchParams } = await import(
      '../lib/search/discovery-filter-contract.js'
    ))
    ;({
      buildDiscoveryQueryPlan,
      computeDiscoveryPostSteps,
      discoveryPlanParitySnapshot,
      diffDiscoveryPlansForSurfaces,
    } = await import('../lib/search/discovery-query-plan.js'))
    ;({ ORDERED_FILTER_KEYS, listActiveRegistryFilterKeys } = await import(
      '../lib/search/filter-registry.js'
    ))
  })

  after(() => {
    if (prevFlag === undefined) {
      delete process.env.DISCOVERY_UNIFIED_PIPELINE
    } else {
      process.env.DISCOVERY_UNIFIED_PIPELINE = prevFlag
    }
  })

  it('T2c.3 — ORDERED_FILTER_KEYS places stay.dates after geo.bbox and before price.range', () => {
    const idxDates = ORDERED_FILTER_KEYS.indexOf('stay.dates')
    const idxBbox = ORDERED_FILTER_KEYS.indexOf('geo.bbox')
    const idxPrice = ORDERED_FILTER_KEYS.indexOf('price.range')
    assert.ok(idxDates > idxBbox)
    assert.ok(idxDates < idxPrice)
  })

  it('T2c.1 — valid dates fill plan.availability (batch_rpc)', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('checkIn=2026-07-01&checkOut=2026-07-05'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.ok(listActiveRegistryFilterKeys(parsed.value).includes('stay.dates'))

    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.ok(plan.registryFiltersApplied.includes('stay.dates'))
    assert.deepEqual(plan.availability, {
      engine: 'batch_rpc',
      rpc: 'batch_check_listing_availability',
      checkIn: '2026-07-01',
      checkOut: '2026-07-05',
      guestsCount: 1,
      softAvailability: true,
    })
    assert.equal(plan.price.mode, 'calendar')
    assert.equal(plan.sql.skipPriceBecauseCalendar, true)
  })

  it('T2c.1 — guestsCount uses contract.stay.guests (minimum 1)', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('checkIn=2026-07-01&checkOut=2026-07-05&guests=4'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.equal(plan.availability.guestsCount, 4)
    assert.ok(plan.registryFiltersApplied.includes('stay.guests'))
  })

  it('T2c.1 — softAvailability=0 disables soft fallback', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('checkIn=2026-07-01&checkOut=2026-07-05&softAvailability=0'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.equal(plan.availability.softAvailability, false)
  })

  it('T2c.2 / A4 — dates + min_price: calendar mode, no SQL base_price_thb scalars', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('checkIn=2026-07-01&checkOut=2026-07-05&min_price=1000&max_price=5000'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)

    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.equal(plan.price.mode, 'calendar')
    assert.equal(plan.price.minThb, 1000)
    assert.equal(plan.price.maxThb, 5000)
    assert.equal(plan.sql.skipPriceBecauseCalendar, true)
    assert.ok(plan.registryFiltersApplied.includes('stay.dates'))
    assert.ok(plan.registryFiltersApplied.includes('price.range'))
    assert.equal(plan.sql.priceMinThb, null)
    assert.equal(plan.sql.priceMaxThb, null)
    assert.ok(
      !plan.sql.scalarPredicates.some((p) => p.column === 'base_price_thb'),
      'calendar mode must not emit base_price_thb SQL predicates',
    )
  })

  it('T2c.2 — browse without dates keeps sql price mode and scalar predicates', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('min_price=3000&max_price=15000'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)

    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.equal(plan.price.mode, 'sql')
    assert.equal(plan.availability.engine, 'none')
    assert.deepEqual(plan.sql.scalarPredicates, [
      { column: 'base_price_thb', op: 'gte', value: 3000 },
      { column: 'base_price_thb', op: 'lte', value: 15000 },
    ])
  })

  it('T2c.4 — computeDiscoveryPostSteps adds availability and calendar_price', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('checkIn=2026-07-01&checkOut=2026-07-05&min_price=2000'),
      { surface: 'catalog' },
    )
    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.deepEqual(plan.postSteps, ['availability', 'calendar_price'])
    assert.deepEqual(computeDiscoveryPostSteps(plan), ['availability', 'calendar_price'])
  })

  it('T2c.4 — dates without price limits → availability only postStep', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('checkIn=2026-07-01&checkOut=2026-07-05'),
      { surface: 'catalog' },
    )
    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.deepEqual(plan.postSteps, ['availability'])
  })

  it('T2c.5 — parity snapshot includes availability, price.mode, postSteps', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams(
        'checkIn=2026-07-01&checkOut=2026-07-05&min_price=1000&south=7.7&north=8.2&west=98.2&east=98.5',
      ),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)

    const { diff } = await diffDiscoveryPlansForSurfaces(parsed.value)
    assert.equal(diff, null)

    const catalogPlan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    const snap = JSON.parse(discoveryPlanParitySnapshot(catalogPlan))
    assert.equal(snap.availability.engine, 'batch_rpc')
    assert.equal(snap.availability.rpc, 'batch_check_listing_availability')
    assert.equal(snap.price.mode, 'calendar')
    assert.equal(snap.price.minThb, 1000)
    assert.deepEqual(snap.postSteps, ['availability', 'calendar_price'])
    assert.equal(snap.skipPriceBecauseCalendar, true)
  })

  it('invalid date range does not activate stay.dates', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('checkIn=2026-07-05&checkOut=2026-07-01'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.ok(!listActiveRegistryFilterKeys(parsed.value).includes('stay.dates'))

    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.equal(plan.availability.engine, 'none')
    assert.equal(plan.price.mode, 'sql')
    assert.deepEqual(plan.postSteps, [])
  })
})
