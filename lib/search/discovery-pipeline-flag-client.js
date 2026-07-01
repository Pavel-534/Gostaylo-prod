/**
 * Stage 177.2 — client mirror of `DISCOVERY_UNIFIED_PIPELINE` (catalog cursor pagination).
 * Server SSOT: `lib/search/discovery-pipeline-flag.js` + env `DISCOVERY_UNIFIED_PIPELINE=1`.
 * Browser: `NEXT_PUBLIC_DISCOVERY_UNIFIED_PIPELINE=1` (must match server when enabling cursor UX).
 */

import { isDiscoveryStableCatalogSort } from '@/lib/search/discovery-cursor-codec'

/** @returns {boolean} */
export function isDiscoveryUnifiedPipelineClientEnabled() {
  return String(process.env.NEXT_PUBLIC_DISCOVERY_UNIFIED_PIPELINE || '').trim() === '1'
}

/**
 * Cursor append/load-more only when unified pipeline is on and sort is `created_at`.
 * @param {string | null | undefined} sort
 * @returns {boolean}
 */
export function isCatalogCursorPaginationClientEnabled(sort) {
  return isDiscoveryUnifiedPipelineClientEnabled() && isDiscoveryStableCatalogSort(sort)
}
