/**
 * Stage 200.17 — session scroll memory for soft back-nav (catalog ↔ PDP).
 * Pure helpers (no Next / React).
 */

const STORAGE_KEY = 'airento:route-scroll-v1'

/**
 * @param {string} routeKey
 * @returns {boolean}
 */
export function isScrollMemoryRouteKey(routeKey) {
  const key = String(routeKey || '').trim()
  if (!key) return false
  return (
    key === '/' ||
    key === 'home' ||
    key.startsWith('listings:') ||
    key.startsWith('my-bookings:') ||
    key.startsWith('/listings') ||
    key.startsWith('/my-bookings')
  )
}

/**
 * @param {string} routeKey
 * @param {number} y
 */
export function saveRouteScroll(routeKey, y) {
  if (typeof window === 'undefined') return
  const key = String(routeKey || '').trim()
  if (!isScrollMemoryRouteKey(key)) return
  const top = Math.max(0, Math.round(Number(y) || 0))
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    const map = raw ? JSON.parse(raw) : {}
    if (!map || typeof map !== 'object') return
    map[key] = top
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* private mode / quota */
  }
}

/**
 * Peek without clearing.
 * @param {string} routeKey
 * @returns {number | null}
 */
export function peekRouteScroll(routeKey) {
  if (typeof window === 'undefined') return null
  const key = String(routeKey || '').trim()
  if (!key) return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const map = JSON.parse(raw)
    const y = map?.[key]
    return typeof y === 'number' && Number.isFinite(y) ? y : null
  } catch {
    return null
  }
}

/**
 * Read and remove so a later remount does not jump again.
 * @param {string} routeKey
 * @returns {number | null}
 */
export function consumeRouteScroll(routeKey) {
  if (typeof window === 'undefined') return null
  const key = String(routeKey || '').trim()
  if (!key) return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const map = JSON.parse(raw)
    if (!map || typeof map !== 'object') return null
    const y = map[key]
    delete map[key]
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    return typeof y === 'number' && Number.isFinite(y) ? y : null
  } catch {
    return null
  }
}

/**
 * @param {string} [searchParamsKey]
 * @returns {string}
 */
export function listingsCatalogScrollKey(searchParamsKey = '') {
  return `listings:${String(searchParamsKey || '')}`
}
