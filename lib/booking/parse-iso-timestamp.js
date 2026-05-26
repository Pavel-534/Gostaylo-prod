/**
 * Stage 118.0 — безопасный разбор TIMESTAMPTZ / ISO из Postgres 17 и JSON metadata.
 * Избегает сбоев promote-ready-for-payout при нестандартных строках даты.
 */

/**
 * @param {unknown} raw
 * @returns {number | null} epoch ms
 */
export function parseIsoTimestampMs(raw) {
  if (raw == null || raw === '') return null
  if (raw instanceof Date) {
    const t = raw.getTime()
    return Number.isFinite(t) ? t : null
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw > 1e12 ? raw : raw * 1000
  }
  const s = String(raw).trim()
  if (!s) return null
  let t = Date.parse(s)
  if (Number.isFinite(t)) return t
  const normalized = s.includes('T') ? s : s.replace(' ', 'T')
  t = Date.parse(normalized)
  return Number.isFinite(t) ? t : null
}
