/**
 * Stage 177.3 E2 — vertical guard matrix & cross-vertical interference (UX-7, UX-10).
 * Run: npm run test:discovery-transport
 */

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')

describe('discovery transport plan guards (Stage 177.3 E2)', () => {
  let parseDiscoveryFiltersFromSearchParams
  let listActiveRegistryFilterKeys
  let buildDiscoveryQueryPlan
  let ORDERED_FILTER_KEYS

  const prevFlag = process.env.DISCOVERY_UNIFIED_PIPELINE

  before(async () => {
    process.env.DISCOVERY_UNIFIED_PIPELINE = '1'
    ;({ parseDiscoveryFiltersFromSearchParams } = await import(
      '../lib/search/discovery-filter-contract.js'
    ))
    ;({ listActiveRegistryFilterKeys, ORDERED_FILTER_KEYS } = await import(
      '../lib/search/filter-registry.js'
    ))
    ;({ buildDiscoveryQueryPlan } = await import('../lib/search/discovery-query-plan.js'))
  })

  after(() => {
    if (prevFlag === undefined) {
      delete process.env.DISCOVERY_UNIFIED_PIPELINE
    } else {
      process.env.DISCOVERY_UNIFIED_PIPELINE = prevFlag
    }
  })

  it('ORDERED_FILTER_KEYS places transport/yacht facets after housing.amenities', () => {
    const amenitiesIdx = ORDERED_FILTER_KEYS.indexOf('housing.amenities')
    const transmissionIdx = ORDERED_FILTER_KEYS.indexOf('transport.transmission')
    const cabinsIdx = ORDERED_FILTER_KEYS.indexOf('yacht.cabins_min')
    assert.ok(amenitiesIdx >= 0)
    assert.ok(transmissionIdx > amenitiesIdx)
    assert.ok(cabinsIdx > amenitiesIdx)
  })

  it('UX-7 — property + transmission: parsed but registry inactive (no interference)', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=property&transmission=automatic'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.vertical.transmission, 'automatic')
    assert.equal(parsed.value.categorySlug, 'property')

    const active = listActiveRegistryFilterKeys(parsed.value)
    assert.ok(!active.includes('transport.transmission'))
    assert.ok(!active.includes('transport.fuel_type'))
    assert.ok(!active.includes('transport.engine_cc_min'))

    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.ok(!plan.registryFiltersApplied.includes('transport.transmission'))
  })

  it('UX-10 — transmission without category: parsed but registry inactive', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('transmission=automatic'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.categorySlug, null)
    assert.equal(parsed.value.vertical.transmission, 'automatic')

    const active = listActiveRegistryFilterKeys(parsed.value)
    assert.ok(!active.includes('transport.transmission'))

    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.ok(!plan.registryFiltersApplied.includes('transport.transmission'))
  })

  it('vehicles + transmission: guard allows active registry key', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=vehicles&transmission=automatic&fuel_type=petrol'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    const active = listActiveRegistryFilterKeys(parsed.value)
    assert.ok(active.includes('transport.transmission'))
    assert.ok(active.includes('transport.fuel_type'))

    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.ok(plan.registryFiltersApplied.includes('transport.transmission'))
    assert.ok(plan.registryFiltersApplied.includes('transport.fuel_type'))
    assert.ok(
      plan.sql.jsonbPredicates.some(
        (p) => p.op === 'text_eq_ci' && p.path === 'transmission' && p.value === 'automatic',
      ),
    )
  })

  it('vehicles + cabins_min: yacht guard blocks cabins on non-yacht category', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=vehicles&cabins_min=2'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.vertical.cabinsMin, 2)
    assert.ok(!listActiveRegistryFilterKeys(parsed.value).includes('yacht.cabins_min'))
  })

  it('yachts + vessel_type + with_captain: yacht guard allows combo', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=yachts&vessel_type=catamaran&with_captain=1'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    const active = listActiveRegistryFilterKeys(parsed.value)
    assert.ok(active.includes('yacht.vessel_type'))
    assert.ok(active.includes('yacht.with_captain'))

    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.ok(plan.registryFiltersApplied.includes('yacht.vessel_type'))
    assert.ok(plan.registryFiltersApplied.includes('yacht.with_captain'))
    assert.ok(
      plan.sql.jsonbPredicates.some(
        (p) => p.op === '@>' && p.path === 'crew_included' && p.value === true,
      ),
    )
  })

  it('helicopters + with_captain allowed; vessel_type blocked', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=helicopters&with_captain=1&vessel_type=catamaran'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    const active = listActiveRegistryFilterKeys(parsed.value)
    assert.ok(active.includes('yacht.with_captain'))
    assert.ok(!active.includes('yacht.vessel_type'))
  })

  it('helicopters + transmission: transport guard allows land-air transport facets', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=helicopters&transmission=automatic'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.ok(listActiveRegistryFilterKeys(parsed.value).includes('transport.transmission'))
  })

  it('yachts + transmission: transport guard blocks transmission on yacht category', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=yachts&transmission=automatic'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.vertical.transmission, 'automatic')
    assert.ok(!listActiveRegistryFilterKeys(parsed.value).includes('transport.transmission'))
  })
})
