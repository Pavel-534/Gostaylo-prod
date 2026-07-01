/**
 * Stage 177.4 E2 — service vertical guard matrix (§2.4 cross-vertical).
 * Run: npm run test:discovery-service
 */

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')

describe('discovery service plan guards (Stage 177.4 E2)', () => {
  let parseDiscoveryFiltersFromSearchParams
  let listActiveRegistryFilterKeys
  let buildDiscoveryQueryPlan
  let ORDERED_FILTER_KEYS
  let isServiceRegistryFilterAllowedForContract

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
    ;({ isServiceRegistryFilterAllowedForContract } = await import(
      '../lib/search/discovery-services-vertical-guard.js'
    ))
  })

  after(() => {
    if (prevFlag === undefined) {
      delete process.env.DISCOVERY_UNIFIED_PIPELINE
    } else {
      process.env.DISCOVERY_UNIFIED_PIPELINE = prevFlag
    }
  })

  it('ORDERED_FILTER_KEYS places service facets after yacht.cabins_min', () => {
    const cabinsIdx = ORDERED_FILTER_KEYS.indexOf('yacht.cabins_min')
    const langsIdx = ORDERED_FILTER_KEYS.indexOf('service.languages')
    const homeIdx = ORDERED_FILTER_KEYS.indexOf('service.home_visit')
    assert.ok(cabinsIdx >= 0)
    assert.ok(langsIdx > cabinsIdx)
    assert.ok(homeIdx > cabinsIdx)
  })

  it('§2.4 — nanny_langs on category=all: parsed but registry inactive', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=all&nanny_langs=ru'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.categorySlug, null)
    assert.deepEqual(parsed.value.vertical.nannyLangs, ['ru'])

    const active = listActiveRegistryFilterKeys(parsed.value)
    assert.ok(!active.includes('service.languages'))
    assert.ok(!active.includes('service.experience_min'))

    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.ok(!plan.registryFiltersApplied.includes('service.languages'))
  })

  it('§2.4 — nanny_langs on property: parsed but registry inactive', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=property&nanny_langs=ru&nanny_experience_min=3'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.categorySlug, 'property')
    assert.deepEqual(parsed.value.vertical.nannyLangs, ['ru'])
    assert.equal(parsed.value.vertical.nannyExperienceMin, 3)

    const active = listActiveRegistryFilterKeys(parsed.value)
    assert.ok(!active.includes('service.languages'))
    assert.ok(!active.includes('service.experience_min'))

    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.ok(!plan.registryFiltersApplied.some((k) => k.startsWith('service.')))
  })

  it('§2.4 — nanny_langs without category: parsed but registry inactive', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('nanny_langs=en'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.categorySlug, null)

    const active = listActiveRegistryFilterKeys(parsed.value)
    assert.ok(!active.includes('service.languages'))

    assert.equal(
      isServiceRegistryFilterAllowedForContract(parsed.value, 'service.languages'),
      false,
    )
  })

  it('§2.4 — vehicles + nanny_experience_min: guard off', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=vehicles&nanny_experience_min=3'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.ok(!listActiveRegistryFilterKeys(parsed.value).includes('service.experience_min'))

    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.ok(!plan.registryFiltersApplied.includes('service.experience_min'))
  })

  it('nannies + nanny_langs: guard allows active registry key and plan step', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=nannies&nanny_langs=ru,en'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)

    const active = listActiveRegistryFilterKeys(parsed.value)
    assert.ok(active.includes('service.languages'))
    assert.equal(
      isServiceRegistryFilterAllowedForContract(parsed.value, 'service.languages'),
      true,
    )

    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.ok(plan.registryFiltersApplied.includes('service.languages'))
    assert.ok(
      (plan.sql.jsonbPredicates || []).some(
        (p) => p.op === '@>' && p.path === 'languages' && Array.isArray(p.value),
      ),
    )
  })

  it('services + service_home_visit: guard allows home_visit facet', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=services&service_home_visit=1'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)

    const active = listActiveRegistryFilterKeys(parsed.value)
    assert.ok(active.includes('service.home_visit'))

    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.ok(plan.registryFiltersApplied.includes('service.home_visit'))
  })
})
