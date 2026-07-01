/**
 * Stage 177.1 — feature flag for unified discovery search pipeline.
 */

/** @returns {boolean} */
export function isDiscoveryUnifiedPipelineEnabled() {
  return String(process.env.DISCOVERY_UNIFIED_PIPELINE || '').trim() === '1'
}

/** @returns {'unified'|'legacy'} */
export function discoveryPipelineMode() {
  return isDiscoveryUnifiedPipelineEnabled() ? 'unified' : 'legacy'
}
