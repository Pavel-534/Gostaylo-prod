/**
 * Stage 201.79 — mobile map rail = listings visible on the map (viewport), not full search page.
 */

import { extractListingLatLng } from '@/lib/maps/map-provider-adapter'

/**
 * @param {{ south: number, north: number, west: number, east: number } | null | undefined} bbox
 * @param {number} lat
 * @param {number} lng
 */
export function pointInCatalogMapBbox(bbox, lat, lng) {
  if (!bbox) return false
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false
  return la >= bbox.south && la <= bbox.north && ln >= bbox.west && ln <= bbox.east
}

/**
 * @param {object[]} listings
 * @param {{
 *   pins?: Array<{ id?: string }>,
 *   viewportBbox?: { south: number, north: number, west: number, east: number } | null,
 *   selectedListingId?: string | null,
 * }} [opts]
 * @returns {object[]}
 */
export function filterCatalogRailListingsForMapViewport(listings, opts = {}) {
  const source = Array.isArray(listings) ? listings : []
  if (!source.length) return []

  const selectedId = String(opts.selectedListingId || '').trim()
  const pinIds = new Set(
    (opts.pins || []).map((p) => String(p?.id || '').trim()).filter(Boolean),
  )
  if (selectedId) pinIds.add(selectedId)

  if (pinIds.size > 0) {
    const byPin = source.filter((l) => pinIds.has(String(l?.id || '').trim()))
    if (byPin.length > 0) return byPin
  }

  const bbox = opts.viewportBbox
  if (bbox) {
    const byBbox = source.filter((l) => {
      const ll = extractListingLatLng(l)
      return ll ? pointInCatalogMapBbox(bbox, ll.lat, ll.lng) : false
    })
    if (byBbox.length > 0) return byBbox
  }

  // Pins/bbox not ready yet — keep prior search page (avoid empty flash).
  return source
}
