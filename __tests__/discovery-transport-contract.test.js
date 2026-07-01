/**
 * Stage 177.3 E1 — transport/yacht contract parse & validation matrix.
 * Run: npm run test:discovery-transport
 */

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')

describe('discovery transport contract (Stage 177.3 E1)', () => {
  let parseDiscoveryFiltersFromSearchParams
  let listActiveRegistryFilterKeys

  const prevFlag = process.env.DISCOVERY_UNIFIED_PIPELINE

  before(async () => {
    process.env.DISCOVERY_UNIFIED_PIPELINE = '1'
    ;({ parseDiscoveryFiltersFromSearchParams } = await import(
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

  it('T3.1 — transmission=automatic on vehicles parses active filter', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=vehicles&transmission=automatic'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.vertical.transmission, 'automatic')
    assert.ok(listActiveRegistryFilterKeys(parsed.value).includes('transport.transmission'))
  })

  it('T3.1 — fuel_type=diesel alias fuelType', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=vehicles&fuelType=diesel'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.vertical.fuelType, 'diesel')
    assert.ok(listActiveRegistryFilterKeys(parsed.value).includes('transport.fuel_type'))
  })

  it('T3.1 — engine_cc_min parses positive float', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=vehicles&engine_cc_min=1500'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.vertical.engineCcMin, 1500)
    assert.ok(listActiveRegistryFilterKeys(parsed.value).includes('transport.engine_cc_min'))
  })

  it('T3.1 — with_captain=1 and vessel_type=catamaran on yachts', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=yachts&with_captain=1&vessel_type=catamaran&cabins_min=3'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.vertical.withCaptain, true)
    assert.equal(parsed.value.vertical.vesselType, 'catamaran')
    assert.equal(parsed.value.vertical.cabinsMin, 3)
    const active = listActiveRegistryFilterKeys(parsed.value)
    assert.ok(active.includes('yacht.with_captain'))
    assert.ok(active.includes('yacht.vessel_type'))
    assert.ok(active.includes('yacht.cabins_min'))
  })

  it('T3.1 — crew_included alias sets withCaptain', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=yachts&crew_included=true'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.vertical.withCaptain, true)
  })

  it('T3.2 — invalid transmission → TRANSMISSION_INVALID', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=vehicles&transmission=rocket'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, false)
    assert.ok(parsed.issues.some((i) => i.code === 'TRANSMISSION_INVALID'))
  })

  it('T3.2 — invalid fuel_type → FUEL_TYPE_INVALID', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=vehicles&fuel_type=unicorn'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, false)
    assert.ok(parsed.issues.some((i) => i.code === 'FUEL_TYPE_INVALID'))
  })

  it('T3.2 — invalid engine_cc_min → ENGINE_CC_INVALID', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=vehicles&engine_cc_min=not-a-number'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, false)
    assert.ok(parsed.issues.some((i) => i.code === 'ENGINE_CC_INVALID'))
  })

  it('T3.2 — invalid vessel_type → VESSEL_TYPE_INVALID', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=yachts&vessel_type=!!!'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, false)
    assert.ok(parsed.issues.some((i) => i.code === 'VESSEL_TYPE_INVALID'))
  })

  it('T3.2 — invalid cabins_min → CABINS_INVALID', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=yachts&cabins_min=-1'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, false)
    assert.ok(parsed.issues.some((i) => i.code === 'CABINS_INVALID'))
  })

  it('T3.2 — invalid with_captain → WITH_CAPTAIN_INVALID', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=yachts&with_captain=maybe'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, false)
    assert.ok(parsed.issues.some((i) => i.code === 'WITH_CAPTAIN_INVALID'))
  })

  it('T3.3 — freezeDiscoveryContract strips vertical _*Invalid flags', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=vehicles&transmission=manual'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.vertical._transmissionInvalid, undefined)
    assert.equal(parsed.value.vertical.transmission, 'manual')
  })

  it('engine_cc_min=0 is inactive (ok)', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=vehicles&engine_cc_min=0'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.vertical.engineCcMin, null)
    assert.ok(!listActiveRegistryFilterKeys(parsed.value).includes('transport.engine_cc_min'))
  })

  it('with_captain=false is inactive (ok)', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('category=yachts&with_captain=false'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.vertical.withCaptain, false)
    assert.ok(!listActiveRegistryFilterKeys(parsed.value).includes('yacht.with_captain'))
  })
})
