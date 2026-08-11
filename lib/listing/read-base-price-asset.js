/**
 * Client-safe L1 asset reader (Stage 200.86 / 200.96).
 * Do not import listing-base-price-canon from client components — it pulls FX/server graph.
 *
 * Prefer explicit top-level `basePriceAsset` over `metadata.base_price_asset` when both
 * exist (wizard live preview updates form field without rewriting stale metadata).
 */

import { normalizeCurrencyCode } from '@/lib/finance/currency-codes'

/**
 * @param {object | null | undefined} asset
 * @returns {{ amount: number, currency: string, rate_thb_per_unit_mid: number, converted_at: string } | null}
 */
function normalizeAssetShape(asset) {
  if (!asset || typeof asset !== 'object') return null
  const amount = Number(asset.amount)
  if (!Number.isFinite(amount) || amount < 0) return null
  const currency = normalizeCurrencyCode(asset.currency || 'THB', 'THB')
  const rate = Number(
    asset.rate_thb_per_unit_mid ?? asset.rateThbPerUnitMid,
  )
  return {
    amount: Math.round(amount * 100) / 100,
    currency,
    rate_thb_per_unit_mid: Number.isFinite(rate) && rate > 0 ? rate : currency === 'THB' ? 1 : rate,
    converted_at:
      typeof asset.converted_at === 'string'
        ? asset.converted_at
        : typeof asset.convertedAt === 'string'
          ? asset.convertedAt
          : '',
  }
}

/**
 * @param {object | null | undefined} listingOrMetadata
 * @returns {{ amount: number, currency: string, rate_thb_per_unit_mid: number, converted_at: string } | null}
 */
export function readBasePriceAssetFromListing(listingOrMetadata) {
  if (!listingOrMetadata || typeof listingOrMetadata !== 'object') return null

  // Stage 200.96 — live top-level wins over stale metadata (wizard unsaved edits).
  const fromCamel = normalizeAssetShape(listingOrMetadata.basePriceAsset)
  if (fromCamel) return fromCamel

  const meta =
    listingOrMetadata.metadata && typeof listingOrMetadata.metadata === 'object'
      ? listingOrMetadata.metadata
      : listingOrMetadata.base_price_asset
        ? listingOrMetadata
        : null
  return normalizeAssetShape(meta?.base_price_asset)
}
