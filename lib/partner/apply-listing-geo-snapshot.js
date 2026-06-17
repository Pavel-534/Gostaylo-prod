/**
 * Stage 157 — apply geo snapshot to partner listing write payloads (server SSOT).
 */
import { resolveListingGeoSnapshot, inferGeoFromLegacyRow } from '@/lib/locations/resolve-listing-geo-snapshot'

/**
 * @param {Record<string, unknown>} updateData
 * @param {Record<string, unknown>} body
 * @param {Record<string, unknown>} [existing]
 * @returns {Record<string, unknown>}
 */
export function applyListingGeoSnapshotToUpdateData(updateData, body, existing = {}) {
  const hasCascade =
    body.country != null ||
    body.region != null ||
    body.city != null ||
    existing.country_code != null ||
    existing.region_code != null ||
    existing.city_code != null

  const mergedMeta =
    updateData.metadata && typeof updateData.metadata === 'object'
      ? updateData.metadata
      : existing.metadata && typeof existing.metadata === 'object'
        ? existing.metadata
        : {}

  const snapshot = hasCascade
    ? resolveListingGeoSnapshot({
        countryCode: body.country ?? existing.country_code,
        regionCode: body.region ?? existing.region_code,
        cityCode: body.city ?? existing.city_code,
        district: body.district !== undefined ? body.district : existing.district,
        latitude: body.latitude !== undefined ? body.latitude : existing.latitude,
        longitude: body.longitude !== undefined ? body.longitude : existing.longitude,
        existingMetadata: mergedMeta,
      })
    : inferGeoFromLegacyRow({
        district: body.district !== undefined ? body.district : existing.district,
        metadata: mergedMeta,
        latitude: body.latitude !== undefined ? body.latitude : existing.latitude,
        longitude: body.longitude !== undefined ? body.longitude : existing.longitude,
      })

  if (snapshot.country_code) updateData.country_code = snapshot.country_code
  if (snapshot.region_code) updateData.region_code = snapshot.region_code
  if (snapshot.city_code) updateData.city_code = snapshot.city_code
  if (snapshot.district) updateData.district = snapshot.district

  updateData.metadata = {
    ...mergedMeta,
    ...snapshot.metadataGeo,
  }

  return updateData
}

/**
 * @param {Record<string, unknown>} insertRow
 * @param {Record<string, unknown>} body
 * @returns {Record<string, unknown>}
 */
export function applyListingGeoSnapshotToInsertRow(insertRow, body) {
  return applyListingGeoSnapshotToUpdateData(insertRow, body, {})
}
