/**
 * Stage 197.1 — checkout promo reprice + valid_from + intent amount SSOT
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/checkout-promo-reprice.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('promoIsActiveAt valid_from', () => {
  it('rejects promo before valid_from and accepts after', async () => {
    const { promoIsActiveAt } = await import('../lib/promo/promo-engine.js')
    const promo = {
      is_active: true,
      valid_from: '2026-08-01T00:00:00.000Z',
      valid_until: '2026-12-01T00:00:00.000Z',
      max_uses: null,
      current_uses: 0,
    }
    assert.equal(promoIsActiveAt(promo, Date.parse('2026-07-15T12:00:00.000Z')).ok, false)
    assert.equal(promoIsActiveAt(promo, Date.parse('2026-07-15T12:00:00.000Z')).reason, 'NOT_STARTED')
    assert.equal(promoIsActiveAt(promo, Date.parse('2026-08-02T12:00:00.000Z')).ok, true)
  })
})

describe('checkout promo base subtotal + intent amount', () => {
  it('recovers pre-promo subtotal from snapshot or price+promo', async () => {
    const { resolveCheckoutPromoBaseSubtotalThb, expectedPaymentIntentAmountThbFromBooking } =
      await import('../lib/services/booking/checkout-promo-amounts.js')

    assert.equal(
      resolveCheckoutPromoBaseSubtotalThb({
        price_thb: 8500,
        pricing_snapshot: { accommodation_total_after_duration_thb: 10000 },
      }),
      10000,
    )

    assert.equal(
      resolveCheckoutPromoBaseSubtotalThb({
        price_thb: 8500,
        pricing_snapshot: { promo: { extra_discount_thb: 1500 } },
      }),
      10000,
    )

    const bookingAfterPromo = {
      price_thb: 8500,
      commission_thb: 1275,
      rounding_diff_pot: 5,
    }
    assert.equal(expectedPaymentIntentAmountThbFromBooking(bookingAfterPromo), 8500 + 1275 + 5)
  })

  it('maps promo → guest payable chain used by PaymentIntent (no double-discount)', async () => {
    const { expectedPaymentIntentAmountThbFromBooking, resolveCheckoutPromoBaseSubtotalThb } =
      await import('../lib/services/booking/checkout-promo-amounts.js')
    const { calculatePromoDiscountAmount } = await import('../lib/promo/promo-engine.js')

    const base = 10000
    const discount = calculatePromoDiscountAmount(
      { promo_type: 'PERCENTAGE', value: 15 },
      base,
    )
    assert.equal(discount, 1500)
    const priceThb = base - discount
    const guestFee = Math.round(priceThb * 0.15)
    const rounding = 0
    const booking = {
      price_thb: priceThb,
      commission_thb: guestFee,
      rounding_diff_pot: rounding,
      pricing_snapshot: {
        accommodation_total_after_duration_thb: base,
        promo: { code: 'SAVE15', extra_discount_thb: discount },
      },
      promo_code_used: 'SAVE15',
    }

    assert.equal(resolveCheckoutPromoBaseSubtotalThb(booking), base)
    // What initiate / resolveAcquirerChargeAmount sees via intent.amount_thb
    const intentAmountThb = expectedPaymentIntentAmountThbFromBooking(booking)
    assert.equal(intentAmountThb, priceThb + guestFee + rounding)
    assert.ok(intentAmountThb < base + Math.round(base * 0.15))
  })
})
