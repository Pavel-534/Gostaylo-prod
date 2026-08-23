/**
 * Stage 177.5.2 — location inventory aggregate parity (suggest ranking).
 * Run: npm run test:location-inventory
 */

const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')

describe('location inventory cache (Stage 177.5.2)', () => {
  let buildLocationInventoryIndex
  let buildLocationInventoryIndexFromAggregates
  let simulateLocationInventoryAggregates
  let PHUKET_DISTRICTS_CANON

  before(async () => {
    ;({
      buildLocationInventoryIndex,
      buildLocationInventoryIndexFromAggregates,
      simulateLocationInventoryAggregates,
    } = await import('../lib/locations/location-inventory-cache.js'))
    ;({ PHUKET_DISTRICTS_CANON } = await import('../lib/locations/phuket-districts-canonical.js'))
  })

  const fixtureRows = [
    {
      id: 'a1',
      country_code: 'TH',
      region_code: 'TH-PHK',
      city_code: 'phuket-city',
      district: 'Patong',
      title: 'Beach villa',
      description: 'ok',
    },
    {
      id: 'a2',
      country_code: 'TH',
      region_code: 'TH-PHK',
      city_code: null,
      district: 'Kata',
      title: 'Hill house',
    },
    {
      id: 'a3',
      country_code: 'RU',
      region_code: 'RU-MOW',
      city_code: 'moscow',
      district: null,
      title: 'City flat',
    },
    {
      id: 'e2e1',
      country_code: 'TH',
      region_code: 'TH-PHK',
      city_code: 'phuket-city',
      district: 'Patong',
      title: '[E2E_TEST_DATA] fake',
      description: 'ignore',
    },
    {
      id: 'e2e2',
      country_code: 'TH',
      region_code: 'TH-PHK',
      city_code: 'phuket-city',
      district: 'Rawai',
      title: 'Clean title',
      description: 'tagged [E2E_TEST_DATA]',
    },
    {
      id: 'e2e3',
      country_code: 'TH',
      city_code: 'phuket-city',
      district: 'Kamala',
      title: 'Meta tagged',
      metadata: { test_data_tag: '[E2E_TEST_DATA]' },
    },
    {
      id: 'b1',
      country_code: '',
      region_code: null,
      city_code: null,
      district: 'Patong',
      title: 'District-only Phuket',
    },
  ]

  it('excludes E2E rows and counts hierarchy from raw builder', () => {
    const index = buildLocationInventoryIndex(fixtureRows)
    assert.equal(index.countryCount('TH'), 3) // a1, a2, b1 (rollup)
    assert.equal(index.countryCount('RU'), 1)
    assert.equal(index.regionCount('TH-PHK'), 3)
    assert.equal(index.cityCount('phuket-city'), 3) // a1 + a2 rollup + b1 rollup
    assert.equal(index.cityCount('moscow'), 1)
    assert.equal(index.districtCount('Patong'), 2) // a1, b1 — not e2e
    assert.equal(index.districtCount('Kata'), 1)
    assert.equal(index.districtCount('Rawai'), 0)
  })

  it('aggregate simulator matches Set-based builder (Phuket + E2E)', () => {
    const fromRows = buildLocationInventoryIndex(fixtureRows)
    const fromAggs = buildLocationInventoryIndexFromAggregates(
      simulateLocationInventoryAggregates(fixtureRows, PHUKET_DISTRICTS_CANON),
    )

    const keys = [
      ['country', 'TH'],
      ['country', 'RU'],
      ['region', 'TH-PHK'],
      ['region', 'RU-MOW'],
      ['city', 'phuket-city'],
      ['city', 'moscow'],
      ['district', 'Patong'],
      ['district', 'Kata'],
      ['district', 'Kamala'],
    ]

    for (const [level, code] of keys) {
      const a =
        level === 'country'
          ? fromRows.countryCount(code)
          : level === 'region'
            ? fromRows.regionCount(code)
            : level === 'city'
              ? fromRows.cityCount(code)
              : fromRows.districtCount(code)
      const b =
        level === 'country'
          ? fromAggs.countryCount(code)
          : level === 'region'
            ? fromAggs.regionCount(code)
            : level === 'city'
              ? fromAggs.cityCount(code)
              : fromAggs.districtCount(code)
      assert.equal(b, a, `${level}:${code}`)
    }
  })

  it('phuket canon list is non-empty for RPC arg', () => {
    assert.ok(PHUKET_DISTRICTS_CANON.length >= 10)
    assert.ok(PHUKET_DISTRICTS_CANON.includes('Patong'))
  })
})
