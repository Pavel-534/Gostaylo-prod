/**
 * Stage 201.106 — optional map-rail jump diagnostics.
 * Dev: on. Production: off unless `localStorage.airento:map-rail-debug = 1`.
 */

export const CATALOG_MAP_RAIL_DEBUG_STORAGE_KEY = 'airento:map-rail-debug'

/**
 * @returns {boolean}
 */
export function isCatalogMapRailDebugEnabled() {
  if (typeof window === 'undefined') return false
  if (process.env.NODE_ENV === 'development') return true
  try {
    return window.localStorage?.getItem(CATALOG_MAP_RAIL_DEBUG_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * @param {{
 *   railCount?: number,
 *   pinCount?: number,
 *   clusterCount?: number,
 *   sourceCount?: number,
 *   boundsReady?: boolean,
 *   mode?: string | null,
 *   selectedListingId?: string | null,
 * }} snap
 */
export function summarizeCatalogMapRailDebug(snap = {}) {
  const railCount = Number(snap.railCount) || 0
  const pinCount = Number(snap.pinCount) || 0
  const clusterCount = Number(snap.clusterCount) || 0
  const sourceCount = Number(snap.sourceCount) || 0
  const selected = String(snap.selectedListingId || '').trim() || null
  const collapsedVsPins = pinCount >= 2 && railCount === 1
  return {
    railCount,
    pinCount,
    clusterCount,
    sourceCount,
    boundsReady: Boolean(snap.boundsReady),
    mode: snap.mode || null,
    selectedListingId: selected,
    collapsedVsPins,
  }
}

/**
 * Log only when the bottom rail count jumps, or one card vs several pins.
 * @param {ReturnType<typeof summarizeCatalogMapRailDebug> | null} prev
 * @param {ReturnType<typeof summarizeCatalogMapRailDebug>} next
 * @returns {boolean}
 */
export function shouldLogCatalogMapRailJump(prev, next) {
  if (!next) return false
  if (next.collapsedVsPins) return true
  if (!prev) return false
  return prev.railCount !== next.railCount
}

/**
 * @param {ReturnType<typeof summarizeCatalogMapRailDebug>} next
 * @param {ReturnType<typeof summarizeCatalogMapRailDebug> | null} [prev]
 */
export function logCatalogMapRailJump(next, prev = null) {
  if (!isCatalogMapRailDebugEnabled()) return
  if (!shouldLogCatalogMapRailJump(prev, next)) return
  // eslint-disable-next-line no-console -- gated diagnostic
  console.info('[airento:map-rail]', next)
}
