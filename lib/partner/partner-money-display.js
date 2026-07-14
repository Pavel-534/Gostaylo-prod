/**
 * Stage 186.0 Phase 0 — SSOT partner finance amount formatting (display + payout rail).
 * Ledger buckets: convert THB via mid FX (`usePartnerHostDisplayFx`).
 * Payout rail: server `amountInPayoutCurrency` — never lone ₮ for USDT.
 */

import { formatPrice, getCurrencySymbol, languageToNumberLocale } from '@/lib/currency'

/** ISO codes where symbol-only is ambiguous — append code (USDT ≠ MNT tugrik ₮). */
const AMOUNT_CODE_SUFFIX = new Set(['USDT'])

/**
 * @param {string} [code]
 * @returns {string}
 */
export function getCurrencySymbolSafe(code) {
  return getCurrencySymbol(code)
}

/**
 * Format amount already denominated in `currencyCode` (not THB conversion).
 * @param {number} amount
 * @param {string} [currencyCode]
 * @param {string} [language]
 */
export function formatAbsoluteAmountInCurrency(amount, currencyCode, language = 'en') {
  const cur = String(currencyCode || 'THB').toUpperCase()
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'

  if (cur === 'THB') {
    return formatPrice(n, 'THB', { THB: 1 }, language)
  }

  const loc = languageToNumberLocale(language)
  const maxFrac = cur === 'JPY' ? 0 : 2
  const rounded = Math.round(n * 10 ** maxFrac) / 10 ** maxFrac
  const formatted = rounded.toLocaleString(loc, {
    minimumFractionDigits: cur === 'USD' || cur === 'USDT' ? 2 : 0,
    maximumFractionDigits: maxFrac,
  })

  if (AMOUNT_CODE_SUFFIX.has(cur)) {
    return `${formatted} ${cur}`
  }

  const symbol = getCurrencySymbol(cur)
  return `${symbol}${formatted}`
}

/** Payout rail line (USDT TRC20, RUB bank, …). */
export function formatPayoutRailAmount(amount, currencyCode, language = 'en') {
  return formatAbsoluteAmountInCurrency(amount, currencyCode, language)
}

/** @deprecated use formatAbsoluteAmountInCurrency — kept for import stability */
export function formatServerPayoutAmount(amount, currencyCode, language = 'ru') {
  return formatAbsoluteAmountInCurrency(amount, currencyCode, language)
}
