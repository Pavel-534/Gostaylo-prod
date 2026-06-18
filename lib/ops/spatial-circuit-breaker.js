/**
 * Stage 166 — lightweight circuit breaker for PostGIS / spatial RPC paths.
 */

const FAILURE_THRESHOLD = 5
const OPEN_MS = 30 * 1000
const WINDOW_MS = 60 * 1000

/** @type {Map<string, { failures: number, windowStart: number, openUntil: number }>} */
const states = new Map()

/**
 * @param {string} op
 */
export function assertSpatialCircuitClosed(op) {
  const key = String(op || 'spatial')
  const st = states.get(key)
  if (st && st.openUntil > Date.now()) {
    const err = new Error(`Spatial circuit open for ${key}`)
    err.code = 'SPATIAL_CIRCUIT_OPEN'
    throw err
  }
}

/**
 * @param {string} op
 */
export function recordSpatialCircuitSuccess(op) {
  const key = String(op || 'spatial')
  states.delete(key)
}

/**
 * @param {string} op
 */
export function recordSpatialCircuitFailure(op) {
  const key = String(op || 'spatial')
  const now = Date.now()
  let st = states.get(key)
  if (!st || now - st.windowStart > WINDOW_MS) {
    st = { failures: 0, windowStart: now, openUntil: 0 }
  }
  st.failures += 1
  if (st.failures >= FAILURE_THRESHOLD) {
    st.openUntil = now + OPEN_MS
    st.failures = 0
    st.windowStart = now
  }
  states.set(key, st)
}

/** @internal */
export function resetSpatialCircuitForTests() {
  states.clear()
}

/**
 * @returns {object}
 */
export function getSpatialCircuitSnapshot() {
  const now = Date.now()
  const open = []
  for (const [op, st] of states.entries()) {
    if (st.openUntil > now) open.push({ op, openUntil: new Date(st.openUntil).toISOString() })
  }
  return { openCircuits: open, trackedOps: states.size }
}
