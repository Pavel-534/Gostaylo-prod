/**
 * Partner calendar date string helpers (Stage 200.120).
 * Keep free of React — usable from tests and ActionModals.
 */

import { format } from 'date-fns'

/**
 * Parse `yyyy-MM-dd` to local Date (noon) — safe for calendar cells.
 * @param {string | null | undefined} ymd
 * @returns {Date | null}
 */
export function parsePartnerYmd(ymd) {
  if (!ymd || typeof ymd !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!y || !mo || !d) return null
  return new Date(y, mo - 1, d, 12, 0, 0, 0)
}

/**
 * @param {Date | null | undefined} date
 * @returns {string}
 */
export function formatPartnerYmd(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return format(date, 'yyyy-MM-dd')
}
