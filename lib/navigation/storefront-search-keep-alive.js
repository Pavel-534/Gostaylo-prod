/**
 * Stage 201.97 / 201.102 — storefront Search keep-alive (Home ↔ catalog list).
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
 * Guest listing PDP (`/listings/:id`), not list or nested edit routes.
 * @param {string | null | undefined} pathname
 */
export function isStorefrontListingPdpPath(pathname) {
  const normalized = String(pathname || '').replace(/\/+$/, '') || '/'
  return /^\/listings\/[^/]+$/.test(normalized)
}

/**
 * @param {string | null | undefined} pathname
 * @returns {string | null}
 */
export function storefrontListingPdpId(pathname) {
  const normalized = String(pathname || '').replace(/\/+$/, '') || '/'
  const match = /^\/listings\/([^/]+)$/.exec(normalized)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

/**
 * Routes that may park Home + catalog trees in memory.
 * PDP is excluded to avoid mobile memory pressure / cold restarts.
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
