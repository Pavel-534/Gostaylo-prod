/**
 * Stage 201.97 — idle import of catalog client chunks (map and desktop filters stay out).
 */

export const CATALOG_CHUNK_PREWARM_MODULES = Object.freeze([
  '@/app/(storefront)/listings/listings-catalog-client',
  '@/components/search/ListingSidebar',
  '@/components/listing-card',
  '@/components/search/mobile/CatalogSearchSummaryBar',
])

function shouldSkipPrewarm() {
  if (typeof navigator === 'undefined') return true
  const connection =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection
  return connection?.saveData === true
}

export function prewarmCatalogChunks() {
  void import('@/app/(storefront)/listings/listings-catalog-client')
  void import('@/components/search/ListingSidebar')
  void import('@/components/listing-card')
  void import('@/components/search/mobile/CatalogSearchSummaryBar')
}

/**
 * @returns {() => void} cancel
 */
export function scheduleCatalogChunkPrewarm() {
  if (typeof window === 'undefined' || shouldSkipPrewarm()) return () => {}

  const run = () => {
    prewarmCatalogChunks()
  }
  const schedule =
    typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback
      : (cb) => window.setTimeout(cb, 900)
  const id = schedule(run)
  return () => {
    if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(id)
    else window.clearTimeout(id)
  }
}
