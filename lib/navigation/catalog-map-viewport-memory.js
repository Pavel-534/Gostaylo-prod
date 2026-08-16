/**
 * Stage 201.81 — remember catalog map camera (bbox) for PDP soft-back.
 *
 * Soft-back already restores `/listings…#map`, but pan/zoom lived only in Leaflet
 * state. Without this snapshot, remount fits world/all pins again.
 *
 * Session-only; cleared after one consume or when leaving map / non-catalog.
 */

const STORAGE_KEY = 'airento:catalog-map-viewport-v1'

/**
 * @typedef {{
 *   south: number,
 *   north: number,
 *   west: number,
 *   east: number,
 *   selectedListingId?: string | null,
 * }} CatalogMapViewportSnapshot
 */

/**
 * @param {unknown} raw
 * @returns {CatalogMapViewportSnapshot | null}
 */
export function normalizeCatalogMapViewport(raw) {
  if (!raw || typeof raw !== 'object') return null
  const south = Number(raw.south)
  const north = Number(raw.north)
  const west = Number(raw.west)
  const east = Number(raw.east)
  if (![south, north, west, east].every((n) => Number.isFinite(n))) return null
  if (!(south < north) || !(west < east)) return null
  const selectedListingId = String(raw.selectedListingId || '').trim() || null
  return { south, north, west, east, selectedListingId }
}

export function clearCatalogMapViewport() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* private mode / quota */
  }
}

/**
 * @param {CatalogMapViewportSnapshot | null | undefined} snapshot
 */
export function rememberCatalogMapViewport(snapshot) {
  if (typeof window === 'undefined') return
  const next = normalizeCatalogMapViewport(snapshot)
  if (!next) return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* private mode / quota */
  }
}

/**
 * @returns {CatalogMapViewportSnapshot | null}
 */
export function peekCatalogMapViewport() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return normalizeCatalogMapViewport(JSON.parse(raw))
  } catch {
    return null
  }
}

/**
 * One-shot read for soft-back restore (then clear).
 * @returns {CatalogMapViewportSnapshot | null}
 */
export function consumeCatalogMapViewport() {
  const next = peekCatalogMapViewport()
  clearCatalogMapViewport()
  return next
}
