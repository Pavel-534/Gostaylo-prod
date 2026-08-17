/**
 * Stage 201.97 — storefront Search tab keep-alive (Home ↔ catalog list).
 * Path helpers + reveal registry. React host: `StorefrontSearchKeepAlive`.
 */

/**
 * Catalog list only (`/listings`), not PDP `/listings/[id]`.
 * @param {string | null | undefined} pathname
 */
export function isStorefrontCatalogListPath(pathname) {
  const normalized = String(pathname || '').replace(/\/+$/, '') || '/'
  return normalized === '/listings'
}

/**
 * Routes that may park the catalog tree in memory.
 * @param {string | null | undefined} pathname
 */
export function isStorefrontSearchKeepAlivePath(pathname) {
  const normalized = String(pathname || '').replace(/\/+$/, '') || '/'
  return normalized === '/' || normalized === '/listings'
}

/** @type {null | (() => boolean)} */
let revealHandler = null

/**
 * @param {() => boolean} handler
 * @returns {() => void}
 */
export function registerStorefrontSearchKeepAliveReveal(handler) {
  revealHandler = handler
  return () => {
    if (revealHandler === handler) revealHandler = null
  }
}

/** @returns {boolean} true when a parked catalog was shown immediately */
export function revealStorefrontSearchKeepAlive() {
  if (typeof revealHandler !== 'function') return false
  return revealHandler() === true
}
