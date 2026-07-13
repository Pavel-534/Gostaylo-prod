/**
 * ADR-181 Wave 1 — listing base price canon
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/listing-base-price-canon.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('listing-base-price-canon', () => {
  it('THB passthrough keeps amount 1:1 in base_price_thb', async () => {
    const { resolveListingBasePriceCanon } = await import('@/lib/listing/listing-base-price-canon.js')
    const result = resolveListingBasePriceCanon({
      amount: 3500,
      currency: 'THB',
      rateMap: { THB: 1 },
      convertedAt: '2026-07-13T00:00:00.000Z',
    })
    assert.equal(result.basePriceThb, 3500)
    assert.deepEqual(result.basePriceAsset, {
      amount: 3500,
      currency: 'THB',
      rate_thb_per_unit_mid: 1,
      converted_at: '2026-07-13T00:00:00.000Z',
    })
  })

  it('RUB asset converts to THB via mid rate (2000 @ 0.45 THB/RUB → 900)', async () => {
    const { resolveListingBasePriceCanon } = await import('@/lib/listing/listing-base-price-canon.js')
    const result = resolveListingBasePriceCanon({
      amount: 2000,
      currency: 'RUB',
      rateMap: { RUB: 0.45 },
      convertedAt: '2026-07-13T00:00:00.000Z',
    })
    assert.equal(result.basePriceThb, 900)
    assert.equal(result.basePriceAsset.amount, 2000)
    assert.equal(result.basePriceAsset.currency, 'RUB')
    assert.ok(Math.abs(result.basePriceAsset.rate_thb_per_unit_mid - 0.45) < 1e-6)
  })

  it('repairs inverted RUB rate in map (legacy 2.8)', async () => {
    const { resolveListingBasePriceCanon } = await import('@/lib/listing/listing-base-price-canon.js')
    const result = resolveListingBasePriceCanon({
      amount: 2000,
      currency: 'RUB',
      rateMap: { RUB: 2.8 },
    })
    assert.equal(result.basePriceThb, Math.round(2000 * (1 / 2.8)))
  })

  it('throws LISTING_BASE_PRICE_FX_UNAVAILABLE when rate missing', async () => {
    const { resolveListingBasePriceCanon } = await import('@/lib/listing/listing-base-price-canon.js')
    assert.throws(
      () =>
        resolveListingBasePriceCanon({
          amount: 100,
          currency: 'USD',
          rateMap: {},
        }),
      (err) => err.code === 'LISTING_BASE_PRICE_FX_UNAVAILABLE',
    )
  })

  it('readPartnerFormAssetAmount prefers metadata.base_price_asset', async () => {
    const { readPartnerFormAssetAmount, readBasePriceAssetFromListing } = await import(
      '@/lib/listing/listing-base-price-canon.js'
    )
    const listing = {
      base_price_thb: 999,
      metadata: {
        base_price_asset: {
          amount: 2000,
          currency: 'RUB',
          rate_thb_per_unit_mid: 0.45,
          converted_at: '2026-07-13T00:00:00.000Z',
        },
      },
    }
    assert.equal(readPartnerFormAssetAmount(listing), 2000)
    assert.equal(readBasePriceAssetFromListing(listing)?.currency, 'RUB')
  })

  it('isListingAssetPriceCanonEnabled defaults on unless LISTING_ASSET_PRICE_CANON=0', async () => {
    const { isListingAssetPriceCanonEnabled } = await import('@/lib/listing/listing-base-price-canon.js')
    const prev = process.env.LISTING_ASSET_PRICE_CANON
    try {
      delete process.env.LISTING_ASSET_PRICE_CANON
      assert.equal(isListingAssetPriceCanonEnabled(), true)
      process.env.LISTING_ASSET_PRICE_CANON = '0'
      assert.equal(isListingAssetPriceCanonEnabled(), false)
    } finally {
      if (prev === undefined) delete process.env.LISTING_ASSET_PRICE_CANON
      else process.env.LISTING_ASSET_PRICE_CANON = prev
    }
  })
})
