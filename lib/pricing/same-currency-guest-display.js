/**
 * Stage 200.86 — when UI currency === listing base_currency, guest sees
 * L1 asset × (1 + guest fee) with **no retail FX round-trip** (matches checkout:
 * pay currency === base_currency → FX markup 0%).
 */

import { readBasePriceAssetFromListing } from '@/lib/listing/read-base-price-asset.js'
import {
  normalizeGuestServiceFeePercent,
  resolveGuestServiceFeePercent,
} from '@/lib/pricing/guest-display-price.js'
import { formatNativeAmountInCurrency } from '@/lib/currency.js'

/**
 * @param {Record<string, unknown> | null | undefined} listing
 * @returns {string}
 */
export function resolveListingBaseCurrencyCode(listing) {
  if (!listing || typeof listing !== 'object') return ''
  const asset = readBasePriceAssetFromListing(listing)
  const fromAsset = asset?.currency ? String(asset.currency).toUpperCase() : ''
  const fromRow = String(
    listing.baseCurrency || listing.base_currency || fromAsset || '',
  )
    .toUpperCase()
    .slice(0, 8)
  return fromRow
}

/**
 * Native guest amount in listing currency, or null if not same-currency / no asset.
 * @param {Record<string, unknown> | null | undefined} listing
 * @param {string} displayCurrency
 * @param {number} [guestServiceFeePercent]
 * @returns {number | null}
 */
export function getSameCurrencyGuestNativeAmount(
  listing,
  displayCurrency,
  guestServiceFeePercent,
) {
  const ui = String(displayCurrency || '').toUpperCase().slice(0, 8)
  const base = resolveListingBaseCurrencyCode(listing)
  if (!ui || !base || ui !== base) return null

  const asset = readBasePriceAssetFromListing(listing)
  let assetAmount = asset?.amount
  if (
    !(Number.isFinite(assetAmount) && assetAmount >= 0) &&
    listing?.basePriceAsset?.amount != null
  ) {
    assetAmount = Number(listing.basePriceAsset.amount)
  }
  // Wizard preview may pass L1 in form-shaped fields without metadata.base_price_asset
  if (!(Number.isFinite(assetAmount) && assetAmount >= 0)) {
    const previewNative = Number(listing?.sameCurrencyGuestNative)
    if (Number.isFinite(previewNative) && previewNative >= 0) {
      return Math.round(previewNative)
    }
    return null
  }

  const pct = resolveGuestServiceFeePercent(listing, guestServiceFeePercent)
  const feePct = normalizeGuestServiceFeePercent(pct)
  return Math.round(Number(assetAmount) * (1 + feePct / 100))
}

/**
 * Format same-currency guest price, or null to fall back to THB→retail path.
 */
export function formatSameCurrencyGuestDisplay(
  listing,
  displayCurrency,
  language = 'en',
  guestServiceFeePercent,
) {
  const native = getSameCurrencyGuestNativeAmount(
    listing,
    displayCurrency,
    guestServiceFeePercent,
  )
  if (native == null) return null
  return formatNativeAmountInCurrency(native, displayCurrency, language)
}
