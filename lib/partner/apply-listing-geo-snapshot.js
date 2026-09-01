/**
 * Stage 157 / 158.2 — apply geo snapshot to partner listing write payloads (server SSOT).
 */
import { resolveListingGeoSnapshot, inferGeoFromLegacyRow } from '@/lib/locations/resolve-listing-geo-snapshot'
import { assessListingGeoVerification } from '@/lib/locations/listing-geo-verification'
import { resolveListingGeoWriteCascadeInput } from '@/lib/partner/resolve-listing-geo-write-cascade.js'

/**
 * @param {Record<string, unknown>} updateData
 * @param {Record<string, unknown>} body
 * @param {Record<string, unknown>} [existing]
 * @returns {{ updateData: Record<string, unknown>, locationCapture: import('@/lib/locations/listing-geo-verification').LocationCapturePayload | null }}
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

  const cascadeInput = resolveListingGeoWriteCascadeInput(body, existing)

  const snapshot = hasCascade
    ? resolveListingGeoSnapshot({
        countryCode: cascadeInput.countryCode,
        regionCode: cascadeInput.regionCode,
        cityCode: cascadeInput.cityCode,
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

  const geoCascadeWrite =
    body.country != null ||
    body.region !== undefined ||
    body.city !== undefined ||
    cascadeInput.countryChanged

  if (geoCascadeWrite) {
    if (snapshot.country_code) updateData.country_code = snapshot.country_code
    // Explicit null — do not keep TH region when country moved to RU (Stage 202.28).
    updateData.region_code = snapshot.region_code ?? null
    updateData.city_code = snapshot.city_code ?? null
  }
  if (snapshot.district) updateData.district = snapshot.district

  const verification = assessListingGeoVerification(snapshot, {
    metadataCity: mergedMeta.city,
  })

  const nextMeta = {
    ...mergedMeta,
    ...snapshot.metadataGeo,
    geo_status: verification.geo_status,
  }

  if (verification.unverified_location) {
    nextMeta.unverified_location = verification.unverified_location
  } else {
    delete nextMeta.unverified_location
  }

  updateData.metadata = nextMeta

  return {
    updateData,
    locationCapture: verification.capture,
  }
}

/**
 * @param {Record<string, unknown>} insertRow
 * @param {Record<string, unknown>} body
 */
export function applyListingGeoSnapshotToInsertRow(insertRow, body) {
  const { updateData, locationCapture } = applyListingGeoSnapshotToUpdateData(insertRow, body, {})
  return { insertRow: updateData, locationCapture }
}
