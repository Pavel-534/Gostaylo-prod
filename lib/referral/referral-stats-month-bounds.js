/**
 * Границы текущего календарного месяца в IANA TZ реферальной статистики (полуоткрытый интервал [start, end)).
 */

import { listingYmdAtStartOfDayIso } from '@/lib/listing-date'
import { currentYearMonthKeyInTimeZone } from '@/lib/referral/tz-year-month'

function daysInCalendarMonth(year, month1to12) {
  const y = Math.floor(Number(year)) || 1970
  const m = Math.min(12, Math.max(1, Math.floor(Number(month1to12)) || 1))
  return new Date(y, m, 0).getDate()
}

/**
 * @param {string} statsTz IANA
 * @param {Date} [refDate]
 * @returns {{ ymKey: string, monthStartUtcIso: string, monthEndExclusiveUtcIso: string, lastYmdInTz: string }}
 */
export function referralStatsCurrentMonthBoundsUtc(statsTz, refDate = new Date()) {
  const tz = String(statsTz || 'UTC').trim() || 'UTC'
  const ymKey = currentYearMonthKeyInTimeZone(tz) || ''
  if (!ymKey || ymKey.length < 7) {
    const d = refDate instanceof Date ? refDate : new Date(refDate)
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const pad = (n) => String(n).padStart(2, '0')
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0)).toISOString()
    const next = m === 12 ? [y + 1, 1] : [y, m + 1]
    const endEx = new Date(Date.UTC(next[0], next[1] - 1, 1, 0, 0, 0, 0)).toISOString()
    const dim = daysInCalendarMonth(y, m)
    return {
      ymKey: `${y}-${pad(m)}`,
      monthStartUtcIso: start,
      monthEndExclusiveUtcIso: endEx,
      lastYmdInTz: `${y}-${pad(m)}-${String(dim).padStart(2, '0')}`,
    }
  }

  const [yStr, mStr] = ymKey.split('-')
  const y = Number.parseInt(yStr, 10)
  const m = Number.parseInt(mStr, 10)
  const pad = (n) => String(n).padStart(2, '0')
  const monthStartUtcIso = listingYmdAtStartOfDayIso(`${y}-${pad(m)}-01`, tz)
  let ny = y
  let nm = m + 1
  if (nm > 12) {
    nm = 1
    ny += 1
  }
  const monthEndExclusiveUtcIso = listingYmdAtStartOfDayIso(`${ny}-${pad(nm)}-01`, tz)
  const dim = daysInCalendarMonth(y, m)
  const lastYmdInTz = `${y}-${pad(m)}-${String(dim).padStart(2, '0')}`

  return {
    ymKey,
    monthStartUtcIso: monthStartUtcIso || new Date(Date.UTC(y, m - 1, 1)).toISOString(),
    monthEndExclusiveUtcIso:
      monthEndExclusiveUtcIso || new Date(Date.UTC(ny, nm - 1, 1)).toISOString(),
    lastYmdInTz,
  }
}
