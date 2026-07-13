/**
 * ADR-181.2 — listing asset currency from geo
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/listing-asset-currency.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('listing-asset-currency (ADR-181.2)', () => {
  it('getDefaultListingBaseCurrency maps RU→RUB, TH→THB', async () => {
    const { getDefaultListingBaseCurrency } = await import('@/lib/listing/listing-asset-currency.js')
    assert.equal(getDefaultListingBaseCurrency('RU'), 'RUB')
    assert.equal(getDefaultListingBaseCurrency('TH'), 'THB')
    assert.equal(getDefaultListingBaseCurrency('XX'), 'THB')
  })

  it('isRussiaListingGeo detects country, region, and city preset', async () => {
    const { isRussiaListingGeo } = await import('@/lib/listing/listing-asset-currency.js')
    assert.equal(isRussiaListingGeo({ countryCode: 'RU' }), true)
    assert.equal(isRussiaListingGeo({ regionCode: 'RU-KDA' }), true)
    assert.equal(isRussiaListingGeo({ cityCode: 'sochi' }), true)
    assert.equal(isRussiaListingGeo({ countryCode: 'TH', cityCode: 'phuket' }), false)
  })

  it('resolveEnforcedListingBaseCurrency forces RUB for RU geo', async () => {
    const { resolveEnforcedListingBaseCurrency } = await import('@/lib/listing/listing-asset-currency.js')
    const result = resolveEnforcedListingBaseCurrency({
      countryCode: 'RU',
      requestedCurrency: 'THB',
    })
    assert.equal(result.baseCurrency, 'RUB')
    assert.equal(result.source, 'ru_geo_invariant')
    assert.equal(result.overridden, true)
  })

  it('resolveEnforcedListingBaseCurrency maps TH without override', async () => {
    const { resolveEnforcedListingBaseCurrency } = await import('@/lib/listing/listing-asset-currency.js')
    const result = resolveEnforcedListingBaseCurrency({
      countryCode: 'TH',
      requestedCurrency: 'THB',
    })
    assert.equal(result.baseCurrency, 'THB')
    assert.equal(result.overridden, false)
  })

  it('applyListingBaseCurrencyInvariant mutates row to RUB', async () => {
    const { applyListingBaseCurrencyInvariant } = await import(
      '@/lib/listing/apply-listing-base-currency-invariant.js'
    )
    const row = { country_code: 'RU', base_currency: 'THB' }
    const out = applyListingBaseCurrencyInvariant(row, { requestedCurrency: 'THB' })
    assert.equal(row.base_currency, 'RUB')
    assert.equal(out.overridden, true)
  })
})
