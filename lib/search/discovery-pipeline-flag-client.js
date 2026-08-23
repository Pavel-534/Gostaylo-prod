/**
 * Stage 177.2 — client mirror of `DISCOVERY_UNIFIED_PIPELINE` (catalog cursor pagination).
 * Stage 177.5.1 — polygon draw UI gated by `NEXT_PUBLIC_DISCOVERY_POLYGON_SEARCH`.
 * Server SSOT: `lib/search/discovery-pipeline-flag.js`.
 * Browser: `NEXT_PUBLIC_DISCOVERY_UNIFIED_PIPELINE=1` (must match server when enabling cursor UX).
 */

import { isDiscoveryStableCatalogSort } from '@/lib/search/discovery-cursor-codec'

/** @returns {boolean} */
export function isDiscoveryUnifiedPipelineClientEnabled() {
  return String(process.env.NEXT_PUBLIC_DISCOVERY_UNIFIED_PIPELINE || '').trim() === '1'
}

/**
 * Show desktop Pencil + write `polygon=` only when public flag is on.
 * Server still requires DISCOVERY_UNIFIED_PIPELINE + DISCOVERY_POLYGON_SEARCH for filter.
 * @returns {boolean}
 */
export function isDiscoveryPolygonDrawClientEnabled() {
  return (
    isDiscoveryUnifiedPipelineClientEnabled() &&
    String(process.env.NEXT_PUBLIC_DISCOVERY_POLYGON_SEARCH || '').trim() === '1'
  )
}

/**
 * Cursor append/load-more only when unified pipeline is on and sort is `created_at`.
 * @param {string | null | undefined} sort
 * @returns {boolean}
 */
export function isCatalogCursorPaginationClientEnabled(sort) {
  return isDiscoveryUnifiedPipelineClientEnabled() && isDiscoveryStableCatalogSort(sort)
}
