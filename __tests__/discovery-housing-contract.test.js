/**
 * Stage 177.2b — discovery housing contract parse & validation matrix (C1–C8).
 * Run: npm run test:discovery-housing
 */

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')

describe('discovery housing contract (Stage 177.2b)', () => {
  let parseDiscoveryFiltersFromSearchParams
  let buildDiscoveryQueryPlan
  let listActiveRegistryFilterKeys

  const prevFlag = process.env.DISCOVERY_UNIFIED_PIPELINE

  before(async () => {
    process.env.DISCOVERY_UNIFIED_PIPELINE = '1'
    ;({ parseDiscoveryFiltersFromSearchParams } = await import(
      '../lib/search/discovery-filter-contract.js'
    ))
    ;({ buildDiscoveryQueryPlan } = await import('../lib/search/discovery-query-plan.js'))
    ;({ listActiveRegistryFilterKeys } = await import('../lib/search/filter-registry.js'))
  })

  after(() => {
    if (prevFlag === undefined) {
      delete process.env.DISCOVERY_UNIFIED_PIPELINE
    } else {
      process.env.DISCOVERY_UNIFIED_PIPELINE = prevFlag
    }
  })

  it('C1 — bedrooms=2 parses active filter', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(new URLSearchParams('bedrooms=2'), {
      surface: 'catalog',
    })
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.housing.bedroomsMin, 2)
    assert.ok(listActiveRegistryFilterKeys(parsed.value).includes('housing.bedrooms'))
  })

  it('C2 — bedrooms=0 is inactive (ok)', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(new URLSearchParams('bedrooms=0'), {
      surface: 'catalog',
    })
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.housing.bedroomsMin, null)
    assert.ok(!listActiveRegistryFilterKeys(parsed.value).includes('housing.bedrooms'))
  })

  it('C3 — min_price > max_price → PRICE_RANGE_INVALID', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('min_price=5000&max_price=1000'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, false)
    assert.ok(parsed.issues.some((i) => i.code === 'PRICE_RANGE_INVALID'))
  })

  it('C4 — guests=8 parses stay.guests', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(new URLSearchParams('guests=8'), {
      surface: 'catalog',
    })
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.stay.guests, 8)
    assert.ok(listActiveRegistryFilterKeys(parsed.value).includes('stay.guests'))
  })

  it('C5 — guests=0 → GUESTS_INVALID', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(new URLSearchParams('guests=0'), {
      surface: 'catalog',
    })
    assert.equal(parsed.ok, false)
    assert.ok(parsed.issues.some((i) => i.code === 'GUESTS_INVALID'))
  })

  it('C6 — property_type=villa parses housing.propertyType', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('property_type=villa'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.housing.propertyType, 'villa')
    assert.ok(listActiveRegistryFilterKeys(parsed.value).includes('housing.property_type'))
  })

  it('C7 — vehicles category ignores housing.bedrooms registry', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=vehicles&bedrooms=2'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.housing.bedroomsMin, 2)
    assert.equal(parsed.value.categorySlug, 'vehicles')
    assert.ok(!listActiveRegistryFilterKeys(parsed.value).includes('housing.bedrooms'))
  })

  it('C8 — dates + min_price sets skipPriceBecauseCalendar on plan', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('checkIn=2026-07-01&checkOut=2026-07-05&min_price=1000'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.price.minThb, 1000)
    assert.equal(parsed.value.stay.checkIn, '2026-07-01')
    assert.equal(parsed.value.stay.checkOut, '2026-07-05')

    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.equal(plan.sql.skipPriceBecauseCalendar, true)
    assert.ok(!plan.registryFiltersApplied.includes('price.range'))
  })

  it('price.range applyPlan fills scalar predicates when no dates', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('min_price=3000&max_price=15000'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.ok(plan.registryFiltersApplied.includes('price.range'))
    assert.equal(plan.sql.priceMinThb, 3000)
    assert.equal(plan.sql.priceMaxThb, 15000)
    assert.deepEqual(plan.sql.scalarPredicates, [
      { column: 'base_price_thb', op: 'gte', value: 3000 },
      { column: 'base_price_thb', op: 'lte', value: 15000 },
    ])
  })

  it('housing.property_type applyPlan adds text_eq_ci jsonb predicate', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('property_type=villa'),
      { surface: 'catalog' },
    )
    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.ok(
      plan.sql.jsonbPredicates.some(
        (p) => p.op === 'text_eq_ci' && p.path === 'property_type' && p.value === 'villa',
      ),
    )
  })
})
