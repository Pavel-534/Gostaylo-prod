/**
 * Stage 84.5 — гуманное SLA по спорам.
 * Env override: DISPUTE_SLA_MS (по умолчанию 72 часа).
 */

const DEFAULT_DISPUTE_SLA_MS = 72 * 60 * 60 * 1000

function parseSlaMs(raw, fallback) {
  if (raw == null || raw === '') return fallback
  const n = Number.parseInt(String(raw).trim(), 10)
  // 1h..30d safety guard
  if (!Number.isFinite(n) || n < 60 * 60 * 1000 || n > 30 * 24 * 60 * 60 * 1000) return fallback
  return n
}

export const DISPUTE_SLA_MS = parseSlaMs(process.env.DISPUTE_SLA_MS, DEFAULT_DISPUTE_SLA_MS)
export const DISPUTE_SLA_HOURS = Math.round(DISPUTE_SLA_MS / (60 * 60 * 1000))

export function computeDisputeDeadlineIso(fromDate = new Date()) {
  const baseMs = fromDate instanceof Date ? fromDate.getTime() : Date.parse(String(fromDate || ''))
  const safe = Number.isFinite(baseMs) ? baseMs : Date.now()
  return new Date(safe + DISPUTE_SLA_MS).toISOString()
}
