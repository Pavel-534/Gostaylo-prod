/**
 * Stage 177.4 E1 — service/nanny contract parse & validation matrix.
 * Run: npm run test:discovery-service
 */

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')

describe('discovery service contract (Stage 177.4 E1)', () => {
  let parseDiscoveryFiltersFromSearchParams
  let listActiveRegistryFilterKeys
  let createEmptyDiscoveryContract

  const prevFlag = process.env.DISCOVERY_UNIFIED_PIPELINE

  before(async () => {
    process.env.DISCOVERY_UNIFIED_PIPELINE = '1'
    ;({ parseDiscoveryFiltersFromSearchParams, createEmptyDiscoveryContract } = await import(
      '../lib/search/discovery-filter-contract.js'
    ))
    ;({ listActiveRegistryFilterKeys } = await import('../lib/search/filter-registry.js'))
  })

  after(() => {
    if (prevFlag === undefined) {
      delete process.env.DISCOVERY_UNIFIED_PIPELINE
    } else {
      process.env.DISCOVERY_UNIFIED_PIPELINE = prevFlag
    }
  })

  it('T4.1 — empty contract initializes service vertical fields', () => {
    const draft = createEmptyDiscoveryContract({ surface: 'catalog' })
    assert.deepEqual(draft.vertical.nannyLangs, [])
    assert.equal(draft.vertical.nannyExperienceMin, null)
    assert.equal(draft.vertical.nannySpecialization, null)
    assert.equal(draft.vertical.serviceHomeVisitOnly, false)
  })

  it('T4.1 — nanny_langs on nannies parses active languages', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=nannies&nanny_langs=ru,en'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.deepEqual(parsed.value.vertical.nannyLangs, ['en', 'ru'])
    assert.ok(listActiveRegistryFilterKeys(parsed.value).includes('service.languages'))
  })

  it('T4.1 — nanny_experience_min alias nannyExperienceMin', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=nannies&nannyExperienceMin=5'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.vertical.nannyExperienceMin, 5)
    assert.ok(listActiveRegistryFilterKeys(parsed.value).includes('service.experience_min'))
  })

  it('T4.1 — nanny_specialization and service_home_visit on services', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams(
        'category=services&nanny_specialization=infants&service_home_visit=1',
      ),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.vertical.nannySpecialization, 'infants')
    assert.equal(parsed.value.vertical.serviceHomeVisitOnly, true)
    const active = listActiveRegistryFilterKeys(parsed.value)
    assert.ok(active.includes('service.specialization'))
    assert.ok(active.includes('service.home_visit'))
  })

  it('T4.1 — home_visit_only alias sets serviceHomeVisitOnly', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=services&home_visit_only=true'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.vertical.serviceHomeVisitOnly, true)
  })

  it('T4.1 — experience_min 0 is inactive (not in active registry)', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=nannies&nanny_experience_min=0'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.vertical.nannyExperienceMin, null)
    assert.ok(!listActiveRegistryFilterKeys(parsed.value).includes('service.experience_min'))
  })

  it('T4.2 — invalid nanny_langs token → SERVICE_LANG_INVALID', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=nannies&nanny_langs=ru,xx'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, false)
    assert.ok(parsed.issues.some((i) => i.code === 'SERVICE_LANG_INVALID'))
  })

  it('T4.2 — invalid nanny_experience_min → SERVICE_EXPERIENCE_INVALID', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=nannies&nanny_experience_min=abc'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, false)
    assert.ok(parsed.issues.some((i) => i.code === 'SERVICE_EXPERIENCE_INVALID'))
  })

  it('T4.2 — invalid service_home_visit → SERVICE_HOME_VISIT_INVALID', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=services&service_home_visit=maybe'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, false)
    assert.ok(parsed.issues.some((i) => i.code === 'SERVICE_HOME_VISIT_INVALID'))
  })

  it('T4.3 — freezeDiscoveryContract strips service _*Invalid flags', async () => {
    const { freezeDiscoveryContract } = await import('../lib/search/discovery-filter-contract.js')
    const draft = createEmptyDiscoveryContract()
    draft.vertical._serviceLangInvalid = true
    draft.vertical._serviceExperienceInvalid = true
    draft.vertical._serviceHomeVisitInvalid = true

    const frozen = freezeDiscoveryContract(draft)
    assert.equal(frozen.vertical._serviceLangInvalid, undefined)
    assert.equal(frozen.vertical._serviceExperienceInvalid, undefined)
    assert.equal(frozen.vertical._serviceHomeVisitInvalid, undefined)
  })
})
