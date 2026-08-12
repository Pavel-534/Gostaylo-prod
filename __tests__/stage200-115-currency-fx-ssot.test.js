/**
 * Stage 200.115 — lock FX policy matrix (display vs checkout). Pure, no I/O.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-97-currency-fx-ssot.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { BOOKING_PAYMENT_CURRENCIES } from '@/lib/finance/currency-codes.js'
import {
  canSettleSameCurrencyWithoutCheckoutFx,
  describeFxForCurrencies,
  isPayableBookingCurrency,
  shouldApplyCheckoutFxMarkup,
  shouldApplyRetailDisplayMarkup,
} from '@/lib/pricing/fx-policy.js'

describe('Stage 200.115 — currency FX SSOT matrix', () => {
  it('checkout FX only when pay ≠ listing base', () => {
    assert.equal(shouldApplyCheckoutFxMarkup('RUB', 'RUB'), false)
    assert.equal(shouldApplyCheckoutFxMarkup('THB', 'THB'), false)
    assert.equal(shouldApplyCheckoutFxMarkup('EUR', 'EUR'), false)
    assert.equal(shouldApplyCheckoutFxMarkup('THB', 'RUB'), true)
    assert.equal(shouldApplyCheckoutFxMarkup('RUB', 'THB'), true)
    assert.equal(shouldApplyCheckoutFxMarkup('RUB', 'EUR'), true)
    assert.equal(shouldApplyCheckoutFxMarkup('THB', 'EUR'), true)
    assert.equal(shouldApplyCheckoutFxMarkup('USD', 'EUR'), true)
    assert.equal(shouldApplyCheckoutFxMarkup('CNY', 'RUB'), true)
  })

  it('retail display markup skips THB hub currency', () => {
    assert.equal(shouldApplyRetailDisplayMarkup('THB'), false)
    assert.equal(shouldApplyRetailDisplayMarkup('USD'), true)
    assert.equal(shouldApplyRetailDisplayMarkup('RUB'), true)
    assert.equal(shouldApplyRetailDisplayMarkup('CNY'), true)
    assert.equal(shouldApplyRetailDisplayMarkup('EUR'), true)
  })

  it('Berlin EUR cannot settle same-currency (EUR not payable)', () => {
    assert.equal(isPayableBookingCurrency('EUR'), false)
    assert.equal(canSettleSameCurrencyWithoutCheckoutFx('EUR'), false)
    assert.equal(canSettleSameCurrencyWithoutCheckoutFx('RUB'), true)
    assert.equal(canSettleSameCurrencyWithoutCheckoutFx('THB'), true)
    assert.ok(BOOKING_PAYMENT_CURRENCIES.includes('RUB'))
    assert.ok(!BOOKING_PAYMENT_CURRENCIES.includes('EUR'))
  })

  it('describeFxForCurrencies: RU listing viewed in THB vs paid in THB', () => {
    const viewedThb = describeFxForCurrencies({
      listingBaseCurrency: 'RUB',
      displayCurrency: 'THB',
      paymentCurrency: 'THB',
    })
    assert.equal(viewedThb.retailOnDisplay, false)
    assert.equal(viewedThb.checkoutFx, true)

    const payRub = describeFxForCurrencies({
      listingBaseCurrency: 'RUB',
      displayCurrency: 'THB',
      paymentCurrency: 'RUB',
    })
    assert.equal(payRub.checkoutFx, false)
  })

  it('TH listing + MIR RUB: checkout FX yes; retail on RUB display yes', () => {
    const row = describeFxForCurrencies({
      listingBaseCurrency: 'THB',
      displayCurrency: 'RUB',
      paymentCurrency: 'RUB',
    })
    assert.equal(row.checkoutFx, true)
    assert.equal(row.retailOnDisplay, true)
    assert.equal(row.sameCurrencyDisplay, false)
  })
})
