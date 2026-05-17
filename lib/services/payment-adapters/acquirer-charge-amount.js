/**
 * SSOT: сумма и валюта для запроса к эквайеру (Stage 100.3).
 * Ledger / escrow остаются в THB (`payment_intents.amount_thb`).
 *
 * Env:
 * - `PAYMENT_ACQUIRER_RUB_ENABLED` — `0` = legacy THB в запросе (только shadow-log); иначе RUB для MIR_RU.
 * - `PAYMENT_ACQUIRER_RUB_SHADOW` — `1` = логировать расчёт RUB, но отправлять legacy THB (staging).
 */

import { logStructured } from '@/lib/critical-telemetry.js'

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

export function isAcquirerRubEnabled() {
  return String(process.env.PAYMENT_ACQUIRER_RUB_ENABLED || '1').trim() !== '0'
}

export function isAcquirerRubShadowMode() {
  return String(process.env.PAYMENT_ACQUIRER_RUB_SHADOW || '').trim() === '1'
}

/**
 * @param {object} booking
 * @returns {import('./acquirer-charge-amount').GuestBrutto | null}
 */
export function readGuestBruttoFromBooking(booking) {
  const snap = booking?.pricing_snapshot
  if (!snap || typeof snap !== 'object') return null

  const fb = snap.final_breakdown && typeof snap.final_breakdown === 'object' ? snap.final_breakdown : null
  const rubDirect = Number(fb?.guest_total_rub ?? snap?.guest_total_rub)
  if (Number.isFinite(rubDirect) && rubDirect > 0) {
    return {
      amount: round2(rubDirect),
      currency: 'RUB',
      source: 'pricing_snapshot.guest_total_rub',
    }
  }
  const brutto = fb?.total_guest_brutto
  if (brutto && typeof brutto === 'object' && Number(brutto.amount) > 0 && brutto.currency) {
    return {
      amount: round2(brutto.amount),
      currency: String(brutto.currency).toUpperCase(),
      source: 'pricing_snapshot.final_breakdown.total_guest_brutto',
    }
  }

  const legacyBrutto = snap.total_guest_brutto
  if (legacyBrutto && typeof legacyBrutto === 'object' && Number(legacyBrutto.amount) > 0) {
    return {
      amount: round2(legacyBrutto.amount),
      currency: String(legacyBrutto.currency || 'THB').toUpperCase(),
      source: 'pricing_snapshot.total_guest_brutto',
    }
  }

  return null
}

/**
 * Locked FX at booking create: price_paid (display) × exchange_rate → THB.
 * @param {object} booking
 */
export function readRubFromBookingLockedRate(booking) {
  const cur = String(booking?.currency || '').toUpperCase()
  const paid = Number(booking?.price_paid)
  if (cur === 'RUB' && Number.isFinite(paid) && paid > 0) {
    return {
      amount: round2(paid),
      currency: 'RUB',
      source: 'booking.price_paid_locked',
    }
  }
  return null
}

/**
 * @param {object} booking
 * @param {number} amountThb
 */
export function deriveRubFromSnapshotFx(booking, amountThb) {
  const snap = booking?.pricing_snapshot
  const fb = snap?.final_breakdown
  const rate = Number(fb?.fx_customer_rate_to_thb ?? fb?.fx_raw_rate_to_thb)
  const thb = Number(amountThb)
  if (Number.isFinite(rate) && rate > 0 && Number.isFinite(thb) && thb > 0) {
    return {
      amount: round2(thb / rate),
      currency: 'RUB',
      source: 'pricing_snapshot.fx_customer_rate_to_thb',
    }
  }
  return null
}

/**
 * @param {{ booking?: object | null, intent?: { amountThb?: number } | null, adapterKey?: string }} params
 * @returns {{
 *   amount: number,
 *   currency: string,
 *   amountThb: number,
 *   source: string,
 *   acquirerCurrency: string,
 *   acquirerAmount: number,
 * }}
 */
