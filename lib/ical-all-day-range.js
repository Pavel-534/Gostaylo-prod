/**
 * iCal all-day events (DATE values): DTEND is exclusive per RFC 5545.
 * The last occupied calendar date is always the day before DTEND.
 *
 * Used by cron/admin parsers to match /api/ical/sync (calendar_blocks).
 * Timezone: dates are interpreted in UTC for YYYYMMDD (floating all-day).
 */

/**
 * @param {string} yyyymmdd - 8 digits from iCal DTEND (before TZ conversion)
 * @returns {string} YYYY-MM-DD last occupied night
 */
export function lastOccupiedDateFromExclusiveAllDayDtend(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length < 8) return null
  const y = parseInt(yyyymmdd.slice(0, 4), 10)
  const m = parseInt(yyyymmdd.slice(4, 6), 10) - 1
  const d = parseInt(yyyymmdd.slice(6, 8), 10)
  const utc = new Date(Date.UTC(y, m, d))
  utc.setUTCDate(utc.getUTCDate() - 1)
  return utc.toISOString().slice(0, 10)
}

/**
 * @param {string} yyyymmdd - 8 digits from iCal DTSTART
 * @returns {string} YYYY-MM-DD
 */
export function compactYmdToIsoDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length < 8) return null
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
}

/**
 * Same exclusive-DTEND rule as lastOccupiedDateFromExclusiveAllDayDtend, for Date from parseICalDate (all-day).
 * @param {Date} dtendDate
 * @returns {string} YYYY-MM-DD
 */
export function lastOccupiedNightIsoFromDtendDate(dtendDate) {
  const d = new Date(dtendDate)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
