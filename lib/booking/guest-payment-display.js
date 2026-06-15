/**
 * Stage 147.1 — SSOT: guest payment amount + currency from immutable booking snapshot.
 *
 * UI / dispute / acquirer charge read the same locked `pricing_snapshot` values.
 * Fallback chain: snapshot brutto → price_paid + currency → guest payable THB → price_thb.
 *
 * @see lib/services/payment-adapters/acquirer-charge-amount.js — acquirer wiring
 * @see lib/pricing/fx-display.js — live retail FX (not used here)
 */

import { CURRENCIES, languageToNumberLocale } from '@/lib/currency.js'
import { getGuestPayableRoundedThb } from '@/lib/booking-guest-total.js'

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

/**
 * @typedef {{ amount: number, currency: string, source: string }} GuestPaymentRaw
 */

/**
 * @param {object | null | undefined} booking
 * @returns {GuestPaymentRaw | null}
 */
export function readGuestBruttoFromSnapshot(booking) {
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
 * Locked display amount at booking create (`price_paid` + `currency` column).
 * @param {object | null | undefined} booking
 * @returns {GuestPaymentRaw | null}
 */
export function readGuestPaidLockedAmount(booking) {
  const cur = String(booking?.currency || '').toUpperCase()
  const paid = Number(booking?.price_paid)
  if (cur && Number.isFinite(paid) && paid > 0) {
    return {
      amount: round2(paid),
      currency: cur,
      source: 'booking.price_paid_locked',
    }
  }
  return null
}

/**
 * RUB-only locked rate (acquirer MIR_RU fallback).
 * @param {object | null | undefined} booking
 * @returns {GuestPaymentRaw | null}
 */
export function readRubFromBookingLockedRate(booking) {
  const row = readGuestPaidLockedAmount(booking)
  if (row?.currency === 'RUB') return row
  return null
}

/**
 * Derive RUB from THB using snapshot FX (acquirer fallback).
 * @param {object | null | undefined} booking
 * @param {number} amountThb
 * @returns {GuestPaymentRaw | null}
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
 * @param {number} amount
 * @param {string} currency
 * @param {string} [language]
 * @returns {string}
 */
export function formatGuestPaymentDisplayAmount(amount, currency, language = 'ru') {
  const code = String(currency || 'THB').toUpperCase()
  const n = Number(amount)
  if (!Number.isFinite(n) || n <= 0) return '—'

  const info = CURRENCIES.find((c) => c.code === code)
  const symbol = info?.symbol || code
  const locale = languageToNumberLocale(language)
  const digits = code === 'USD' || code === 'USDT' ? 2 : 0
  const formatted = n.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return `${symbol}${formatted}`
}

/**
 * SSOT: guest payment for UI and server-side copy.
 *
 * @param {object | null | undefined} booking
 * @param {{ language?: string }} [opts]
 * @returns {{ currency: string, amount: number, displayAmount: string, source: string } | null}
 */
export function readGuestPaymentDisplay(booking, opts = {}) {
  const language = opts.language || 'ru'

  const brutto = readGuestBruttoFromSnapshot(booking)
  if (brutto?.amount > 0 && brutto.currency) {
    return {
      currency: brutto.currency,
      amount: brutto.amount,
      displayAmount: formatGuestPaymentDisplayAmount(brutto.amount, brutto.currency, language),
      source: brutto.source,
    }
  }

  const locked = readGuestPaidLockedAmount(booking)
  if (locked?.amount > 0 && locked.currency) {
    return {
      currency: locked.currency,
      amount: locked.amount,
      displayAmount: formatGuestPaymentDisplayAmount(locked.amount, locked.currency, language),
      source: locked.source,
    }
  }

  try {
    const thb = getGuestPayableRoundedThb(booking)
    if (thb > 0) {
      const amount = round2(thb)
      return {
        currency: 'THB',
        amount,
        displayAmount: formatGuestPaymentDisplayAmount(amount, 'THB', language),
        source: 'guest_payable_thb_fallback',
      }
    }
  } catch {
    /* fallback */
  }

  const legacy = round2(booking?.price_thb ?? booking?.priceThb ?? 0)
  if (legacy > 0) {
    const currency = String(booking?.currency || 'THB').toUpperCase()
    return {
      currency,
      amount: legacy,
      displayAmount: formatGuestPaymentDisplayAmount(legacy, currency, language),
      source: 'booking.price_thb_fallback',
    }
  }

  return null
}

/** @deprecated Use readGuestBruttoFromSnapshot */
export const readGuestBruttoFromBooking = readGuestBruttoFromSnapshot
