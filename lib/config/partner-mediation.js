/**
 * Stage 20.0 — soft mediation window before official dispute + payment freeze.
 * Env: PARTNER_HELP_MEDIATION_MS (milliseconds), default 60 minutes.
 */

const DEFAULT_MS = 60 * 60 * 1000

function parseIntEnv(name, fallback) {
  const raw = process.env[name]
  if (raw == null || raw === '') return fallback
  const n = Number.parseInt(String(raw).trim(), 10)
  return Number.isFinite(n) && n >= 60_000 && n <= 48 * 60 * 60_000 ? n : fallback
}

export const PARTNER_HELP_MEDIATION_MS = parseIntEnv('PARTNER_HELP_MEDIATION_MS', DEFAULT_MS)
