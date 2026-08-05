/**
 * Stage 200.33 / ADR-181 Wave 5.2 — seasonal asset → THB canon.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/listing-seasonal-price-canon.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

describe('listing-seasonal-price-canon', () => {
  it('RUB seasonal daily converts to THB mid + stores asset snapshot', async () => {
    const { resolveSeasonalPriceCanon, readSeasonalAssetAmountsFromRow, mapSeasonalRowForPartnerUi } =
      await import('../lib/listing/listing-seasonal-price-canon.js')

    const canon = resolveSeasonalPriceCanon({
      priceDailyAsset: 5000,
      priceMonthlyAsset: 120000,
      currency: 'RUB',
      rateMap: { RUB: 0.4 },
      convertedAt: '2026-08-05T00:00:00.000Z',
    })
    assert.equal(canon.priceDailyThb, 2000)
    assert.equal(canon.priceMonthlyThb, 48000)
    assert.equal(canon.metadata.price_daily_asset.amount, 5000)
    assert.equal(canon.metadata.price_daily_asset.currency, 'RUB')

    const ui = mapSeasonalRowForPartnerUi({
      id: 'sp1',
      label: 'High',
      start_date: '2026-12-01',
      end_date: '2026-12-31',
      price_daily: 2000,
      price_monthly: 48000,
      season_type: 'HIGH',
      metadata: canon.metadata,
    })
    assert.equal(ui.priceDaily, 5000)
    assert.equal(ui.priceMonthly, 120000)
    assert.equal(ui.priceDailyThb, 2000)
    assert.equal(ui.hasAssetSnapshot, true)

    const roundTrip = readSeasonalAssetAmountsFromRow({
      price_daily: 2000,
      metadata: canon.metadata,
    })
    assert.equal(roundTrip.priceDaily, 5000)
    assert.equal(roundTrip.hasAsset, true)
  })

  it('THB seasonal is 1:1', async () => {
    const { resolveSeasonalPriceCanon } = await import('../lib/listing/listing-seasonal-price-canon.js')
    const canon = resolveSeasonalPriceCanon({
      priceDailyAsset: 3500,
      currency: 'THB',
      rateMap: { THB: 1 },
    })
    assert.equal(canon.priceDailyThb, 3500)
    assert.equal(canon.metadata.price_daily_asset.currency, 'THB')
  })

  it('legacy row without metadata falls back to ledger THB for UI', async () => {
    const { mapSeasonalRowForPartnerUi } = await import('../lib/listing/listing-seasonal-price-canon.js')
    const ui = mapSeasonalRowForPartnerUi({
      id: 'legacy',
      start_date: '2026-01-01',
      end_date: '2026-01-10',
      price_daily: 1753,
      season_type: 'NORMAL',
      metadata: {},
    })
    assert.equal(ui.priceDaily, 1753)
    assert.equal(ui.hasAssetSnapshot, false)
  })

  it('upsert service and migration exist', () => {
    const svc = fs.readFileSync(
      path.join(root, 'lib/services/calendar/partner-seasonal-price.service.js'),
      'utf8',
    )
    assert.match(svc, /resolveSeasonalPriceCanonWithRates/)
    assert.match(svc, /base_currency/)
    const mig = fs.readFileSync(
      path.join(root, 'migrations/stage200_33_seasonal_price_asset_metadata.sql'),
      'utf8',
    )
    assert.match(mig, /ADD COLUMN IF NOT EXISTS metadata JSONB/)
  })
})
