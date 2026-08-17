/**
 * Stage 201.81 / 201.84 — remember catalog map camera for PDP soft-back.
 *
 * Stores bbox + optional center/zoom so remount restores the same scale (not world fit).
 * Session-only; cleared when map closes or soft-back restore finishes holding lock in React state.
 */

const STORAGE_KEY = 'airento:catalog-map-viewport-v1'

/**
 * @typedef {{
 *   south: number,
 *   north: number,
 *   west: number,
 *   east: number,
 *   centerLat?: number | null,
 *   centerLng?: number | null,
 *   zoom?: number | null,
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

  const centerLat = Number(raw.centerLat)
  const centerLng = Number(raw.centerLng)
  const zoom = Number(raw.zoom)
  const selectedListingId = String(raw.selectedListingId || '').trim() || null

  return {
    south,
    north,
    west,
    east,
    centerLat: Number.isFinite(centerLat) ? centerLat : null,
    centerLng: Number.isFinite(centerLng) ? centerLng : null,
    zoom: Number.isFinite(zoom) ? zoom : null,
    selectedListingId,
  }
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
 * One-shot read for soft-back restore (then clear storage; React lock holds camera).
 * @returns {CatalogMapViewportSnapshot | null}
 */
export function consumeCatalogMapViewport() {
  const next = peekCatalogMapViewport()
  clearCatalogMapViewport()
  return next
}
