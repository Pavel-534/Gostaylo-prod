/**
 * Stage 158.2 / 200.38 — verified vs unverified geo on listing write path.
 * Districts are free-text; cascade codes from geo_locations / wizard are enough for verified.
 */

/**
 * @typedef {'verified' | 'unverified'} GeoStatus
 * @typedef {'district' | 'city'} UnverifiedKind
 *
 * @typedef {object} LocationCapturePayload
 * @property {string} raw_term
 * @property {UnverifiedKind} kind
 * @property {string} [country_code]
 * @property {string} [region_code]
 * @property {string} [city_code]
 *
 * @typedef {object} ListingGeoVerification
 * @property {GeoStatus} geo_status
 * @property {{ raw_term: string, kind: UnverifiedKind, captured_at: string } | null} unverified_location
 * @property {LocationCapturePayload | null} capture
 */

/**
 * @param {import('@/lib/locations/resolve-listing-geo-snapshot').ListingGeoSnapshot} snapshot
 * @param {Record<string, unknown>} [context]
 * @returns {ListingGeoVerification}
 */
export function assessListingGeoVerification(snapshot, context = {}) {
  const district = String(snapshot.district || '').trim()
  const metaCity = context.metadataCity ? String(context.metadataCity).trim() : ''
  const hasCascade = Boolean(snapshot.country_code && snapshot.region_code && snapshot.city_code)

  const verifiedBase = /** @type {ListingGeoVerification} */ ({
    geo_status: 'verified',
    unverified_location: null,
    capture: null,
  })

  // Full cascade (including free-text district) → verified
  if (hasCascade) return verifiedBase

  // Country (+ optional region) without city still ok if no free-text city invent
  if (snapshot.country_code && !metaCity && !district) return verifiedBase

  let raw_term = district || metaCity
  let kind = /** @type {UnverifiedKind} */ (district ? 'district' : 'city')

  if (!district && metaCity && !hasCascade) {
    raw_term = metaCity
    kind = 'city'
  }

  if (!raw_term) return verifiedBase

  const captured_at = new Date().toISOString()

  return {
    geo_status: 'unverified',
    unverified_location: { raw_term, kind, captured_at },
    capture: {
      raw_term,
      kind,
      country_code: snapshot.country_code || undefined,
      region_code: snapshot.region_code || undefined,
      city_code: snapshot.city_code || undefined,
    },
  }
}
