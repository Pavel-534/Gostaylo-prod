/**
 * SSOT: listing L1 (partner asking price) for ops / admin / Telegram / partner cards.
 *
 * Never pair ledger `base_price_thb` with `listings.base_currency`.
 * That produced admin TG lines like «873 RUB/день» when 873 was THB mid.
 *
 * Layers (do not mix):
 * - L1 this file — partner nightly in listing currency
 * - L2 guest catalog — `lib/pricing/same-currency-guest-display.js` (L1 × guest fee)
 * - Booking guest notify — `formatBookingAmountForNotify` → snapshot pay currency
 * - L3 ledger / partner net — THB mid, labeled THB only
 *
 * @see docs/CURRENCY_FX_SSOT.md
 */

import { formatNativeAmountInCurrency, formatThbAmountAsCode } from '@/lib/currency.js'
import { readBasePriceAssetFromListing } from '@/lib/listing/read-base-price-asset.js'

/**
 * @param {Record<string, unknown> | null | undefined} listing
 * @param {string} [language='ru']
 * @returns {{
 *   primary: string,
 *   currency: string,
 *   amount: number,
 *   isLedgerFallback: boolean,
 *   ledgerThb: number,
 * }}
 */
export function resolveListingL1PriceDisplay(listing, language = 'ru') {
  const ledger = Number(listing?.base_price_thb ?? listing?.basePriceThb ?? 0)
  const ledgerThb = Number.isFinite(ledger) ? ledger : 0
  const asset = readBasePriceAssetFromListing(listing)

  if (asset && Number.isFinite(asset.amount)) {
    return {
      primary: formatNativeAmountInCurrency(asset.amount, asset.currency, language),
      currency: asset.currency,
      amount: asset.amount,
      isLedgerFallback: false,
      ledgerThb,
    }
  }

  return {
    primary: formatThbAmountAsCode(ledgerThb, language),
    currency: 'THB',
    amount: ledgerThb,
    isLedgerFallback: true,
    ledgerThb,
  }
}

/**
 * One line for Telegram / email (optional /день).
 * @param {Record<string, unknown> | null | undefined} listing
 * @param {string} [language]
 * @param {{ perDay?: boolean }} [opts]
 */
export function formatListingL1PriceLine(listing, language = 'ru', opts = {}) {
  const { primary } = resolveListingL1PriceDisplay(listing, language)
  if (!opts.perDay) return primary
  const suffix = String(language || 'ru').toLowerCase().startsWith('ru') ? '/день' : '/day'
  return `${primary}${suffix}`
}
