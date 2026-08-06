/**
 * Stage 200.48 — approximate capital/hub centroids for wizard map re-center
 * when geo_locations country row has no centroid (non-launch ISO).
 * Not a geo SSOT — pin/tz-lookup still wins after user places the marker.
 */

/** @type {Readonly<Record<string, [number, number]>>} */
export const COUNTRY_MAP_VIEWPORT_CENTROID = Object.freeze({
  DE: [52.52, 13.405],
  FR: [48.8566, 2.3522],
  GB: [51.5074, -0.1278],
  IT: [41.9028, 12.4964],
  ES: [40.4168, -3.7038],
  NL: [52.3676, 4.9041],
  AT: [48.2082, 16.3738],
  BE: [50.8503, 4.3517],
  PT: [38.7223, -9.1393],
  IE: [53.3498, -6.2603],
  FI: [60.1699, 24.9384],
  GR: [37.9838, 23.7275],
  CN: [39.9042, 116.4074],
  HK: [22.3193, 114.1694],
  JP: [35.6762, 139.6503],
  KR: [37.5665, 126.978],
  SG: [1.3521, 103.8198],
  MY: [3.139, 101.6869],
  AU: [-33.8688, 151.2093],
  NZ: [-41.2865, 174.7762],
  CA: [45.4215, -75.6972],
  US: [38.9072, -77.0369],
  IN: [28.6139, 77.209],
})

/**
 * @param {string | null | undefined} countryCode
 * @returns {[number, number] | null}
 */
export function getCountryMapViewportCentroid(countryCode) {
  const iso = String(countryCode || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  return iso && COUNTRY_MAP_VIEWPORT_CENTROID[iso]
    ? COUNTRY_MAP_VIEWPORT_CENTROID[iso]
    : null
}
