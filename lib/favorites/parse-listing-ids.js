import { FAVORITES_CHECK_BATCH_MAX } from '@/lib/favorites/constants.js'

/**
 * Parse comma-separated listing ids from query param.
 *
 * @param {string | null | undefined} raw
 * @returns {{ ok: true, ids: string[] } | { ok: false, error: string }}
 */
export function parseListingIdsParam(raw) {
  const text = String(raw ?? '').trim()
  if (!text) {
    return { ok: true, ids: [] }
  }

  const seen = new Set()
  const ids = []
  for (const part of text.split(',')) {
    const id = String(part || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }

  if (ids.length > FAVORITES_CHECK_BATCH_MAX) {
    return {
      ok: false,
      error: `Too many listingIds (max ${FAVORITES_CHECK_BATCH_MAX})`,
    }
  }

  return { ok: true, ids }
}

/**
 * Normalize client-side listing id list (dedupe, trim).
 *
 * @param {Array<string | number | null | undefined>} listingIds
 * @returns {string[]}
 */
export function normalizeListingIdList(listingIds) {
  const seen = new Set()
  const ids = []
  for (const value of listingIds || []) {
    const id = String(value ?? '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}
