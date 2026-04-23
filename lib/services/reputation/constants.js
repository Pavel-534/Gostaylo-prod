/** @type {readonly string[]} */
export const SUCCESS_STATUSES = ['THAWED', 'COMPLETED', 'FINISHED']

/** ~6 months — incidents older than this count at half weight */
export const RECENCY_CUTOFF_MS = 183 * 24 * 60 * 60 * 1000

export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

export function incidentRecencyWeight(iso) {
  if (!iso) return 1
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return 1
  const age = Date.now() - t
  return age > RECENCY_CUTOFF_MS ? 0.5 : 1
}
