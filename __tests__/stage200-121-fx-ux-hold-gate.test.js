/**
 * Stage 200.121 — FX UX gaps + checkout hold initiate gate (no PricingEngine/ledger math).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-121-fx-ux-hold-gate.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assertCheckoutHoldAllowsPaymentInitiate } from '@/lib/booking/checkout-hold-initiate-gate.js'
import { estimateRefundInGuestPaymentCurrency } from '@/lib/booking/guest-refund-display.js'
import { resolveGuestPayInitiateI18nKey } from '@/lib/checkout/guest-pay-error-messages.js'

const root = process.cwd()

describe('Stage 200.121 — FX UX + checkout hold gate', () => {
  it('issuer fee disclaimer i18n present for CARD/MIR locales', () => {
    const src = readFileSync(join(root, 'lib/translations/checkout.js'), 'utf8')
    const count = (src.match(/checkout_issuerFeeDisclaimer:/g) || []).length
    assert.ok(count >= 4, `expected 4 locale keys, got ${count}`)
    assert.ok(src.includes('{{amount}}'))
    const toastCount = (src.match(/checkout_toast_holdExpired:/g) || []).length
    assert.ok(toastCount >= 4, `expected holdExpired toast in 4 locales, got ${toastCount}`)
  })

  it('PaymentMethods renders issuer disclaimer under pay CTA', () => {
    const src = readFileSync(
      join(root, 'app/(storefront)/checkout/[bookingId]/components/PaymentMethods.jsx'),
      'utf8',
    )
    assert.ok(src.includes('checkout-issuer-fee-disclaimer'))
    assert.ok(src.includes('checkout_issuerFeeDisclaimer'))
    assert.ok(src.includes("paymentMethod === 'CARD'") || src.includes('paymentMethod === "CARD"'))
    assert.ok(src.includes("paymentMethod === 'MIR'") || src.includes('paymentMethod === "MIR"'))
  })

  it('cancel dialog uses guest payment currency refund fields', () => {
    const src = readFileSync(join(root, 'components/renter/cancel-booking-dialog.jsx'), 'utf8')
    assert.ok(src.includes('formatGuestPaymentDisplayAmount'))
    assert.ok(src.includes('refundGuestCurrency'))
    assert.ok(src.includes('renterCancel_refundThbSecondary'))
    const i18n = readFileSync(join(root, 'lib/translations/listings-public.js'), 'utf8')
    assert.ok((i18n.match(/renterCancel_refundThbSecondary:/g) || []).length >= 4)
  })

  it('payment initiate route wires checkout hold gate', () => {
    const src = readFileSync(
      join(root, 'app/api/v2/bookings/[id]/payment/initiate/route.js'),
      'utf8',
    )
    assert.ok(src.includes('assertCheckoutHoldAllowsPaymentInitiate'))
    assert.ok(src.includes('holdGate'))
  })

  it('estimateRefundInGuestPaymentCurrency scales locked RUB brutto', () => {
    const booking = {
      currency: 'RUB',
      price_paid: 25000,
      pricing_snapshot: {
        final_breakdown: {
          total_guest_brutto: { amount: 25000, currency: 'RUB' },
          total_guest_payable_rounded_thb: 10000,
        },
      },
    }
    const full = estimateRefundInGuestPaymentCurrency({
      booking,
      refundGuestThb: 10000,
      guestTotalThb: 10000,
      language: 'en',
    })
    assert.equal(full.currency, 'RUB')
    assert.equal(full.amount, 25000)

    const half = estimateRefundInGuestPaymentCurrency({
      booking,
      refundGuestThb: 5000,
      guestTotalThb: 10000,
      language: 'en',
    })
    assert.equal(half.currency, 'RUB')
    assert.equal(half.amount, 12500)
    assert.equal(half.refundGuestThb, 5000)
  })

  it('assertCheckoutHoldAllowsPaymentInitiate blocks expired hold', () => {
    const nowMs = Date.parse('2026-08-12T12:00:00.000Z')
    const blocked = assertCheckoutHoldAllowsPaymentInitiate({
      booking: {
        created_at: '2026-08-12T10:00:00.000Z',
        metadata: {
          checkout_hold_expires_at: '2026-08-12T11:00:00.000Z',
        },
      },
      nowMs,
    })
    assert.equal(blocked.ok, false)
    assert.equal(blocked.code, 'CHECKOUT_HOLD_EXPIRED')
    assert.equal(blocked.status, 410)

    const fresh = assertCheckoutHoldAllowsPaymentInitiate({
      booking: {
        created_at: '2026-08-12T11:50:00.000Z',
        metadata: {
          checkout_hold_expires_at: '2026-08-12T12:20:00.000Z',
        },
      },
      nowMs,
    })
    assert.equal(fresh.ok, true)
  })

  it('maps CHECKOUT_HOLD_EXPIRED to guest toast key', () => {
    assert.equal(
      resolveGuestPayInitiateI18nKey({ code: 'CHECKOUT_HOLD_EXPIRED' }),
      'checkout_toast_holdExpired',
    )
    assert.equal(
      resolveGuestPayInitiateI18nKey({ code: 'INVOICE_PAYMENT_WINDOW_EXPIRED' }),
      'checkout_toast_holdExpired',
    )
  })
})
