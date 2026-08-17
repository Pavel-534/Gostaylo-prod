/**
 * Slim catalog/search payload: whitelist metadata for cards + promos (SSOT with ListingCard / TopListingsGrid).
 * DB row may still carry full `metadata` for filters; response uses this pick only when `isLite`.
 */

import { readBasePriceAssetFromListing } from '@/lib/listing/read-base-price-asset.js'
import { normalizeCurrencyCode } from '@/lib/finance/currency-codes.js'

/**
 * Compact L1 fields for guest cards (Stage 201.88).
 * Lite metadata used to strip `base_price_asset`, so RUB listing + RUB header
 * fell through to THB→retail and disagreed with PDP same-currency display.
 *
 * @param {object | null | undefined} row — DB listing or catalog DTO
 * @returns {{ baseCurrency: string, basePriceAsset: { amount: number, currency: string } | null }}
 */
export function catalogPublicCurrencyFields(row) {
  if (!row || typeof row !== 'object') {
    return { baseCurrency: 'THB', basePriceAsset: null }
  }
  const assetFull = readBasePriceAssetFromListing(row)
  const basePriceAsset = assetFull
    ? { amount: assetFull.amount, currency: assetFull.currency }
    : null
  const baseCurrency = normalizeCurrencyCode(
    row.base_currency || row.baseCurrency || basePriceAsset?.currency || 'THB',
    'THB',
  )
  return { baseCurrency, basePriceAsset }
}

/**
 * Compact geo codes for guest cards (Stage 201.93).
 * Lite catalog omitted these → cards showed raw OSM district (Thai/EN/RU mix) or empty.
 *
 * @param {object | null | undefined} row
 * @returns {{
 *   countryCode: string | null,
 *   regionCode: string | null,
 *   cityCode: string | null,
 *   country_code: string | null,
 *   region_code: string | null,
 *   city_code: string | null,
 * }}
 */
export function catalogPublicGeoFields(row) {
  const meta = row?.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
    ? row.metadata
    : {}
  const countryCode = String(
    row?.country_code || row?.countryCode || meta.country_code || meta.countryCode || '',
  )
    .trim()
    .toUpperCase()
    .slice(0, 2) || null
  const regionCode =
    String(row?.region_code || row?.regionCode || meta.region_code || meta.regionCode || '').trim() ||
    null
  const cityCode =
    String(row?.city_code || row?.cityCode || meta.city_code || meta.cityCode || '').trim() || null
  return {
    countryCode,
    regionCode,
    cityCode,
    country_code: countryCode,
    region_code: regionCode,
    city_code: cityCode,
  }
}

/** Keys required for guest capacity + vertical cards + duration promos + LQIP blur. */
const LITE_METADATA_KEYS = [
  'title_translations',
  'city',
  'city_label',
  'region_label',
  'parent_location',
  'category_slug',
  'bedrooms',
  'bathrooms',
  'area',
  'max_guests',
  'guests',
  'seats',
  'cabins',
  'cabins_count',
  'duration_hours',
  'tour_hours',
  'engine_cc',
  /** Коробка / тип передачи — карточки транспорта в lite-каталоге */
  'transmission',
  'gearbox',
  /** Stage 87.1 — trust mini-badge parity (lite catalog + map popup) */
  'verified_partner',
  'partner_trust_verified',
  'trust_verified',
  'property_type',
  'discounts',
  'card_blur_data_url',
  'blur_data_url',
]

/**
 * @param {Record<string, unknown> | null | undefined} meta
 * @returns {Record<string, unknown>}
 */
export function pickLiteListingMetadata(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {}
  const out = {}
  for (const k of LITE_METADATA_KEYS) {
    if (Object.prototype.hasOwnProperty.call(meta, k) && meta[k] !== undefined) {
      out[k] = meta[k]
    }
  }
  return out
}

/**
 * Supabase select without `description` (WHERE / text search may still reference column server-side).
 * Keeps `metadata` and `images` for post-filters; response mapper slices images + slims metadata.
 */
export const LISTINGS_SELECT_LITE = `
        id,
        owner_id,
        category_id,
        status,
        title,
        district,
        country_code,
        region_code,
        city_code,
        metadata,
        latitude,
        longitude,
        instant_booking,
        base_price_thb,
        base_currency,
        commission_rate,
        images,
        cover_image,
        max_capacity,
        bedrooms_count,
        bathrooms_count,
        is_featured,
        views,
        bookings_count,
        rating,
        avg_rating,
        reviews_count,
        created_at,
        available,
        categories (id, name, slug, icon, wizard_profile, parent_id, name_i18n),
        owner:profiles!owner_id (id, first_name, last_name, is_verified)
      `
