/**
 * Stage 200.88 — FX markup matrix: same-currency = 0; cross-currency = profile %.
 * Covers pay=THB × base≠THB (previously skipped) and partner-netto invariance.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-88-fx-markup-cross-currency.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { computeFinalBreakdown } from '../lib/pricing-engine/compute-breakdown.js'
import {
  fxMarkupExtraThbFromFinalBreakdown,
  resolveBookingPricePaidFields,
  resolveGuestLedgerTotalThbFromFinalBreakdown,
} from '../lib/pricing-engine/guest-fx-charge.js'
import { expectedPaymentIntentAmountThbFromBooking } from '../lib/services/booking/checkout-promo-amounts.js'
import { resolveCaptureGuestTotalThb } from '../lib/services/ledger/ledger-capture-legs.js'

const PROFILE = {
  id: 'pp-test-fx',
  guest_fee_pct: 5,
  host_fee_pct: 15,
  ru_agent_share_pct: 2,
  kr_service_share_pct: 3,
  insurance_fund_pct: 0,
  tax_rate_pct: 0,
  fx_markup_pct: 3,
}

const RAW_MAP = { THB: 1, RUB: 0.4, USD: 35, EUR: 38 }

function breakdown(paymentCurrency, listingBaseCurrency, subtotal = 1000) {
  return computeFinalBreakdown({
    profile: PROFILE,
    subtotal_thb: subtotal,
    payment_currency: paymentCurrency,
    listing_base_currency: listingBaseCurrency,
    raw_fx_rate_map: RAW_MAP,
  })
}

describe('Stage 200.88 — FX markup currency matrix', () => {
  it('same-currency pairs: no FX markup (THB/THB, RUB/RUB, USD/USD)', () => {
    for (const cur of ['THB', 'RUB', 'USD']) {
      const b = breakdown(cur, cur)
      assert.equal(b.fx_markup_thb, 0, `${cur}/${cur}`)
      assert.equal(b.total_partner_netto_thb, 850)
      assert.equal(b.total_guest_payable_rounded_thb, 1050)
      if (cur === 'THB') {
        assert.equal(b.total_guest_brutto.amount, 1050)
        assert.equal(b.total_guest_brutto.currency, 'THB')
      } else {
        assert.equal(b.total_guest_brutto.currency, cur)
        // same currency → customer rate = raw (no worse rate)
        assert.equal(b.fx_customer_rate_to_thb, RAW_MAP[cur])
      }
    }
  })

  it('TH listing + RUB pay: markup > 0 (classic inbound)', () => {
    const b = breakdown('RUB', 'THB')
    assert.ok(b.fx_markup_thb > 0)
    assert.equal(b.fx_markup_thb, 31.5) // 1050 * 3%
    assert.equal(b.total_partner_netto_thb, 850)
    assert.equal(b.total_guest_payable_rounded_thb, 1050)
    assert.equal(b.total_guest_brutto.currency, 'RUB')
    assert.ok(b.total_guest_brutto.amount > 1050 / RAW_MAP.RUB)
  })

  it('RU listing + THB pay: markup > 0 and brutto THB = mid + fx (the prior gap)', () => {
    const b = breakdown('THB', 'RUB')
    assert.equal(b.fx_markup_thb, 32) // Math.round(1050 * 0.03)
    assert.equal(b.total_partner_netto_thb, 850)
    assert.equal(b.total_guest_payable_rounded_thb, 1050)
    assert.equal(b.total_guest_brutto.currency, 'THB')
    assert.equal(b.total_guest_brutto.amount, 1082)
    assert.equal(fxMarkupExtraThbFromFinalBreakdown(b), 32)
    assert.equal(resolveGuestLedgerTotalThbFromFinalBreakdown(b), 1082)
  })

  it('RU listing + USD pay / USD listing + RUB pay / EUR listing + THB pay: markup applies', () => {
    const rubUsd = breakdown('USD', 'RUB')
    assert.ok(rubUsd.fx_markup_thb > 0)
    assert.equal(rubUsd.total_partner_netto_thb, 850)

    const usdRub = breakdown('RUB', 'USD')
    assert.ok(usdRub.fx_markup_thb > 0)
    assert.equal(usdRub.total_partner_netto_thb, 850)

    const eurThb = breakdown('THB', 'EUR')
    assert.equal(eurThb.fx_markup_thb, 32)
    assert.equal(eurThb.total_guest_brutto.amount, 1082)
    assert.equal(eurThb.total_partner_netto_thb, 850)
  })

  it('partner netto never reduced by FX vs same mid subtotal', () => {
    const domestic = breakdown('RUB', 'RUB')
    const crossThb = breakdown('THB', 'RUB')
    const crossUsd = breakdown('USD', 'RUB')
    assert.equal(domestic.total_partner_netto_thb, crossThb.total_partner_netto_thb)
    assert.equal(domestic.total_partner_netto_thb, crossUsd.total_partner_netto_thb)
  })

  it('price_paid fields: THB cross uses brutto; RUB cross keeps mid THB charge book', () => {
    const thbCross = breakdown('THB', 'RUB')
    const paidThb = resolveBookingPricePaidFields({
      paymentCurrency: 'THB',
      roundedGuestTotalThb: thbCross.total_guest_payable_rounded_thb,
      exchangeRateToThb: 1,
      finalBreakdown: thbCross,
    })
    assert.equal(paidThb.pricePaid, 1082)
    assert.equal(paidThb.exchangeRate, 1)
    assert.equal(paidThb.guestChargeThb, 1082)

    const rubCross = breakdown('RUB', 'THB')
    const customerRate = RAW_MAP.RUB / 1.03
    const paidRub = resolveBookingPricePaidFields({
      paymentCurrency: 'RUB',
      roundedGuestTotalThb: rubCross.total_guest_payable_rounded_thb,
      exchangeRateToThb: customerRate,
      finalBreakdown: rubCross,
    })
    assert.equal(paidRub.pricePaid, rubCross.total_guest_brutto.amount)
    assert.equal(paidRub.guestChargeThb, 1050)
  })

  it('payment intent amount includes THB FX extra; wallet column sum preserved', () => {
    const b = breakdown('THB', 'RUB')
    const booking = {
      price_thb: 1000,
      commission_thb: 50,
      rounding_diff_pot: 0,
      pricing_snapshot: { v: 2, final_breakdown: b },
    }
    assert.equal(expectedPaymentIntentAmountThbFromBooking(booking), 1050 + 32)

    const withWallet = {
      ...booking,
      commission_thb: 30, // wallet took 20 from guest fee
    }
    assert.equal(expectedPaymentIntentAmountThbFromBooking(withWallet), 1030 + 32)
  })

  it('ledger capture guest total includes THB FX; legs leave partner untouched', async () => {
    const b = breakdown('THB', 'RUB')
    const booking = {
      partner_earnings_thb: b.total_partner_netto_thb,
      pricing_snapshot: { v: 2, final_breakdown: b },
    }
    assert.equal(resolveCaptureGuestTotalThb(booking), 1082)

    const { computeBookingPaymentLedgerLegsV2 } = await import(
      '../lib/services/ledger/ledger-capture-legs.js'
    )
    const legs = computeBookingPaymentLedgerLegsV2(booking)
    assert.equal(legs.partnerThb, 850)
    assert.equal(legs.fxMarkupThb, 32)
    assert.equal(legs.guestTotalThb, 1082)
    const sumCr =
      legs.partnerThb +
      legs.insuranceThb +
      legs.roundingThb +
      legs.ruFeeThb +
      legs.krFeeThb +
      legs.fxMarkupThb +
      legs.platformHostFeeThb
    assert.ok(Math.abs(sumCr - legs.guestTotalThb) <= 0.02)
  })
})
