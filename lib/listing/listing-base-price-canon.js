/**
 * ADR-181 Wave 1 — L1 asset price → THB canon on listing save.
 *
 * Partner input is always in `base_currency` (asset). `base_price_thb` stores the
 * mid-market THB equivalent for PricingService / ledger.
 *
 * @see docs/ADR/181-listing-asset-currency-ssot.md
 */

import { isListingBaseCurrency, normalizeCurrencyCode } from '@/lib/finance/currency-codes'
import { normalizeThbPerUnitRate } from '@/lib/finance/thb-per-unit-rate.js'

/** Opt-out: `LISTING_ASSET_PRICE_CANON=0` */
export function isListingAssetPriceCanonEnabled() {
  return String(process.env.LISTING_ASSET_PRICE_CANON ?? '1').trim() !== '0'
}

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
  if (!asset || typeof asset !== 'object') return null
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

/**
 * Asset amount for partner form (round-trip from metadata when present).
 * @param {object} listing
 * @returns {number | null}
 */
export function readPartnerFormAssetAmount(listing) {
  const asset = readBasePriceAssetFromListing(listing)
  if (asset) return asset.amount
  const raw = listing?.basePriceThb ?? listing?.base_price_thb
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * @param {{
 *   amount: number,
 *   currency?: string,
 *   rateMap?: Record<string, number>,
 *   convertedAt?: string,
 * }} params
 * @returns {{
 *   basePriceThb: number,
 *   basePriceAsset: { amount: number, currency: string, rate_thb_per_unit_mid: number, converted_at: string },
 * }}
 */
export function resolveListingBasePriceCanon({ amount, currency = 'THB', rateMap = {}, convertedAt }) {
  const cur = normalizeCurrencyCode(currency, 'THB')
  if (!isListingBaseCurrency(cur)) {
    const err = new Error(`Invalid listing base currency: ${currency}`)
    err.code = 'INVALID_BASE_CURRENCY'
    throw err
  }

  const assetAmount = Math.round(Number(amount) * 100) / 100
  if (!Number.isFinite(assetAmount) || assetAmount < 0) {
    const err = new Error('Invalid base price amount')
    err.code = 'INVALID_BASE_PRICE'
    throw err
  }

  const converted_at = convertedAt || new Date().toISOString()

  if (cur === 'THB') {
    const basePriceThb = Math.round(assetAmount)
    return {
      basePriceThb,
      basePriceAsset: {
        amount: assetAmount,
        currency: 'THB',
        rate_thb_per_unit_mid: 1,
        converted_at,
      },
    }
  }

  const rawRate = Number(rateMap?.[cur])
  const rate = normalizeThbPerUnitRate(cur, rawRate)
  if (rate == null || rate <= 0) {
    const err = new Error(`FX rate unavailable for ${cur}`)
    err.code = 'LISTING_BASE_PRICE_FX_UNAVAILABLE'
    throw err
  }

  const basePriceThb = Math.round(assetAmount * rate)
  return {
    basePriceThb,
    basePriceAsset: {
      amount: assetAmount,
      currency: cur,
      rate_thb_per_unit_mid: rate,
      converted_at,
    },
  }
}

/**
 * @param {{ amount: number, currency?: string, convertedAt?: string }} params
 */
export async function resolveListingBasePriceCanonWithRates(params) {
  const { getRawRateMap } = await import('@/lib/services/pricing/pricing-fx-helpers.js')
  const rateMap = await getRawRateMap()
  return resolveListingBasePriceCanon({ ...params, rateMap })
}

/**
 * Build DB fields for listing create/update.
 *
 * @param {{
 *   assetAmount: number,
 *   currency: string,
 *   existingMetadata?: object,
 * }} params
 * @returns {Promise<{ base_price_thb: number, metadata: object }>}
 */
export async function buildListingPriceWriteFields({ assetAmount, currency, existingMetadata = {} }) {
  const normalizedCurrency = isListingBaseCurrency(currency)
    ? normalizeCurrencyCode(currency, 'THB')
    : 'THB'

  if (!isListingAssetPriceCanonEnabled()) {
    return {
      base_price_thb: Math.round(Number(assetAmount)),
      metadata: existingMetadata && typeof existingMetadata === 'object' ? existingMetadata : {},
    }
  }

  const canon = await resolveListingBasePriceCanonWithRates({
    amount: assetAmount,
    currency: normalizedCurrency,
  })

  return {
    base_price_thb: canon.basePriceThb,
    metadata: {
      ...(existingMetadata && typeof existingMetadata === 'object' ? existingMetadata : {}),
      base_price_asset: canon.basePriceAsset,
    },
  }
}

/**
 * @param {object} listing
 */
export function mapListingPriceFieldsForApi(listing) {
  const asset = readBasePriceAssetFromListing(listing)
  return {
    basePriceThb: parseFloat(listing?.base_price_thb) || 0,
    baseCurrency: listing?.base_currency || 'THB',
    basePriceAsset: asset
      ? {
          amount: asset.amount,
          currency: asset.currency,
          rateThbPerUnitMid: asset.rate_thb_per_unit_mid,
          convertedAt: asset.converted_at,
        }
      : null,
  }
}
