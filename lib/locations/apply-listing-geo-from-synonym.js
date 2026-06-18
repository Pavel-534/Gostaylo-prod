/**
 * Stage 161 — apply geo_synonyms target to a listing row (capture auto-merge + batch normalize).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { resolveListingGeoSnapshot } from '@/lib/locations/resolve-listing-geo-snapshot'
import { assessListingGeoVerification } from '@/lib/locations/listing-geo-verification'

/**
 * @param {import('@/lib/locations/lookup-geo-synonym').GeoSynonymMatch} synonym
 * @param {object} listing
 */
export function buildListingPatchFromSynonym(synonym, listing) {
  const meta =
    listing.metadata && typeof listing.metadata === 'object' ? { ...listing.metadata } : {}

  const snapshot = resolveListingGeoSnapshot({
    countryCode:
      synonym.target_type === 'country' ? synonym.target_code : listing.country_code,
    regionCode:
      synonym.target_type === 'region' ? synonym.target_code : listing.region_code,
    cityCode:
      synonym.target_type === 'city' ? synonym.target_code : listing.city_code,
    district:
      synonym.target_type === 'district' ? synonym.target_code : listing.district,
    latitude: listing.latitude,
    longitude: listing.longitude,
    existingMetadata: meta,
  })

  const verification = assessListingGeoVerification(snapshot, { metadataCity: meta.city })

  const nextMeta = {
    ...meta,
    ...snapshot.metadataGeo,
    geo_status: verification.geo_status,
  }
  if (verification.unverified_location) {
    nextMeta.unverified_location = verification.unverified_location
  } else {
    delete nextMeta.unverified_location
  }

  const patch = {
    updated_at: new Date().toISOString(),
    metadata: nextMeta,
  }

  if (snapshot.country_code) patch.country_code = snapshot.country_code
  if (snapshot.region_code) patch.region_code = snapshot.region_code
  if (snapshot.city_code) patch.city_code = snapshot.city_code
  if (snapshot.district !== undefined) patch.district = snapshot.district

  return { patch, verification, snapshot }
}

/**
 * @param {string} listingId
 * @param {import('@/lib/locations/lookup-geo-synonym').GeoSynonymMatch} synonym
 * @param {object} [listingRow]
 */
export async function applyListingGeoFromSynonym(listingId, synonym, listingRow = null) {
  if (!supabaseAdmin) return { ok: false, error: 'no_db' }

  let listing = listingRow
  if (!listing) {
    const { data, error } = await supabaseAdmin
      .from('listings')
      .select('id, status, district, country_code, region_code, city_code, latitude, longitude, metadata')
      .eq('id', listingId)
      .maybeSingle()

    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: false, error: 'listing_not_found' }
    listing = data
  }

  const { patch, verification } = buildListingPatchFromSynonym(synonym, listing)

  const { error: upErr } = await supabaseAdmin.from('listings').update(patch).eq('id', listingId)

  if (upErr) return { ok: false, error: upErr.message }

  return {
    ok: true,
    listing_id: listingId,
    geo_status: verification.geo_status,
    synonym_id: synonym.id,
    target_code: synonym.target_code,
    target_type: synonym.target_type,
  }
}
