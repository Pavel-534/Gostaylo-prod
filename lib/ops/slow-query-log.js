/**
 * Stage 166 — slow spatial/search query tracing + optional EXPLAIN ANALYZE.
 */

import { logStructured } from '@/lib/critical-telemetry.js'
import { supabaseAdmin } from '@/lib/supabase'
import {
  recordSpatialCircuitFailure,
  recordSpatialCircuitSuccess,
  assertSpatialCircuitClosed,
} from '@/lib/ops/spatial-circuit-breaker.js'

const DEFAULT_SLOW_MS = 800

function slowThresholdMs() {
  const raw = parseInt(process.env.SPATIAL_SLOW_QUERY_MS || '', 10)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_SLOW_MS
}

/**
 * @param {object} params
 */
function sanitizeParams(params) {
  if (!params || typeof params !== 'object') return {}
  const out = {}
  for (const [k, v] of Object.entries(params)) {
    if (k.includes('password') || k.includes('token')) continue
    out[k] = v
  }
  return out
}

/**
 * @param {string} op
 * @param {object} params
 */
async function maybeLogExplainAnalyze(op, params) {
  if (process.env.SPATIAL_EXPLAIN_SLOW !== '1') return
  if (!supabaseAdmin || op !== 'gist_bbox_lookup') return
  const bbox = params?.bbox
  if (!bbox) return
  try {
    const { data, error } = await supabaseAdmin.rpc('spatial_explain_bbox_gist_v1', {
      p_south: bbox.south,
      p_west: bbox.west,
      p_north: bbox.north,
      p_east: bbox.east,
      p_limit: params?.limit ?? 50,
    })
    if (!error && data) {
      logStructured({
        module: 'EXPLAIN_ANALYZE',
        op,
        plan_lines: String(data).split('\n').slice(0, 24),
      })
      console.warn(`[EXPLAIN_ANALYZE] ${op}\n${String(data).slice(0, 2000)}`)
    }
  } catch {
    /* diagnostics only */
  }
}

/**
 * @template T
 * @param {string} op
 * @param {object} params
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function traceSpatialQuery(op, params, fn) {
  assertSpatialCircuitClosed(op)
  const started = Date.now()
  try {
    const result = await fn()
    const durationMs = Date.now() - started
    recordSpatialCircuitSuccess(op)
    if (durationMs >= slowThresholdMs()) {
      logStructured({
        module: 'SLOW_QUERY',
        op,
        duration_ms: durationMs,
        params: sanitizeParams(params),
      })
      console.warn(`[SLOW_QUERY] op=${op} duration_ms=${durationMs}`, sanitizeParams(params))
      await maybeLogExplainAnalyze(op, params)
    }
    return { result, durationMs }
  } catch (e) {
    recordSpatialCircuitFailure(op)
    throw e
  }
}
