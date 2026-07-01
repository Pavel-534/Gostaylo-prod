/**
 * Stage 177.4 E3 — service/nanny SQL predicate chain + plan snapshot parity.
 * Run: npm run test:discovery-service
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

describe('discovery service executor SQL (Stage 177.4 E3)', () => {
  let parseDiscoveryFiltersFromSearchParams
  let buildDiscoveryQueryPlan
  let diffDiscoveryPlansForSurfaces
  let applyDiscoveryScalarFiltersFromPlan
  let buildDiscoveryJsonbNumericGtePredicate
  let buildDiscoveryJsonbTextIlikeContainsPredicate
  let discoveryPlanParitySnapshot

  const prevFlag = process.env.DISCOVERY_UNIFIED_PIPELINE

  before(async () => {
    process.env.DISCOVERY_UNIFIED_PIPELINE = '1'
    ;({ parseDiscoveryFiltersFromSearchParams } = await import(
      '../lib/search/discovery-filter-contract.js'
    ))
    ;({
      buildDiscoveryQueryPlan,
      diffDiscoveryPlansForSurfaces,
      discoveryPlanParitySnapshot,
    } = await import('../lib/search/discovery-query-plan.js'))
    ;({ applyDiscoveryScalarFiltersFromPlan } = await import(
      '../lib/api/search/discovery-scalar-sql.js'
    ))
    ;({ buildDiscoveryJsonbNumericGtePredicate } = await import(
      '../lib/search/discovery-jsonb-numeric-filter.js'
    ))
    ;({ buildDiscoveryJsonbTextIlikeContainsPredicate } = await import(
      '../lib/api/search/discovery-jsonb-text-filter.js'
    ))
  })

  after(() => {
    if (prevFlag === undefined) {
      delete process.env.DISCOVERY_UNIFIED_PIPELINE
    } else {
      process.env.DISCOVERY_UNIFIED_PIPELINE = prevFlag
    }
  })

  it('T4.10 — buildDiscoveryJsonbNumericGtePredicate for experience_years', () => {
    const pred = buildDiscoveryJsonbNumericGtePredicate('experience_years', 5)
    assert.deepEqual(pred, {
      op: 'jsonb_numeric_gte',
      path: 'experience_years',
      value: 5,
    })
  })

  it('T4.9 — buildDiscoveryJsonbTextIlikeContainsPredicate strips ILIKE metacharacters', () => {
    const pred = buildDiscoveryJsonbTextIlikeContainsPredicate('specialization', '  infant%_care  ')
    assert.equal(pred.op, 'text_ilike_contains')
    assert.equal(pred.path, 'specialization')
    assert.equal(pred.value, 'infantcare')
  })

  it('nannies + langs + experience + specialization builds service jsonb predicates', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams(
        'category=nannies&nanny_langs=ru,en&nanny_experience_min=5&nanny_specialization=infants',
      ),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)

    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })

    assert.deepEqual(plan.registryFiltersApplied, [
      'category',
      'service.languages',
      'service.experience_min',
      'service.specialization',
    ])
    assert.deepEqual(plan.sql.serviceLanguages, ['en', 'ru'])
    assert.equal(plan.sql.serviceExperienceMin, 5)
    assert.equal(plan.sql.serviceSpecialization, 'infants')
    assert.equal(plan.sql.jsonbPredicates.length, 3)

    assert.ok(
      plan.sql.jsonbPredicates.some(
        (p) => p.op === '@>' && p.path === 'languages' && deepEqual(p.value, ['en', 'ru']),
      ),
    )
    assert.ok(
      plan.sql.jsonbPredicates.some(
        (p) =>
          p.op === 'jsonb_numeric_gte' && p.path === 'experience_years' && p.value === 5,
      ),
    )
    assert.ok(
      plan.sql.jsonbPredicates.some(
        (p) =>
          p.op === 'text_ilike_contains' &&
          p.path === 'specialization' &&
          p.value === 'infants',
      ),
    )
  })

  it('applyDiscoveryScalarFiltersFromPlan chains service PostgREST filters', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams(
        'category=nannies&nanny_langs=th&nanny_experience_min=3&nanny_specialization=baby',
      ),
      { surface: 'catalog' },
    )
    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })

    const q = createMockQuery()
    applyDiscoveryScalarFiltersFromPlan(q, plan)

    assert.deepEqual(q.getCalls(), [
      ['contains', 'metadata', { languages: ['th'] }],
      ['filter', 'metadata->>experience_years::numeric', 'gte', 3],
      ['filter', 'metadata->>specialization', 'ilike', '%baby%'],
    ])
  })

  it('services + service_home_visit builds @> home_visit predicate', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=services&service_home_visit=1'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)

    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })

    assert.deepEqual(plan.registryFiltersApplied, ['category', 'service.home_visit'])
    assert.equal(plan.sql.serviceHomeVisit, true)

    const q = createMockQuery()
    applyDiscoveryScalarFiltersFromPlan(q, plan)
    assert.deepEqual(q.getCalls(), [['contains', 'metadata', { home_visit: true }]])
  })

  it('discoveryPlanParitySnapshot includes service fields', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=nannies&nanny_langs=ru&nanny_experience_min=2'),
      { surface: 'catalog' },
    )
    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    const snap = JSON.parse(discoveryPlanParitySnapshot(plan))

    assert.deepEqual(snap.service.serviceLanguages, ['ru'])
    assert.equal(snap.service.serviceExperienceMin, 2)
    assert.equal(snap.service.serviceSpecialization, null)
    assert.equal(snap.service.serviceHomeVisit, false)
  })

  it('catalog and map plans stay identical for service fixture', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams(
        'category=nannies&nanny_langs=en,ru&nanny_experience_min=3&service_home_visit=1',
      ),
      { surface: 'catalog' },
    )
    const contract = {
      ...parsed.value,
      categoryIds: ['cat_nannies_test'],
    }
    const { diff } = await diffDiscoveryPlansForSurfaces(contract)
    assert.equal(diff, null)
  })

  it('E4 — metadataFiltersForJsPostFilter strips service keys when unified pipeline', async () => {
    const { metadataFiltersForJsPostFilter, discoveryPlanHasMetadataFacetStep } = await import(
      '../lib/search/discovery-metadata-facet-page.js'
    )
    const { buildMetadataFiltersFromSearchParams } = await import(
      '../lib/search/listing-metadata-filter.js'
    )
    const sp = new URLSearchParams(
      'category=nannies&nanny_langs=ru&nanny_experience_min=3&nanny_specialization=baby',
    )
    const parsed = await parseDiscoveryFiltersFromSearchParams(sp, { surface: 'catalog' })
    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    const metadataFilters = buildMetadataFiltersFromSearchParams(sp)

    assert.equal(discoveryPlanHasMetadataFacetStep(plan), true)
    assert.equal(metadataFiltersForJsPostFilter(metadataFilters, plan, true), null)
  })

  it('E4 — guard off (category=all): service URL params stripped from JS post-filter', async () => {
    const { metadataFiltersForJsPostFilter } = await import(
      '../lib/search/discovery-metadata-facet-page.js'
    )
    const { buildMetadataFiltersFromSearchParams } = await import(
      '../lib/search/listing-metadata-filter.js'
    )
    const sp = new URLSearchParams('category=all&nanny_langs=ru')
    const parsed = await parseDiscoveryFiltersFromSearchParams(sp, { surface: 'catalog' })
    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    const metadataFilters = buildMetadataFiltersFromSearchParams(sp)

    assert.ok(!plan.registryFiltersApplied.includes('service.languages'))
    assert.equal(metadataFiltersForJsPostFilter(metadataFilters, plan, true), null)
  })

  it('E4 — serviceMetadataFiltersActive disables response cache key', async () => {
    const { serviceMetadataFiltersActive, getCacheKey } = await import('../lib/api/search/params.js')
    const { buildMetadataFiltersFromSearchParams } = await import(
      '../lib/search/listing-metadata-filter.js'
    )
    const metadataFilters = buildMetadataFiltersFromSearchParams(
      new URLSearchParams('nanny_langs=ru'),
    )
    assert.equal(serviceMetadataFiltersActive(metadataFilters), true)
    assert.equal(
      getCacheKey({
        category: 'nannies',
        limit: 24,
        metadataFilters,
      }),
      null,
    )
  })
})

function deepEqual(a, b) {
  try {
    assert.deepEqual(a, b)
    return true
  } catch {
    return false
  }
}
