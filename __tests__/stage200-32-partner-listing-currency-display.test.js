/**
 * Stage 200.32 — partner listing currency display SSOT (ADR-181 L1).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-32-partner-listing-currency-display.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.32 — partner listing currency display', () => {
  it('normalizePartnerListingRow keeps baseCurrency + basePriceAsset', async () => {
    const { normalizePartnerListingRow } = await import('../lib/hooks/use-partner-listings.js')
    const row = normalizePartnerListingRow({
      id: '1',
      basePriceThb: 1753,
      baseCurrency: 'RUB',
      basePriceAsset: { amount: 4200, currency: 'RUB' },
      images: [],
    })
    assert.equal(row.base_currency, 'RUB')
    assert.equal(row.baseCurrency, 'RUB')
    assert.equal(row.basePriceAsset.amount, 4200)
    assert.equal(row.base_price_thb, 1753)
  })

  it('resolvePartnerListingPriceParts prefers L1 asset amount', async () => {
    const { resolvePartnerListingPriceParts } = await import(
      '../lib/partner/partner-listing-price-display.js'
    )
    const parts = resolvePartnerListingPriceParts({
      basePriceThb: 1753,
      baseCurrency: 'RUB',
      basePriceAsset: { amount: 4200, currency: 'RUB' },
    })
    assert.equal(parts.hasAssetAmount, true)
    assert.equal(parts.primaryAmount, 4200)
    assert.equal(parts.primaryCurrency, 'RUB')
    assert.equal(parts.ledgerThb, 1753)
  })

  it('seasonal i18n keys use {{unit}} not hardcoded ฿', () => {
    const src = read('lib/translations/listings-partner-finances.js')
    assert.doesNotMatch(src, /pricePerDayShort:\s*"฿/)
    assert.match(src, /pricePerDayShort:\s*"\{\{unit\}\}/)
    assert.match(src, /seasonPrice:\s*"Цена \{\{unit\}\}/)
  })

  it('StepPricing seasonal labels use tr({{unit}}) without double symbol', () => {
    const src = read('app/(partner)/partner/listings/new/components/StepPricing.jsx')
    assert.match(src, /tr\('pricePerDayShort',\s*\{\s*unit:\s*currencySymbol/)
    assert.doesNotMatch(src, /t\('pricePerDayShort'\)\s*\(\{?\s*currencySymbol/)
  })

  it('calendar API returns baseCurrency', () => {
    const src = read('app/api/v2/partner/calendar/route.js')
    assert.match(src, /base_currency/)
    assert.match(src, /mapListingPriceFieldsForApi/)
    assert.match(src, /baseCurrency:\s*priceFields\.baseCurrency/)
  })
})
