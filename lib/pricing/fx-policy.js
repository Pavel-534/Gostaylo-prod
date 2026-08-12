/**
 * Stage 200.115 — Pure FX policy helpers (display vs checkout). No I/O, no ledger writes.
 *
 * Two independent markups (do not mix):
 * 1) Retail storefront — `chatInvoiceRateMultiplier` on THB→non-THB display rates.
 * 2) Checkout FX — `pricing_profiles.fx_markup_pct` when payment_currency ≠ listing_base_currency.
 *
 * @see docs/CURRENCY_FX_SSOT.md
 */

import {
  BOOKING_PAYMENT_CURRENCIES,
  normalizeCurrencyCode,
} from '@/lib/finance/currency-codes.js'

/**
 * @param {string | null | undefined} a
 * @param {string | null | undefined} b
 * @returns {boolean}
 */
export function isSameCurrencyCode(a, b) {
  const left = normalizeCurrencyCode(a, '')
  const right = normalizeCurrencyCode(b, '')
  if (!left || !right) return false
  return left === right
}

/**
 * Checkout / PricingEngine: apply `fx_markup_pct` when guest pays in a different currency than listing L1.
 * @param {string | null | undefined} paymentCurrency
 * @param {string | null | undefined} listingBaseCurrency
 */
export function shouldApplyCheckoutFxMarkup(paymentCurrency, listingBaseCurrency) {
  const pay = normalizeCurrencyCode(paymentCurrency, '')
  const base = normalizeCurrencyCode(listingBaseCurrency, '')
  if (!pay || !base) return false
  return pay !== base
}

/**
 * Catalog / header FX: retail markup is applied when converting THB → this UI currency.
 * THB itself is never retail-marked (amount is already in ledger hub units).
 * @param {string | null | undefined} displayCurrency
 */
export function shouldApplyRetailDisplayMarkup(displayCurrency) {
  const ui = normalizeCurrencyCode(displayCurrency, 'THB')
  return ui !== 'THB'
}

/**
 * UI currency === listing base → show L1 × guest fee without retail round-trip
 * (and checkout FX would be 0 if guest also pays in that currency).
 */
export function isSameCurrencyGuestDisplay(displayCurrency, listingBaseCurrency) {
  return isSameCurrencyCode(displayCurrency, listingBaseCurrency)
}

/**
 * Whether this code can be used as booking.payment / acquirer charge currency today.
 */
export function isPayableBookingCurrency(code) {
  const c = normalizeCurrencyCode(code, '')
  return BOOKING_PAYMENT_CURRENCIES.includes(c)
}

/**
 * Listing may be priced in EUR/GBP/… but guest must pick a payable currency at checkout.
 * Same-currency settlement (pay === base) is impossible when base ∉ BOOKING_PAYMENT_CURRENCIES.
 */
export function canSettleSameCurrencyWithoutCheckoutFx(listingBaseCurrency) {
  const base = normalizeCurrencyCode(listingBaseCurrency, '')
  return Boolean(base) && BOOKING_PAYMENT_CURRENCIES.includes(base)
}

/**
 * Human-oriented matrix row for docs/tests.
 * @returns {{
 *   checkoutFx: boolean,
 *   retailOnDisplay: boolean,
 *   sameCurrencyDisplay: boolean,
 *   canPayInListingCurrency: boolean,
 * }}
 */
export function describeFxForCurrencies({
  listingBaseCurrency,
  displayCurrency,
  paymentCurrency,
}) {
  const base = normalizeCurrencyCode(listingBaseCurrency, 'THB')
  const display = normalizeCurrencyCode(displayCurrency, 'THB')
  const pay = normalizeCurrencyCode(paymentCurrency, 'THB')
  return {
    checkoutFx: shouldApplyCheckoutFxMarkup(pay, base),
    retailOnDisplay: shouldApplyRetailDisplayMarkup(display),
    sameCurrencyDisplay: isSameCurrencyGuestDisplay(display, base),
    canPayInListingCurrency: isPayableBookingCurrency(base),
  }
}
