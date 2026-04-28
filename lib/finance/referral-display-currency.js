/**
 * Allowed codes for `profiles.referral_display_currency` (subset of display FX in CurrencyService).
 */
export const REFERRAL_DISPLAY_CURRENCY_CODES = [
  'THB',
  'USD',
  'EUR',
  'GBP',
  'RUB',
  'CNY',
  'USDT',
]

/** @param {unknown} raw */
export function normalizeReferralDisplayCurrency(raw) {
  const c = String(raw || 'THB')
    .toUpperCase()
    .trim()
    .slice(0, 8)
  return REFERRAL_DISPLAY_CURRENCY_CODES.includes(c) ? c : 'THB'
}
