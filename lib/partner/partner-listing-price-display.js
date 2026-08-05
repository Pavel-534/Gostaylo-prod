/**
 * Stage 200.32 — partner listing price display (ADR-181 L1 asset primary).
 * Ledger `base_price_thb` is accounting; partner UI primary = asset currency amount.
 */

/**
 * @param {{
 *   basePriceThb?: number|null
 *   baseCurrency?: string|null
 *   basePriceAsset?: { amount?: number|null, currency?: string|null }|null
 * }} row
 * @returns {{
 *   ledgerThb: number
 *   primaryAmount: number
 *   primaryCurrency: string
 *   hasAssetAmount: boolean
 * }}
 */
export function resolvePartnerListingPriceParts(row = {}) {
  const ledgerThb = Number(row.basePriceThb ?? row.base_price_thb ?? 0)
  const asset = row.basePriceAsset || row.base_price_asset || null
  const assetAmount = asset?.amount != null ? Number(asset.amount) : NaN
  const fromAssetCurrency = asset?.currency ? String(asset.currency).toUpperCase() : ''
  const baseCurrency = String(
    row.baseCurrency || row.base_currency || fromAssetCurrency || 'THB',
  )
    .toUpperCase()
    .slice(0, 8)

  if (Number.isFinite(assetAmount) && assetAmount >= 0) {
    return {
      ledgerThb: Number.isFinite(ledgerThb) ? ledgerThb : 0,
      primaryAmount: assetAmount,
      primaryCurrency: fromAssetCurrency || baseCurrency || 'THB',
      hasAssetAmount: true,
    }
  }

  return {
    ledgerThb: Number.isFinite(ledgerThb) ? ledgerThb : 0,
    primaryAmount: Number.isFinite(ledgerThb) ? ledgerThb : 0,
    primaryCurrency: baseCurrency || 'THB',
    hasAssetAmount: false,
  }
}
