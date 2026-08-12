/**
 * Stage 200.125 — browser-safe season_type helpers (Select / wizard UI).
 * Keep free of FX / currency / server correlation graphs.
 */

/** Canonical season_type values for partner UI Selects (Stage 200.116). */
export const SEASON_TYPE_VALUES = Object.freeze(['LOW', 'NORMAL', 'HIGH', 'PEAK'])

/**
 * Normalize legacy / mixed-case season_type to Select-safe uppercase enum.
 * Unknown values fall back to NORMAL (not blank SelectValue).
 * @param {unknown} raw
 * @returns {'LOW'|'NORMAL'|'HIGH'|'PEAK'}
 */
export function normalizeSeasonType(raw) {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase()
  if (SEASON_TYPE_VALUES.includes(key)) return /** @type {'LOW'|'NORMAL'|'HIGH'|'PEAK'} */ (key)
  return 'NORMAL'
}
