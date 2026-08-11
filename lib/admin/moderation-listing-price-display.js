/**
 * Stage 200.86 — admin moderation price label (L1 asset primary, not hardcoded ฿).
 */

import { formatNativeAmountInCurrency, formatThbAmountAsCode } from '@/lib/currency.js'
import { readBasePriceAssetFromListing } from '@/lib/listing/listing-base-price-canon.js'

/**
 * @param {Record<string, unknown> | null | undefined} listing
 * @param {string} [language='ru']
 * @returns {{ primary: string, currency: string, amount: number, isLedgerFallback: boolean }}
 */
export function resolveModerationListingPriceDisplay(listing, language = 'ru') {
  const asset = readBasePriceAssetFromListing(listing)
  if (asset && Number.isFinite(asset.amount)) {
    return {
      primary: formatNativeAmountInCurrency(asset.amount, asset.currency, language),
      currency: asset.currency,
      amount: asset.amount,
      isLedgerFallback: false,
    }
  }

  const cur = String(listing?.base_currency || listing?.baseCurrency || 'THB')
    .toUpperCase()
    .slice(0, 8)
  const ledger = Number(listing?.base_price_thb ?? listing?.basePriceThb ?? 0)

  if (cur === 'THB' || !cur) {
    return {
      primary: formatThbAmountAsCode(ledger, language),
      currency: 'THB',
      amount: Number.isFinite(ledger) ? ledger : 0,
      isLedgerFallback: true,
    }
  }

  // No asset snapshot yet — show ledger THB as secondary truth, not fake ฿ as L1
  return {
    primary: formatThbAmountAsCode(ledger, language),
    currency: 'THB',
    amount: Number.isFinite(ledger) ? ledger : 0,
    isLedgerFallback: true,
  }
}
