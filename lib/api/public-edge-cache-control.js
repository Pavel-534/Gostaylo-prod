/**
 * Stage 179.0a / 179.2a / 179.1 — conditional Vercel CDN Cache-Control (anonymous-only public reads).
 * ADR-163: map-pins / catalog search must not edge-cache session-dependent coordinate reveal.
 */

/** @type {string} */
export const PRIVATE_NO_STORE_CACHE_CONTROL = 'private, no-store'

/**
 * @param {{ sMaxAge: number, staleWhileRevalidate: number }} opts
 * @returns {string}
 */
export function buildAnonymousPublicEdgeCacheControl({ sMaxAge, staleWhileRevalidate }) {
  return `public, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`
}

/**
 * Map-pins: CDN only for anonymous 200 OK (coord privacy SSOT).
 * @param {{ viewerId?: string | null, status?: number }} opts
 * @returns {string}
 */
export function mapPinsEdgeCacheControl({ viewerId = null, status = 200 }) {
  if (status === 200 && !viewerId) {
    return buildAnonymousPublicEdgeCacheControl({ sMaxAge: 15, staleWhileRevalidate: 60 })
  }
  return PRIVATE_NO_STORE_CACHE_CONTROL
}

/**
 * Categories: CDN only for public catalog 200 OK (no admin / ?all=true preview).
 * @param {{ isAdminRequest?: boolean, includeInactive?: boolean, status?: number }} opts
 * @returns {string}
 */
export function categoriesEdgeCacheControl({
  isAdminRequest = false,
  includeInactive = false,
  status = 200,
}) {
  if (status === 200 && !isAdminRequest && !includeInactive) {
    return buildAnonymousPublicEdgeCacheControl({ sMaxAge: 300, staleWhileRevalidate: 600 })
  }
  return PRIVATE_NO_STORE_CACHE_CONTROL
}

/**
 * Catalog search (`run-listings-search-get`): CDN only for anonymous simple browse 200 OK.
 * Dates / bbox / polygon / facets / multi-guest / semantic / session → no-store (ADR-163).
 * @param {{ viewerId?: string | null, status?: number, isSimpleQuery?: boolean }} opts
 * @returns {string}
 */
export function listingsSearchEdgeCacheControl({
  viewerId = null,
  status = 200,
  isSimpleQuery = false,
}) {
  if (status === 200 && !viewerId && isSimpleQuery) {
    return buildAnonymousPublicEdgeCacheControl({ sMaxAge: 60, staleWhileRevalidate: 120 })
  }
  return PRIVATE_NO_STORE_CACHE_CONTROL
}

/**
 * @param {string} cacheControl
 * @returns {Record<string, string>}
 */
export function edgeCacheResponseHeaders(cacheControl) {
  const headers = { 'Cache-Control': cacheControl }
  // Stage 202.6 — Vercel CDN ignores Cache-Control when cookies present unless this is set.
  if (typeof cacheControl === 'string' && cacheControl.startsWith('public,')) {
    headers['Vercel-CDN-Cache-Control'] = cacheControl
  }
  return headers
}

/**
 * Retail FX display map (guest catalog/home). Settlement (`retail=0`) stays private.
 * @param {{ applyRetailMarkup?: boolean, status?: number }} opts
 * @returns {string}
 */
export function retailFxEdgeCacheControl({ applyRetailMarkup = true, status = 200 } = {}) {
  if (status === 200 && applyRetailMarkup) {
    return buildAnonymousPublicEdgeCacheControl({ sMaxAge: 60, staleWhileRevalidate: 300 })
  }
  return PRIVATE_NO_STORE_CACHE_CONTROL
}
