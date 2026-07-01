/**
 * Stage 177.2b E3 — discovery housing executor / SQL chain unit tests.
 * Run: npm run test:discovery-housing
 */

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')

function createMockQuery() {
  /** @type {Array<[string, ...unknown[]]>} */
  const calls = []
  const chain = {
    gte(column, value) {
      calls.push(['gte', column, value])
      return chain
    },
    lte(column, value) {
      calls.push(['lte', column, value])
      return chain
    },
    eq(column, value) {
      calls.push(['eq', column, value])
      return chain
    },
    in(column, values) {
      calls.push(['in', column, values])
      return chain
    },
    contains(column, value) {
      calls.push(['contains', column, value])
      return chain
    },
    filter(column, op, value) {
      calls.push(['filter', column, op, value])
      return chain
    },
    getCalls() {
      return calls
    },
  }
  return chain
}

describe('discovery housing executor SQL (Stage 177.2b E3)', () => {
  let parseDiscoveryFiltersFromSearchParams
  let buildDiscoveryQueryPlan
  let diffDiscoveryPlansForSurfaces
  let applyDiscoveryScalarFiltersFromPlan
  let legacyFiltersForUnifiedDiscoveryPlan
  let buildListingsQuery

  const prevFlag = process.env.DISCOVERY_UNIFIED_PIPELINE

  before(async () => {
    process.env.DISCOVERY_UNIFIED_PIPELINE = '1'
    ;({ parseDiscoveryFiltersFromSearchParams } = await import(
      '../lib/search/discovery-filter-contract.js'
    ))
    ;({ buildDiscoveryQueryPlan, diffDiscoveryPlansForSurfaces } = await import(
      '../lib/search/discovery-query-plan.js'
    ))
    ;({
      applyDiscoveryScalarFiltersFromPlan,
      legacyFiltersForUnifiedDiscoveryPlan,
    } = await import('../lib/api/search/discovery-scalar-sql.js'))
    ;({ buildListingsQuery } = await import('../lib/api/search/query-builder.js'))
  })

  after(() => {
    if (prevFlag === undefined) {
      delete process.env.DISCOVERY_UNIFIED_PIPELINE
    } else {
      process.env.DISCOVERY_UNIFIED_PIPELINE = prevFlag
    }
  })

  it('E3 — combined bbox + price + bedrooms + amenities builds plan predicates', async () => {
    const qs =
      'category=property&south=7.7&north=8.2&west=98.2&east=98.5&min_price=5000&max_price=20000&bedrooms=2&amenities=wifi,pool'
    const parsed = await parseDiscoveryFiltersFromSearchParams(new URLSearchParams(qs), {
      surface: 'catalog',
    })
    assert.equal(parsed.ok, true)

    const contract = {
      ...parsed.value,
      categoryIds: ['cat_housing_test'],
    }
    const plan = await buildDiscoveryQueryPlan(contract, { surface: 'catalog' })

    assert.deepEqual(plan.registryFiltersApplied, [
      'category',
      'geo.bbox',
      'price.range',
      'housing.bedrooms',
      'housing.amenities',
    ])
    assert.deepEqual(plan.sql.scalarPredicates, [
      { column: 'base_price_thb', op: 'gte', value: 5000 },
      { column: 'base_price_thb', op: 'lte', value: 20000 },
      { column: 'bedrooms_count', op: 'gte', value: 2 },
    ])
    assert.ok(
      plan.sql.jsonbPredicates.some(
        (p) => p.op === '@>' && p.path === 'amenities' && p.value.includes('wifi'),
      ),
    )
  })

  it('E3 — applyDiscoveryScalarFiltersFromPlan chains PostgREST filters', async () => {
    const qs =
      'min_price=5000&max_price=20000&bedrooms=2&bathrooms=1&guests=4&instant_booking=1&property_type=villa&amenities=pool'
    const parsed = await parseDiscoveryFiltersFromSearchParams(new URLSearchParams(qs), {
      surface: 'catalog',
    })
    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })

    const q = createMockQuery()
    applyDiscoveryScalarFiltersFromPlan(q, plan)

    assert.deepEqual(q.getCalls(), [
      ['gte', 'base_price_thb', 5000],
      ['lte', 'base_price_thb', 20000],
      ['gte', 'bedrooms_count', 2],
      ['gte', 'bathrooms_count', 1],
      ['gte', 'max_capacity', 4],
      ['eq', 'instant_booking', true],
      ['filter', 'metadata->>property_type', 'ilike', 'villa'],
      ['contains', 'metadata', { amenities: ['pool'] }],
    ])
  })

  it('E3 — legacyFiltersForUnifiedDiscoveryPlan strips duplicated housing facets', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('bedrooms=2&min_price=1000&amenities=wifi'),
      { surface: 'catalog' },
    )
    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    const stripped = legacyFiltersForUnifiedDiscoveryPlan(
      {
        minPrice: 1000,
        maxPrice: 50000,
        bedroomsMin: 2,
        bathroomsMin: 3,
        instantBookingOnly: true,
        amenities: ['wifi'],
        where: 'phuket',
      },
      plan,
    )

    assert.equal(stripped.minPrice, null)
    assert.equal(stripped.maxPrice, null)
    assert.equal(stripped.bedroomsMin, null)
    assert.equal(stripped.bathroomsMin, null)
    assert.equal(stripped.instantBookingOnly, false)
    assert.deepEqual(stripped.amenities, [])
    assert.equal(stripped.where, 'phuket')
  })

  it('E3 — buildListingsQuery with discoveryPlan skips legacy scalar filters', async () => {
    const scalarCalls = []
    const mockChain = {
      eq() {
        return mockChain
      },
      order() {
        return mockChain
      },
      limit() {
        return mockChain
      },
      gte(column, value) {
        scalarCalls.push(['gte', column, value])
        return mockChain
      },
      lte(column, value) {
        scalarCalls.push(['lte', column, value])
        return mockChain
      },
      contains(column, value) {
        scalarCalls.push(['contains', column, value])
        return mockChain
      },
    }
    const mockAdmin = {
      from() {
        return {
          select() {
            return mockChain
          },
        }
      },
    }

    const plan = {
      sql: {
        scalarPredicates: [{ column: 'bedrooms_count', op: 'gte', value: 2 }],
        jsonbPredicates: [],
        amenities: [],
      },
    }

    const { query: builtQuery } = await buildListingsQuery({
      supabaseAdmin: mockAdmin,
      filters: {
        minPrice: 9999,
        maxPrice: 88888,
        bedroomsMin: 5,
        amenities: ['wifi'],
        featured: false,
      },
      fetchLimit: 50,
      textOrClause: null,
      categoryIds: null,
      bbox: null,
      centerBbox: null,
      discoveryPlan: plan,
    })
    await builtQuery

    assert.deepEqual(scalarCalls, [])
  })

  it('E3 — guests=1 plan applies max_capacity gte on unwrapped PostgREST builder', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('guests=1&limit=24'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.ok(plan.registryFiltersApplied.includes('stay.guests'))

    const mockChain = createMockQuery()
    const mockAdmin = {
      from() {
        return {
          select() {
            return mockChain
          },
        }
      },
    }

    const { query: builtQuery } = await buildListingsQuery({
      supabaseAdmin: mockAdmin,
      filters: { featured: false },
      fetchLimit: 24,
      textOrClause: null,
      categoryIds: null,
      bbox: null,
      centerBbox: null,
      discoveryPlan: plan,
      deferOrderAndLimit: true,
    })

    assert.equal(typeof builtQuery.gte, 'function')
    const chained = applyDiscoveryScalarFiltersFromPlan(builtQuery, plan)
    assert.ok(
      chained.getCalls().some((c) => c[0] === 'gte' && c[1] === 'max_capacity' && c[2] === 1),
    )
  })

  it('E3 — unified catalog clamps browse limit above 50 instead of rejecting', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('guests=1&limit=100'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.browse.limit, 50)
  })

  it('E3 — catalog and map plans stay identical for housing + bbox fixture', async () => {
    const qs =
      'category=property&south=7.7&north=8.2&west=98.2&east=98.5&min_price=3000&bedrooms=2&amenities=wifi'
    const parsed = await parseDiscoveryFiltersFromSearchParams(new URLSearchParams(qs), {
      surface: 'catalog',
    })
    const contract = {
      ...parsed.value,
      categoryIds: ['cat_parity_housing'],
    }
    const { diff } = await diffDiscoveryPlansForSurfaces(contract)
    assert.equal(diff, null)
  })
})
