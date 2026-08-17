/**
 * Stage 200.32 — partner listing price display (ADR-181 L1 asset primary).
 * Ledger `base_price_thb` is accounting; partner UI primary = asset currency amount.
 * Missing asset → THB ledger labeled THB (never THB number + RUB code).
 */

import { readBasePriceAssetFromListing } from '@/lib/listing/read-base-price-asset.js'

/**
 * @param {{
 *   basePriceThb?: number|null
 *   baseCurrency?: string|null
 *   basePriceAsset?: { amount?: number|null, currency?: string|null }|null
 *   metadata?: object|null
 * }} row
 * @returns {{
 *   ledgerThb: number
 *   primaryAmount: number
 *   primaryCurrency: string
 *   hasAssetAmount: boolean
 * }}
 */
export function resolvePartnerListingPriceParts(row = {}) {
  const ledgerThbRaw = Number(row.basePriceThb ?? row.base_price_thb ?? 0)
  const ledgerThb = Number.isFinite(ledgerThbRaw) ? ledgerThbRaw : 0
  const asset = readBasePriceAssetFromListing(row)
  const assetAmount = asset?.amount != null ? Number(asset.amount) : NaN
  const fromAssetCurrency = asset?.currency ? String(asset.currency).toUpperCase() : ''
  const baseCurrency = String(
    row.baseCurrency || row.base_currency || fromAssetCurrency || 'THB',
  )
    .toUpperCase()
    .slice(0, 8)

  if (Number.isFinite(assetAmount) && assetAmount > 0) {
    return {
      ledgerThb,
      primaryAmount: assetAmount,
      primaryCurrency: fromAssetCurrency || baseCurrency || 'THB',
      hasAssetAmount: true,
    }
  }

  // Stale L1 `{amount:0,...}` from draft-before-country — ledger THB only, never fake RUB.
  if (Number.isFinite(assetAmount) && assetAmount === 0 && ledgerThb > 0) {
    return {
      ledgerThb,
      primaryAmount: ledgerThb,
      primaryCurrency: 'THB',
      hasAssetAmount: false,
    }
  }

  if (Number.isFinite(assetAmount) && assetAmount >= 0) {
    return {
      ledgerThb,
      primaryAmount: assetAmount,
      primaryCurrency: fromAssetCurrency || baseCurrency || 'THB',
      hasAssetAmount: true,
    }
  }

  return {
    ledgerThb,
    primaryAmount: ledgerThb,
    primaryCurrency: 'THB',
    hasAssetAmount: false,
  }
}
