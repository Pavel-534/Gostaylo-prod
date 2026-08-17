/**
 * Stage 201.88 — catalog lite must expose L1 so RUB listing + RUB header
 * matches PDP (no THB→retail round-trip).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-88-catalog-same-currency-display.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { catalogPublicCurrencyFields } from '../lib/api/search/listing-search-payload.js'
import { getSameCurrencyGuestNativeAmount } from '../lib/pricing/same-currency-guest-display.js'

const root = process.cwd()
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.88 — catalog same-currency display', () => {
  it('lite catalog shape yields native RUB guest amount (L1 × fee)', () => {
    const row = {
      base_currency: 'RUB',
      metadata: {
        base_price_asset: { amount: 5000, currency: 'RUB', rate_thb_per_unit_mid: 0.4 },
      },
    }
    const lite = {
      ...catalogPublicCurrencyFields(row),
      guestServiceFeePercent: 15,
    }
    assert.equal(lite.baseCurrency, 'RUB')
    assert.equal(lite.basePriceAsset.amount, 5000)
    assert.equal(getSameCurrencyGuestNativeAmount(lite, 'RUB'), 5750)
    assert.equal(getSameCurrencyGuestNativeAmount(lite, 'USD'), null)
  })

  it('TH listing + RUB header stays on retail path (no false same-currency)', () => {
    const lite = catalogPublicCurrencyFields({
      base_currency: 'THB',
      metadata: { base_price_asset: { amount: 900, currency: 'THB' } },
    })
    assert.equal(lite.baseCurrency, 'THB')
    assert.equal(getSameCurrencyGuestNativeAmount({ ...lite, guestServiceFeePercent: 15 }, 'RUB'), null)
  })

  it('search / home / map / favorites wire L1 fields', () => {
    const liteSelect = read('lib/api/search/listing-search-payload.js')
    assert.match(liteSelect, /base_currency/)
    assert.match(liteSelect, /catalogPublicCurrencyFields/)

    const search = read('lib/api/run-listings-search-get.js')
    assert.match(search, /catalogPublicCurrencyFields/)

    const recs = read('lib/recommendations/serialize-recommendation-card.js')
    assert.match(recs, /catalogPublicCurrencyFields/)

    const fullSelect = read('lib/api/search/query-builder.js')
    assert.match(fullSelect, /base_currency/)

    const pins = read('lib/api/search/map-pins-query.js')
    assert.match(pins, /base_currency/)
    assert.match(pins, /catalogPublicCurrencyFields/)

    const cards = read('components/card/CardPriceDisplay.jsx')
    assert.match(cards, /getSameCurrencyGuestNativeAmount/)
    assert.doesNotMatch(cards, /nights <= 0/)

    const fav = read('app/api/v2/favorites/route.js')
    assert.match(fav, /catalogPublicCurrencyFields/)

    const favPage = read('app/(storefront)/renter/favorites/page.js')
    assert.match(favPage, /basePriceAsset/)
  })
})
