/**
 * Slim catalog/search payload: whitelist metadata for cards + promos (SSOT with ListingCard / TopListingsGrid).
 * DB row may still carry full `metadata` for filters; response uses this pick only when `isLite`.
 */

/** Keys required for guest capacity + vertical cards + duration promos + LQIP blur. */
const LITE_METADATA_KEYS = [
  'title_translations',
  'city',
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
        metadata,
        latitude,
        longitude,
        instant_booking,
        base_price_thb,
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
