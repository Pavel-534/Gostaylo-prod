/**
 * Stage 161 — batch normalize ACTIVE listings (unverified / legacy district cleanup).
 */

import { supabaseAdmin } from '@/lib/supabase'
import {
  resolveListingGeoSnapshot,
  inferGeoFromLegacyRow,
} from '@/lib/locations/resolve-listing-geo-snapshot'
import { assessListingGeoVerification } from '@/lib/locations/listing-geo-verification'
import { getGeoSynonymsIndex } from '@/lib/locations/location-synonyms'
import { lookupGeoSynonym } from '@/lib/locations/lookup-geo-synonym'
import {
  buildListingPatchFromSynonym,
  applyListingGeoFromSynonym,
} from '@/lib/locations/apply-listing-geo-from-synonym'

const DEFAULT_BATCH_SIZE = 200
const MIN_BATCH_SIZE = 100
const MAX_BATCH_SIZE = 500

/** @type {{ last_run_at: string | null, last_summary: object | null }} */
let lastRunSnapshot = { last_run_at: null, last_summary: null }

export function getLocationNormalizeLastRunSnapshot() {
  return lastRunSnapshot
}

/**
 * @param {number} [raw]
 */
export function resolveBatchNormalizeLimit(raw) {
  const fromEnv = parseInt(process.env.LOCATION_NORMALIZE_BATCH_SIZE || '', 10)
  const n = Number.isFinite(parseInt(raw, 10)) ? parseInt(raw, 10) : fromEnv
  const base = Number.isFinite(n) ? n : DEFAULT_BATCH_SIZE
  return Math.min(MAX_BATCH_SIZE, Math.max(MIN_BATCH_SIZE, base))
}

/**
 * @param {object} listing
 */
function isNormalizeCandidate(listing) {
  const meta = listing.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  const geoStatus = String(meta.geo_status || '')
  const district = String(listing.district || '').trim()

  if (geoStatus === 'unverified') return true
  if (district && geoStatus !== 'verified') return true
  return false
}

/**
 * @returns {Promise<number>}
 */
export async function countRemainingUnverifiedLocations() {
  if (!supabaseAdmin) return 0

  const { data, error } = await supabaseAdmin
    .from('listings')
    .select('id, district, metadata')
    .eq('status', 'ACTIVE')
    .limit(5000)

  if (error) return 0

  return (data || []).filter(isNormalizeCandidate).length
}

/**
 * @param {object} listing
 * @param {Awaited<ReturnType<typeof getGeoSynonymsIndex>>} synonymIndex
 */
function tryNormalizeListing(listing, synonymIndex) {
  const meta = listing.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  const rawTerm =
    String(meta.unverified_location?.raw_term || '').trim() ||
    String(listing.district || '').trim() ||
    String(meta.city || '').trim()

  if (!rawTerm) {
    return { outcome: 'skipped', reason: 'no_term' }
  }

  const synonym = lookupGeoSynonym(rawTerm, synonymIndex, { minWeight: 0 })
  if (synonym) {
    const { patch, verification } = buildListingPatchFromSynonym(synonym, listing)
    if (verification.geo_status === 'verified') {
      return { outcome: 'normalized', source: 'synonym', patch, synonym }
    }
  }

  const hasCascade = Boolean(listing.country_code && listing.region_code && listing.city_code)
  const snapshot = hasCascade
    ? resolveListingGeoSnapshot({
        countryCode: listing.country_code,
        regionCode: listing.region_code,
        cityCode: listing.city_code,
        district: listing.district,
        latitude: listing.latitude,
        longitude: listing.longitude,
        existingMetadata: meta,
      })
    : inferGeoFromLegacyRow(listing)

  const verification = assessListingGeoVerification(snapshot, { metadataCity: meta.city })
  if (verification.geo_status !== 'verified') {
    return { outcome: 'skipped', reason: 'still_unverified' }
  }

  const nextMeta = {
    ...meta,
    ...snapshot.metadataGeo,
    geo_status: 'verified',
  }
  delete nextMeta.unverified_location

  const patch = {
    updated_at: new Date().toISOString(),
    metadata: nextMeta,
  }
  if (snapshot.country_code) patch.country_code = snapshot.country_code
  if (snapshot.region_code) patch.region_code = snapshot.region_code
  if (snapshot.city_code) patch.city_code = snapshot.city_code
  if (snapshot.district !== undefined) patch.district = snapshot.district

  const unchanged =
    listing.district === patch.district &&
    listing.city_code === patch.city_code &&
    meta.geo_status === 'verified' &&
    !meta.unverified_location

  if (unchanged) {
    return { outcome: 'noop', source: 'canon_only' }
  }

  return { outcome: 'normalized', source: 'canon_only', patch }
}

/**
 * @param {{ limit?: number }} [params]
 */
export async function runBatchLocationNormalize(params = {}) {
  const t0 = Date.now()
  const limit = resolveBatchNormalizeLimit(params.limit)

  const summary = {
    scanned: 0,
    normalized: 0,
    skipped: 0,
    noop: 0,
    remaining_unverified: 0,
    duration_ms: 0,
    by_source: { synonym: 0, canon_only: 0 },
    errors: [],
  }

  if (!supabaseAdmin) {
    summary.duration_ms = Date.now() - t0
    return { ok: false, error: 'no_db', ...summary }
  }

  const { data: rows, error } = await supabaseAdmin
    .from('listings')
    .select('id, status, district, country_code, region_code, city_code, latitude, longitude, metadata, updated_at')
    .eq('status', 'ACTIVE')
    .order('updated_at', { ascending: true })
    .limit(Math.min(limit * 3, 1500))

  if (error) {
    summary.duration_ms = Date.now() - t0
    return { ok: false, error: error.message, ...summary }
  }

  const candidates = (rows || []).filter(isNormalizeCandidate).slice(0, limit)
  summary.scanned = candidates.length

  const synonymIndex = await getGeoSynonymsIndex()

  for (const listing of candidates) {
    try {
      const result = tryNormalizeListing(listing, synonymIndex)

      if (result.outcome === 'skipped') {
        summary.skipped += 1
        continue
      }

      if (result.outcome === 'noop') {
        summary.noop += 1
        continue
      }

      const { error: upErr } = await supabaseAdmin
        .from('listings')
        .update(result.patch)
        .eq('id', listing.id)
        .eq('status', 'ACTIVE')

      if (upErr) {
        summary.errors.push({ listing_id: listing.id, error: upErr.message })
        summary.skipped += 1
        continue
      }

      summary.normalized += 1
      if (result.source === 'synonym') summary.by_source.synonym += 1
      if (result.source === 'canon_only') summary.by_source.canon_only += 1
    } catch (err) {
      summary.errors.push({ listing_id: listing.id, error: err?.message || String(err) })
      summary.skipped += 1
    }
  }

  summary.remaining_unverified = await countRemainingUnverifiedLocations()
  summary.duration_ms = Date.now() - t0

  lastRunSnapshot = {
    last_run_at: new Date().toISOString(),
    last_summary: summary,
  }

  console.log('[normalize-locations]', JSON.stringify(summary))

  return { ok: true, ...summary }
}

export { applyListingGeoFromSynonym }
