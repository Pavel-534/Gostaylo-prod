/**
 * Дневные суммы earned referral_ledger для sparkline (календарные дни в TZ пользователя).
 */

import { rollingDayKeysInTimeZone, dateKeyInTimeZone } from '@/lib/referral/tz-year-month'

/**
 * @param {Array<{ amount_thb?: unknown, earned_at?: string | null, updated_at?: string | null }>} rows
 * @param {string} timeZone
 * @param {number} dayCount
 * @returns {number[]}
 */
export function buildReferralEarningsSparklineThb(rows, timeZone, dayCount = 14) {
  const keys = rollingDayKeysInTimeZone(dayCount, timeZone)
  if (!keys.length) return []
  const map = new Map()
  for (const k of keys) map.set(k, 0)

  for (const row of rows || []) {
    const iso = row?.earned_at || row?.updated_at
    if (!iso) continue
    const dk = dateKeyInTimeZone(iso, timeZone)
    if (!dk || !map.has(dk)) continue
    const amt = Number(row?.amount_thb) || 0
    map.set(dk, (map.get(dk) || 0) + amt)
  }

  return keys.map((k) => Math.round((map.get(k) || 0) * 100) / 100)
}
