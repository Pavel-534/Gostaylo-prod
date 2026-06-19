/**
 * Stage 168.0 — PostgREST-safe public listings read contract.
 * Anon/authenticated: SELECT listings_public_catalog only (no address, fuzzed coords).
 * Server API (service_role): listings table + serializePublicCoordinates in JS.
 */

/** @readonly */
export const LISTINGS_PUBLIC_CATALOG_VIEW = 'listings_public_catalog'

/**
 * Whitelist columns exposed on the public catalog view (no address, no true coords).
 * @readonly
 */
export const LISTINGS_PUBLIC_CATALOG_SELECT = `
  id,
  owner_id,
  category_id,
  status,
  title,
  description,
  district,
  metadata,
  latitude,
  longitude,
  is_location_approximate,
  base_price_thb,
  base_currency,
  commission_rate,
  images,
  cover_image,
  available,
  is_featured,
  min_booking_days,
  max_booking_days,
  cancellation_policy,
  max_capacity,
  bedrooms_count,
  bathrooms_count,
  instant_booking,
  rating,
  avg_rating,
  reviews_count,
  bookings_count,
  views,
  created_at,
  country_code,
  region_code,
  city_code
`
