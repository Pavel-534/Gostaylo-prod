/**
 * Build `{ [listingId]: boolean }` for all requested ids.
 *
 * @param {string[]} requestedIds
 * @param {Array<{ listing_id?: string }>} favoriteRows
 * @returns {Record<string, boolean>}
 */
export function buildFavoritesMap(requestedIds, favoriteRows) {
  const favorited = new Set(
    (favoriteRows || [])
      .map((row) => String(row?.listing_id ?? '').trim())
      .filter(Boolean),
  )

  /** @type {Record<string, boolean>} */
  const map = {}
  for (const id of requestedIds) {
    map[id] = favorited.has(id)
  }
  return map
}