export function resolveAcquirerChargeAmount({ booking = null, intent = null, adapterKey = '' }) {
  const key = String(adapterKey || '').toUpperCase()
  const amountThb = Math.round(Number(intent?.amountThb || 0))

  const legacyThb = {
    amount: amountThb,
    currency: 'THB',
    amountThb,
    source: 'intent.amount_thb',
    acquirerCurrency: 'THB',
    acquirerAmount: amountThb,
  }

  if (key !== 'MIR_RU' && key !== 'CARD_INTL') {
    return legacyThb
  }

  const rubRequired = key === 'MIR_RU'
  const rubOptionalForIntl =
    key === 'CARD_INTL' &&
    (String(booking?.currency || '').toUpperCase() === 'RUB' ||
      readGuestBruttoFromBooking(booking)?.currency === 'RUB')

  if (!rubRequired && !rubOptionalForIntl) {
    return legacyThb
  }

  if (!isAcquirerRubEnabled()) {
    logStructured({
      module: 'acquirer-charge-amount',
      stage: 'rub_disabled_legacy_thb',
      adapterKey: key,
      amountThb,
      bookingId: booking?.id || null,
    })
    return legacyThb
  }

  const brutto = readGuestBruttoFromBooking(booking)
  let rubCharge = null
  if (brutto?.currency === 'RUB') {
    rubCharge = brutto
  } else {
    rubCharge = readRubFromBookingLockedRate(booking) || deriveRubFromSnapshotFx(booking, amountThb)
  }

  if (!rubCharge || rubCharge.currency !== 'RUB' || !(rubCharge.amount > 0)) {
    if (rubRequired) {
      const err = new Error('ACQUIRER_RUB_AMOUNT_UNAVAILABLE')
      err.code = 'ACQUIRER_RUB_AMOUNT_UNAVAILABLE'
      err.details = { bookingId: booking?.id, amountThb, adapterKey: key }
      throw err
    }
    return legacyThb
  }

  const shadow = isAcquirerRubShadowMode()
  const resolved = {
    amount: rubCharge.amount,
    currency: 'RUB',
    amountThb,
    source: rubCharge.source,
    acquirerCurrency: shadow ? 'THB' : 'RUB',
    acquirerAmount: shadow ? amountThb : rubCharge.amount,
  }

  if (shadow) {
    logStructured({
      module: 'acquirer-charge-amount',
      stage: 'rub_shadow_compare',
      adapterKey: key,
      wouldChargeRub: rubCharge.amount,
      sentThb: amountThb,
      source: rubCharge.source,
      bookingId: booking?.id || null,
    })
  }

  return resolved
}

/**
 * Webhook amount check against snapshot-locked acquirer charge (RUB or THB).
 * @returns {{ ok: true } | { ok: false, error: string, expected: object, received: object }}
 */
export function verifyWebhookPaidAmount({ receivedAmount, receivedCurrency, booking, intent, adapterKey }) {
  const received = round2(receivedAmount)
  const rc = String(receivedCurrency || 'THB').toUpperCase()
  if (!Number.isFinite(received) || received <= 0) {
    return { ok: true, skipped: true }
  }

  let expected
  try {
    expected = resolveAcquirerChargeAmount({ booking, intent, adapterKey })
  } catch (e) {
    if (rc === 'THB') {
      const expectedThb = Number(intent?.amountThb || 0)
      const tol = 1.0
      if (Math.abs(received - expectedThb) > tol) {
        return {
          ok: false,
          error: 'AMOUNT_MISMATCH',
          expected: { amount: expectedThb, currency: 'THB' },
          received: { amount: received, currency: rc },
        }
      }
      return { ok: true }
    }
    return { ok: false, error: e.code || 'ACQUIRER_RUB_AMOUNT_UNAVAILABLE', expected: null, received: { amount: received, currency: rc } }
  }

  const expCur = String(expected.acquirerCurrency || expected.currency).toUpperCase()
  const expAmt = round2(expected.acquirerAmount ?? expected.amount)
  const tol = expCur === 'RUB' ? 1.0 : 1.0

  if (rc === expCur) {
    if (Math.abs(received - expAmt) <= tol) return { ok: true }
    return {
      ok: false,
      error: 'AMOUNT_MISMATCH',
      expected: { amount: expAmt, currency: expCur },
      received: { amount: received, currency: rc },
    }
  }

  if (rc === 'RUB' && expCur === 'THB' && isAcquirerRubShadowMode()) {
    return { ok: true, shadowLegacy: true }
  }

  if (rc === 'THB' && expCur === 'RUB') {
    const expectedThb = Number(intent?.amountThb || expected.amountThb || 0)
    if (Math.abs(received - expectedThb) <= tol) return { ok: true, legacyWebhookThb: true }
  }

  return {
    ok: false,
    error: 'CURRENCY_MISMATCH',
    expected: { amount: expAmt, currency: expCur },
    received: { amount: received, currency: rc },
  }
}
