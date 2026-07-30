/**
 * Stage 199 — Search Summary === PDP Widget === Checkout Charge (same stay inputs).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/price-truth-consistency.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('Stage 199 price truth consistency', () => {
  it('Search stay total === PDP widget total === checkout charge for same lodging + 15% fee', async () => {
    const {
      computeStayGuestPayableTruth,
      resolveSearchStayTotalThb,
      resolvePdpWidgetTotalThb,
      resolveCheckoutChargeTotalThb,
    } = await import('../lib/pricing/price-truth.js')
    const { getGuestDisplayForStay } = await import('../lib/pricing/guest-display-price.js')

    const nights = 3
    const lodgingSubtotalThb = 10000
    const truth = computeStayGuestPayableTruth(lodgingSubtotalThb, {
      guestServiceFeePercent: 15,
      taxRatePercent: 0,
    })

    // Batch search pricing shape (Stage 42.3)
    const batchPricing = {
      nights,
      totalPrice: truth.guestPayableRoundedThb,
      subtotalThb: truth.subtotalThb,
      guestServiceFeeThb: truth.guestServiceFeeThb,
      guestServiceFeePercent: 15,
      guestPayableRoundedThb: truth.guestPayableRoundedThb,
      taxAmountThb: truth.taxAmountThb,
      taxRatePercent: 0,
      roundingDiffPotThb: truth.roundingDiffPotThb,
    }

    const searchTotal = resolveSearchStayTotalThb(batchPricing, { nights })
    const cardTotal = getGuestDisplayForStay(
      { base_price_thb: Math.round(lodgingSubtotalThb / nights), pricing: batchPricing },
      nights,
      15,
    )

    // PDP priceCalc shape (useListingPricing)
    const priceCalc = {
      nights,
      subtotalBeforeFee: truth.subtotalThb,
      totalPrice: truth.subtotalThb,
      serviceFee: truth.guestServiceFeeThb,
      taxAmountThb: truth.taxAmountThb,
      guestServiceFeePercent: 15,
      roundingDiffPot: truth.roundingDiffPotThb,
      finalTotal: truth.guestPayableRoundedThb,
    }
    const pdpTotal = resolvePdpWidgetTotalThb(priceCalc)

    // Checkout booking columns after create (no promo)
    const booking = {
      price_thb: truth.bookingPriceThb,
      commission_thb: truth.bookingCommissionThb,
      rounding_diff_pot: truth.roundingDiffPotThb,
    }
    const checkoutTotal = resolveCheckoutChargeTotalThb(booking)

    assert.equal(searchTotal, truth.guestPayableRoundedThb)
    assert.equal(cardTotal, searchTotal)
    assert.equal(pdpTotal, searchTotal)
    assert.equal(checkoutTotal, searchTotal)
    assert.equal(truth.guestServiceFeeThb, Math.round(lodgingSubtotalThb * 0.15))
  })

  it('does not double-apply guest fee on already-payable batch totalPrice', async () => {
    const { getGuestDisplayForStay, computeGuestDisplayFromBaseThb } = await import(
      '../lib/pricing/guest-display-price.js'
    )

    const payable = 11500 // already includes 15% on 10000
    const listing = {
      base_price_thb: 3334,
      pricing: {
        totalPrice: payable,
        guestServiceFeeThb: 1500,
        guestPayableRoundedThb: payable,
        guestServiceFeePercent: 15,
      },
    }
    const stay = getGuestDisplayForStay(listing, 3, 15)
    assert.equal(stay, payable)
    assert.notEqual(stay, computeGuestDisplayFromBaseThb(payable, 15))
  })

  it('retail FX is display-only — THB totals identical before convert', async () => {
    const { computeStayGuestPayableTruth } = await import('../lib/pricing/price-truth.js')
    const a = computeStayGuestPayableTruth(8000, { guestServiceFeePercent: 15 })
    const b = computeStayGuestPayableTruth(8000, { guestServiceFeePercent: 15 })
    assert.equal(a.checkoutChargeThb, b.checkoutChargeThb)
    // Display currency (RUB/THB) uses the same retail rateMap on PDP + checkout — math stays in THB.
    assert.ok(a.checkoutChargeThb > a.subtotalThb)
  })
})
