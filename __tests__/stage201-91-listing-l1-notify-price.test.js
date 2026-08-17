/**
 * Stage 201.91 — listing L1 notify price: never label THB ledger as RUB.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-91-listing-l1-notify-price.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  formatListingL1PriceLine,
  resolveListingL1PriceDisplay,
} from '../lib/listing/listing-l1-price-display.js'
import { resolvePartnerListingPriceParts } from '../lib/partner/partner-listing-price-display.js'

const root = process.cwd()
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.91 — listing L1 notify price', () => {
  it('uses L1 asset RUB, not ledger THB labeled RUB', () => {
    const listing = {
      base_price_thb: 873,
      base_currency: 'RUB',
      metadata: {
        base_price_asset: { amount: 4200, currency: 'RUB', rate_thb_per_unit_mid: 0.208 },
      },
    }
    const d = resolveListingL1PriceDisplay(listing, 'ru')
    assert.equal(d.currency, 'RUB')
    assert.equal(d.amount, 4200)
    assert.equal(d.isLedgerFallback, false)
    const line = formatListingL1PriceLine(listing, 'ru', { perDay: true })
    assert.match(line, /4[\s\u00a0]?200/)
    assert.match(line, /день/)
    assert.doesNotMatch(line, /873/)
  })

  it('fallback labels ledger as THB when asset missing', () => {
    const d = resolveListingL1PriceDisplay(
      { base_price_thb: 873, base_currency: 'RUB' },
      'ru',
    )
    assert.equal(d.currency, 'THB')
    assert.equal(d.amount, 873)
    assert.equal(d.isLedgerFallback, true)
    assert.match(d.primary, /THB/)
    assert.doesNotMatch(d.primary, /RUB/)
  })

  it('partner parts do not pair THB ledger with RUB code', () => {
    const parts = resolvePartnerListingPriceParts({
      basePriceThb: 873,
      baseCurrency: 'RUB',
    })
    assert.equal(parts.hasAssetAmount, false)
    assert.equal(parts.primaryAmount, 873)
    assert.equal(parts.primaryCurrency, 'THB')
  })

  it('admin TG + emails wire L1 / guest pay SSOT', () => {
    const notify = read('lib/partner/notify-listing-submitted-for-moderation.js')
    assert.match(notify, /formatListingL1PriceLine/)
    assert.doesNotMatch(notify, /mapListingPriceFieldsForApi/)
    assert.doesNotMatch(notify, /basePriceThb.*baseCurrency/)

    const adminTg = read('app/api/v2/admin/telegram/route.js')
    assert.match(adminTg, /formatListingL1PriceLine/)
    assert.doesNotMatch(adminTg, /฿\$\{listing\.base_price_thb/)

    const events = read('lib/services/notifications/booking-events.js')
    assert.match(events, /priceLine: guestPriceLine/)
    assert.match(events, /ledgerPriceLine/)

    const email = read('lib/services/email.service.js')
    assert.match(email, /booking\.priceLine/)
    assert.doesNotMatch(email, /฿\$\{escapeHtml\(String\(booking\.totalPrice/)
  })
})
