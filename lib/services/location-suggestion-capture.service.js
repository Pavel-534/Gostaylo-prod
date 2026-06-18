/**

 * Stage 158.2 / 161 — persist unknown location terms (non-blocking, service_role only).

 * Stage 161: auto-merge when high-confidence geo_synonyms match (weight >= 80).

 */



import { supabaseAdmin } from '@/lib/supabase'

import { lookupGeoSynonymForAutoMerge } from '@/lib/locations/lookup-geo-synonym'

import { getGeoSynonymsIndex } from '@/lib/locations/location-synonyms'

import { applyListingGeoFromSynonym } from '@/lib/locations/apply-listing-geo-from-synonym'



/**

 * @param {import('@/lib/locations/listing-geo-verification').LocationCapturePayload & { suggested_by_listing_id: string }} payload

 */

export async function captureLocationSuggestion(payload) {

  if (!supabaseAdmin) return { ok: false, skipped: true, reason: 'no_db' }



  const raw_term = String(payload.raw_term || '').trim().slice(0, 100)

  const listingId = String(payload.suggested_by_listing_id || '').trim()

  if (!raw_term || !listingId) return { ok: false, skipped: true, reason: 'invalid_payload' }



  const synonymIndex = await getGeoSynonymsIndex()

  const synonym = await lookupGeoSynonymForAutoMerge(raw_term, {
    index: synonymIndex,
  })



  if (synonym) {

    const merged = await applyListingGeoFromSynonym(listingId, synonym)

    if (merged.ok && merged.geo_status === 'verified') {

      return {

        ok: true,

        auto_merged: true,

        synonym_id: merged.synonym_id,

        target_code: merged.target_code,

        target_type: merged.target_type,

      }

    }

  }



  const row = {

    raw_term,

    kind: payload.kind === 'city' ? 'city' : 'district',

    suggested_by_listing_id: listingId,

    country_code: payload.country_code || null,

    region_code: payload.region_code || null,

    city_code: payload.city_code || null,

    status: 'PENDING',

  }



  const { error } = await supabaseAdmin.from('location_suggestions').insert(row)



  if (error) {

    if (error.code === '23505') {

      return { ok: true, duplicate: true }

    }

    if (error.code === '42P01') {

      console.warn('[location-suggestion-capture] table missing — apply stage158_2 migration')

      return { ok: false, skipped: true, reason: 'table_missing' }

    }

    console.warn('[location-suggestion-capture]', error.message)

    return { ok: false, error: error.message }

  }



  return { ok: true }

}



/**

 * Fire-and-forget wrapper for partner write path.

 * @param {Parameters<typeof captureLocationSuggestion>[0]} payload

 */

export function scheduleLocationSuggestionCapture(payload) {

  captureLocationSuggestion(payload).catch((err) => {

    console.warn('[location-suggestion-capture] async failed:', err?.message || err)

  })

}


