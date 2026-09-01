/**
 * Stage 202.28 — merge body + existing geo cascade without stale region/city after country change.
 */

function normalizeCountry(code) {
  const c = String(code || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  return /^[A-Z]{2}$/.test(c) ? c : null
}

/**
 * @param {Record<string, unknown>} body
 * @param {Record<string, unknown>} [existing]
 * @returns {{
 *   countryCode: string | null,
 *   regionCode: string | null,
 *   cityCode: string | null,
 *   countryChanged: boolean,
 * }}
 */
export function resolveListingGeoWriteCascadeInput(body = {}, existing = {}) {
  const existingCountry = normalizeCountry(existing.country_code)
  const bodyHasCountry = body.country != null && String(body.country).trim() !== ''
  const bodyCountry = bodyHasCountry ? normalizeCountry(body.country) : null
  const countryChanged = Boolean(
    bodyCountry && existingCountry && bodyCountry !== existingCountry,
  )

  let regionCode
  if (body.region !== undefined) {
    regionCode = String(body.region || '').trim() || null
  } else if (countryChanged) {
    regionCode = null
  } else {
    regionCode = existing.region_code ? String(existing.region_code).trim() : null
  }

  let cityCode
  if (body.city !== undefined) {
    cityCode = String(body.city || '').trim() || null
  } else if (countryChanged) {
    cityCode = null
  } else {
    cityCode = existing.city_code ? String(existing.city_code).trim() : null
  }

  const countryCode = bodyCountry || existingCountry || null

  return { countryCode, regionCode, cityCode, countryChanged }
}
