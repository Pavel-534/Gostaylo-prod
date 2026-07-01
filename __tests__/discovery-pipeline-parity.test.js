/**
 * Stage 177.1 — discovery pipeline parity (catalog vs map plans).
 * Run: npm run test:discovery-pipeline
 */

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')

const FIXTURE_URLS = [
  '?category=stays&south=7.7&north=8.2&west=98.2&east=98.5',
  '?category=vehicles&south=7.8&north=8.0&west=98.3&east=98.4&amenities=wifi',
  '?south=7.5&north=8.5&west=98.0&east=99.0',
  '?amenities=wifi,pool&limit=24',
  '?category=stays&amenities=air_conditioning',
]

describe('discovery pipeline parity (Stage 177.1)', () => {
  let parseDiscoveryFiltersFromSearchParams
  let buildDiscoveryQueryPlan
  let diffDiscoveryPlansForSurfaces
  let ORDERED_FILTER_KEYS
  let isDiscoveryUnifiedPipelineEnabled
  let discoveryPipelineMode

  before(async () => {
    ;({
      parseDiscoveryFiltersFromSearchParams,
    } = await import('../lib/search/discovery-filter-contract.js'))
    ;({
      buildDiscoveryQueryPlan,
      diffDiscoveryPlansForSurfaces,
    } = await import('../lib/search/discovery-query-plan.js'))
    ;({
      ORDERED_FILTER_KEYS,
    } = await import('../lib/search/filter-registry.js'))
    ;({
      isDiscoveryUnifiedPipelineEnabled,
      discoveryPipelineMode,
    } = await import('../lib/search/discovery-pipeline-flag.js'))
  })

  const prevFlag = process.env.DISCOVERY_UNIFIED_PIPELINE

  after(() => {
    if (prevFlag === undefined) {
      delete process.env.DISCOVERY_UNIFIED_PIPELINE
    } else {
      process.env.DISCOVERY_UNIFIED_PIPELINE = prevFlag
    }
  })

  it('registry cascade order includes housing facets (Stage 177.2b)', () => {
    assert.deepEqual(ORDERED_FILTER_KEYS, [
      'category',
      'geo.bbox',
      'price.range',
      'housing.bedrooms',
      'housing.bathrooms',
      'stay.guests',
      'housing.property_type',
      'housing.instant_booking',
      'housing.amenities',
    ])
  })

  it('feature flag defaults to legacy mode', () => {
    delete process.env.DISCOVERY_UNIFIED_PIPELINE
    assert.equal(isDiscoveryUnifiedPipelineEnabled(), false)
    assert.equal(discoveryPipelineMode(), 'legacy')
    process.env.DISCOVERY_UNIFIED_PIPELINE = '1'
    assert.equal(isDiscoveryUnifiedPipelineEnabled(), true)
    assert.equal(discoveryPipelineMode(), 'unified')
  })

  it('parses category, bbox, and amenities into contract', async () => {
    const sp = new URLSearchParams(
      'category=stays&south=7.7&north=8.2&west=98.2&east=98.5&amenities=wifi,pool&limit=30',
    )
    const parsed = await parseDiscoveryFiltersFromSearchParams(sp, { surface: 'catalog' })
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.categorySlug, 'stays')
    assert.equal(parsed.value.geo.mode, 'bbox')
    assert.deepEqual(parsed.value.housing.amenities, ['wifi', 'pool'])
    assert.equal(parsed.value.browse.limit, 30)
  })

  it('rejects invalid bbox ordering', async () => {
    const { createEmptyDiscoveryContract, validateDiscoveryContract } = await import(
      '../lib/search/discovery-filter-contract.js'
    )
    const draft = createEmptyDiscoveryContract()
    draft.geo = { mode: 'bbox', south: 8, north: 7, west: 98, east: 99, quantized: false }
    const result = validateDiscoveryContract(draft)
    assert.equal(result.ok, false)
    assert.ok(result.issues.some((i) => i.code === 'BBOX_INVALID'))
  })

  it('buildDiscoveryQueryPlan applies filters in cascade order', async () => {
    const sp = new URLSearchParams(
      'category=property&south=7.8&north=8.0&west=98.3&east=98.4&amenities=wifi',
    )
    const parsed = await parseDiscoveryFiltersFromSearchParams(sp, { surface: 'catalog' })
    assert.equal(parsed.ok, true)
    const contract = {
      ...parsed.value,
      categoryIds: ['cat_parent_test', 'cat_child_test'],
    }

    const plan = await buildDiscoveryQueryPlan(contract, { surface: 'catalog' })
    assert.deepEqual(plan.registryFiltersApplied, ['category', 'geo.bbox', 'housing.amenities'])
    assert.equal(plan.spatial.rpc, 'listings_ids_in_bbox_gist_v1')
    assert.ok(Array.isArray(plan.sql.categoryIds))
    assert.deepEqual(plan.sql.amenities, ['wifi'])
    assert.equal(plan.spatial.rpcArgs.categoryIds?.length > 0, true)
  })

  it('catalog and map plans are identical for fixture matrix', async () => {
    for (const qs of FIXTURE_URLS) {
      const sp = new URLSearchParams(qs.startsWith('?') ? qs.slice(1) : qs)
      const parsed = await parseDiscoveryFiltersFromSearchParams(sp, { surface: 'catalog' })
      assert.equal(parsed.ok, true, `parse failed for ${qs}`)
      const contract = parsed.value.categorySlug
        ? { ...parsed.value, categoryIds: ['cat_fixture_test'] }
        : parsed.value
      const { diff } = await diffDiscoveryPlansForSurfaces(contract)
      assert.equal(diff, null, `plan parity failed for ${qs}: ${diff?.join('; ')}`)
    }
  })

  it('amenities-only query builds SQL predicate without spatial rpc', async () => {
    const sp = new URLSearchParams('amenities=wifi')
    const parsed = await parseDiscoveryFiltersFromSearchParams(sp, { surface: 'map' })
    assert.equal(parsed.ok, true)
    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'map' })
    assert.deepEqual(plan.registryFiltersApplied, ['housing.amenities'])
    assert.equal(plan.spatial.rpc, null)
    assert.equal(plan.sql.jsonbPredicates.length, 1)
    assert.equal(plan.sql.jsonbPredicates[0].op, '@>')
  })
})
