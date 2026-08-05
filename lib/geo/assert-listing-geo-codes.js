/**
 * Stage 200.36 — validate listing geo codes against geo_locations (no silent coerce).
 */

import { supabaseAdmin } from '@/lib/supabase'

/**
 * @param {{
 *   countryCode?: string|null
 *   regionCode?: string|null
 *   cityCode?: string|null
 *   latitude?: number|null
 *   longitude?: number|null
 *   requireCountry?: boolean
 *   requireCoords?: boolean
 * }} opts
 * @returns {Promise<{ ok: true } | { ok: false, error: string, code: string }>}
 */
export async function assertListingGeoCodes(opts = {}) {
  const country = String(opts.countryCode || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  const region = String(opts.regionCode || '').trim() || null
  const city = String(opts.cityCode || '').trim() || null
  const lat = opts.latitude != null && opts.latitude !== '' ? Number(opts.latitude) : NaN
  const lng = opts.longitude != null && opts.longitude !== '' ? Number(opts.longitude) : NaN
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180

  if (opts.requireCountry && !/^[A-Z]{2}$/.test(country)) {
    return { ok: false, error: 'country_code required', code: 'GEO_COUNTRY_REQUIRED' }
  }
  if (opts.requireCoords && !hasCoords) {
    return { ok: false, error: 'Valid latitude and longitude required', code: 'GEO_COORDS_REQUIRED' }
  }
  if (opts.latitude != null && opts.latitude !== '' && opts.longitude != null && opts.longitude !== '' && !hasCoords) {
    return { ok: false, error: 'Invalid latitude/longitude', code: 'GEO_INVALID_COORDS' }
  }

  if (!supabaseAdmin) {
    return { ok: false, error: 'DB unavailable', code: 'GEO_DB_UNAVAILABLE' }
  }

  if (/^[A-Z]{2}$/.test(country)) {
    const { data: countryRow, error } = await supabaseAdmin
      .from('geo_locations')
      .select('code')
      .eq('code', country)
      .eq('level', 'country')
      .eq('is_active', true)
      .maybeSingle()
    if (error) {
      return { ok: false, error: error.message, code: 'GEO_LOOKUP_FAILED' }
    }
    if (!countryRow) {
      return {
        ok: false,
        error: 'country_code not found in geo_locations',
        code: 'GEO_COUNTRY_UNKNOWN',
      }
    }
  }

  if (region) {
    const { data: regionRow, error } = await supabaseAdmin
      .from('geo_locations')
      .select('code,level,parent_code,country_code')
      .eq('code', region)
      .eq('is_active', true)
      .maybeSingle()
    if (error) {
      return { ok: false, error: error.message, code: 'GEO_LOOKUP_FAILED' }
    }
    if (!regionRow || regionRow.level !== 'region') {
      return { ok: false, error: 'region_code not found in geo_locations', code: 'GEO_REGION_UNKNOWN' }
    }
    if (country && regionRow.country_code && regionRow.country_code !== country) {
      return { ok: false, error: 'region_code does not belong to country', code: 'GEO_REGION_MISMATCH' }
    }
  }

  if (city) {
    const { data: cityRow, error } = await supabaseAdmin
      .from('geo_locations')
      .select('code,level,parent_code,country_code')
      .eq('code', city)
      .eq('is_active', true)
      .maybeSingle()
    if (error) {
      return { ok: false, error: error.message, code: 'GEO_LOOKUP_FAILED' }
    }
    if (!cityRow || !['city', 'neighborhood'].includes(cityRow.level)) {
      return { ok: false, error: 'city_code not found in geo_locations', code: 'GEO_CITY_UNKNOWN' }
    }
    if (country && cityRow.country_code && cityRow.country_code !== country) {
      return { ok: false, error: 'city_code does not belong to country', code: 'GEO_CITY_MISMATCH' }
    }
  }

  return { ok: true }
}
