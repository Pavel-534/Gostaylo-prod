/**
 * Stage 33.0 — `promo_codes.allowed_listing_ids` (uuid[]) helpers.
 */

/** @param {unknown} raw — Postgres uuid[] / JS string[] */
export function normalizeAllowedListingIdsFromRow(raw) {
  if (raw == null) return null
  if (!Array.isArray(raw)) return null
  const ids = raw.map((x) => String(x || '').trim()).filter(Boolean)
  return ids.length ? ids : null
}

/**
 * @param {unknown} input — string[], comma string, or null
 * @returns {string[] | null} non-empty list or null
 */
export function normalizeAllowedListingIdsForInsert(input) {
  if (input == null) return null
  let arr = []
  if (Array.isArray(input)) {
    arr = input.map((x) => String(x || '').trim()).filter(Boolean)
  } else if (typeof input === 'string') {
    arr = input
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  } else {
    return null
  }
  if (arr.length === 0) return null
  if (arr.length > 80) {
    const e = new Error('Too many allowed listing ids (max 80)')
    e.code = 'VALIDATION'
    throw e
  }
  return arr
}
