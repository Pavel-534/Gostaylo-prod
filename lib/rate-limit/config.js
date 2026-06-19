/**
 * Stage 168.2 — tiered rate limit SSOT (window + max per bucket).
 */

/** @typedef {{ windowMs: number, max: number }} RateLimitTier */

/** @type {Record<string, RateLimitTier>} */
export const RATE_LIMITS = {
  auth: { windowMs: 15 * 60 * 1000, max: 10 },
  search: { windowMs: 60 * 1000, max: 60 },
  booking: { windowMs: 60 * 1000, max: 20 },
  partner_import: { windowMs: 60 * 1000, max: 8 },
  semantic_search: { windowMs: 60 * 1000, max: 5 },
  promo_validate: { windowMs: 60 * 1000, max: 45 },
  referral_track: { windowMs: 60 * 1000, max: 60 },
  spatial_map: { windowMs: 60 * 1000, max: 60 },
  spatial_catalog: { windowMs: 60 * 1000, max: 45 },
  spatial_catalog_user: { windowMs: 60 * 1000, max: 90 },
  promo_extend: { windowMs: 60 * 1000, max: 25 },
  data_export: { windowMs: 24 * 60 * 60 * 1000, max: 3 },
  /** Stage 168.2 — Nominatim proxy */
  geocode: { windowMs: 60 * 1000, max: 30 },
  /** Stage 168.2 — storage uploads */
  upload: { windowMs: 60 * 1000, max: 20 },
  /** Stage 168.2 — chat send */
  chat: { windowMs: 60 * 1000, max: 60 },
  default: { windowMs: 60 * 1000, max: 100 },
}
