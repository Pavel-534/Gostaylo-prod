/**
 * Stage 177.1 — feature flag for unified discovery search pipeline.
 * Stage 177.5.0 — polygon search is additive and off by default (no RPC cost until enabled).
 */

/** @returns {boolean} */
export function isDiscoveryUnifiedPipelineEnabled() {
  return String(process.env.DISCOVERY_UNIFIED_PIPELINE || '').trim() === '1'
}

/**
 * Polygon URL parse + RPC. Requires unified pipeline; default off until Wave E1 UI (177.5.1).
 * @returns {boolean}
 */
export function isDiscoveryPolygonSearchEnabled() {
  return (
    isDiscoveryUnifiedPipelineEnabled() &&
    String(process.env.DISCOVERY_POLYGON_SEARCH || '').trim() === '1'
  )
}

/** @returns {'unified'|'legacy'} */
export function discoveryPipelineMode() {
  return isDiscoveryUnifiedPipelineEnabled() ? 'unified' : 'legacy'
}
