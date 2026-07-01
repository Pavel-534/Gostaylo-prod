/**
 * Stage 177.3 E3 — transport/yacht SQL predicate chain + parity integration tests.
 * Run: npm run test:discovery-transport
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

describe('discovery transport executor SQL (Stage 177.3 E3)', () => {
  let parseDiscoveryFiltersFromSearchParams
  let buildDiscoveryQueryPlan
  let diffDiscoveryPlansForSurfaces
  let applyDiscoveryScalarFiltersFromPlan
  let buildDiscoveryJsonbNumericGtePredicate
  let contractNeedsDiscoveryFetchHeadroom

  const prevFlag = process.env.DISCOVERY_UNIFIED_PIPELINE

  before(async () => {
    process.env.DISCOVERY_UNIFIED_PIPELINE = '1'
    ;({ parseDiscoveryFiltersFromSearchParams } = await import(
      '../lib/search/discovery-filter-contract.js'
    ))
    ;({
      buildDiscoveryQueryPlan,
      diffDiscoveryPlansForSurfaces,
      contractNeedsDiscoveryFetchHeadroom,
    } = await import('../lib/search/discovery-query-plan.js'))
    ;({ applyDiscoveryScalarFiltersFromPlan } = await import(
      '../lib/api/search/discovery-scalar-sql.js'
    ))
    ;({ buildDiscoveryJsonbNumericGtePredicate } = await import(
      '../lib/search/discovery-jsonb-numeric-filter.js'
    ))
  })

  after(() => {
    if (prevFlag === undefined) {
      delete process.env.DISCOVERY_UNIFIED_PIPELINE
    } else {
      process.env.DISCOVERY_UNIFIED_PIPELINE = prevFlag
    }
  })

  it('T3.8 — buildDiscoveryJsonbNumericGtePredicate structure', () => {
    const pred = buildDiscoveryJsonbNumericGtePredicate('engine_cc', 1500)
    assert.deepEqual(pred, {
      op: 'jsonb_numeric_gte',
      path: 'engine_cc',
      value: 1500,
    })
  })

  it('vehicles + transmission + fuel + engine_cc builds jsonb predicates', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams(
        'category=vehicles&transmission=automatic&fuel_type=diesel&engine_cc_min=1500',
      ),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)

    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })

    assert.deepEqual(plan.registryFiltersApplied, [
      'category',
      'transport.transmission',
      'transport.fuel_type',
      'transport.engine_cc_min',
    ])
    assert.equal(plan.sql.transmission, 'automatic')
    assert.equal(plan.sql.fuelType, 'diesel')
    assert.equal(plan.sql.engineCcMin, 1500)
    assert.equal(plan.sql.jsonbPredicates.length, 3)
    assert.ok(
      plan.sql.jsonbPredicates.some(
        (p) => p.op === 'text_eq_ci' && p.path === 'transmission' && p.value === 'automatic',
      ),
    )
    assert.ok(
      plan.sql.jsonbPredicates.some(
        (p) => p.op === 'jsonb_numeric_gte' && p.path === 'engine_cc' && p.value === 1500,
      ),
    )
  })

  it('applyDiscoveryScalarFiltersFromPlan chains transport PostgREST filters', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams(
        'category=vehicles&transmission=manual&fuel_type=petrol&engine_cc_min=800',
      ),
      { surface: 'catalog' },
    )
    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })

    const q = createMockQuery()
    applyDiscoveryScalarFiltersFromPlan(q, plan)

    assert.deepEqual(q.getCalls(), [
      ['filter', 'metadata->>transmission', 'ilike', 'manual'],
      ['filter', 'metadata->>fuel_type', 'ilike', 'petrol'],
      ['filter', 'metadata->>engine_cc::numeric', 'gte', 800],
    ])
  })

  it('UX-4 — catamaran + captain combo builds vessel text + crew @> predicates', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams(
        'category=yachts&vessel_type=catamaran&with_captain=1&cabins_min=3',
      ),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)

    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })

    assert.deepEqual(plan.registryFiltersApplied, [
      'category',
      'yacht.with_captain',
      'yacht.vessel_type',
      'yacht.cabins_min',
    ])
    assert.equal(plan.sql.vesselType, 'catamaran')
    assert.equal(plan.sql.withCaptain, true)
    assert.equal(plan.sql.cabinsMin, 3)

    const q = createMockQuery()
    applyDiscoveryScalarFiltersFromPlan(q, plan)

    assert.deepEqual(q.getCalls(), [
      ['contains', 'metadata', { crew_included: true }],
      ['filter', 'metadata->>subcategory', 'ilike', 'catamaran'],
      ['filter', 'metadata->>cabins::numeric', 'gte', 3],
    ])
  })

  it('catalog and map plans stay identical for transport + yacht fixture', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams(
        'category=yachts&vessel_type=catamaran&with_captain=1&cabins_min=2',
      ),
      { surface: 'catalog' },
    )
    const contract = {
      ...parsed.value,
      categoryIds: ['cat_yachts_test'],
    }
    const { diff } = await diffDiscoveryPlansForSurfaces(contract)
    assert.equal(diff, null)
  })

  it('vehicles vertical activates fetch headroom without cursor', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=vehicles&transmission=automatic'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(contractNeedsDiscoveryFetchHeadroom(parsed.value), true)

    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.equal(plan.sql.paginationMode, 'fetch_limit')
    assert.ok(plan.sql.fetchLimit >= 100)
  })

  it('transmission without category does not trigger vertical headroom alone', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('transmission=automatic'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(contractNeedsDiscoveryFetchHeadroom(parsed.value), false)
  })

  it('E4 — metadataFiltersForJsPostFilter skips transport keys when plan has SQL facets', async () => {
    const { metadataFiltersForJsPostFilter, discoveryPlanHasMetadataFacetStep } = await import(
      '../lib/search/discovery-metadata-facet-page.js'
    )
    const { buildMetadataFiltersFromSearchParams } = await import(
      '../lib/search/listing-metadata-filter.js'
    )
    const sp = new URLSearchParams('category=vehicles&transmission=automatic')
    const parsed = await parseDiscoveryFiltersFromSearchParams(sp, { surface: 'catalog' })
    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    const metadataFilters = buildMetadataFiltersFromSearchParams(sp)

    assert.equal(discoveryPlanHasMetadataFacetStep(plan), true)
    assert.equal(metadataFiltersForJsPostFilter(metadataFilters, plan, true), null)
  })
})
