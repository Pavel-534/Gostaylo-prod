/**
 * Client-safe L1 asset reader (Stage 200.86).
 * Do not import listing-base-price-canon from client components — it pulls FX/server graph.
 */

import { normalizeCurrencyCode } from '@/lib/finance/currency-codes'

/**
 * @param {object | null | undefined} listingOrMetadata
 * @returns {{ amount: number, currency: string, rate_thb_per_unit_mid: number, converted_at: string } | null}
 */
export function readBasePriceAssetFromListing(listingOrMetadata) {
  const meta =
    listingOrMetadata?.metadata && typeof listingOrMetadata.metadata === 'object'
      ? listingOrMetadata.metadata
      : listingOrMetadata && typeof listingOrMetadata === 'object' && listingOrMetadata.base_price_asset
        ? listingOrMetadata
        : null
  const asset = meta?.base_price_asset
  if (!asset || typeof asset !== 'object') {
    // Camel API shape (partner list / wizard preview)
    const camel = listingOrMetadata?.basePriceAsset
    if (camel && typeof camel === 'object') {
      const amount = Number(camel.amount)
      if (!Number.isFinite(amount) || amount < 0) return null
      const currency = normalizeCurrencyCode(camel.currency || 'THB', 'THB')
      const rate = Number(camel.rateThbPerUnitMid ?? camel.rate_thb_per_unit_mid)
      return {
        amount: Math.round(amount * 100) / 100,
        currency,
        rate_thb_per_unit_mid: Number.isFinite(rate) && rate > 0 ? rate : currency === 'THB' ? 1 : rate,
        converted_at: typeof camel.convertedAt === 'string' ? camel.convertedAt : typeof camel.converted_at === 'string' ? camel.converted_at : '',
      }
    }
    return null
  }
  const amount = Number(asset.amount)
  if (!Number.isFinite(amount) || amount < 0) return null
  const currency = normalizeCurrencyCode(asset.currency || 'THB', 'THB')
  const rate = Number(asset.rate_thb_per_unit_mid)
  return {
    amount: Math.round(amount * 100) / 100,
    currency,
    rate_thb_per_unit_mid: Number.isFinite(rate) && rate > 0 ? rate : currency === 'THB' ? 1 : rate,
    converted_at: typeof asset.converted_at === 'string' ? asset.converted_at : '',
  }
}
