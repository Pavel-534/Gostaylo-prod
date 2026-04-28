/**
 * Ключ «год-месяц» в заданном IANA TZ для сравнения периодов начислений.
 */

export function yearMonthKeyInTimeZone(dateInput, timeZone) {
  const tz = String(timeZone || 'UTC').trim() || 'UTC'
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (Number.isNaN(d.getTime())) return ''
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(d)
    const y = parts.find((p) => p.type === 'year')?.value
    const m = parts.find((p) => p.type === 'month')?.value
    if (!y || !m) return ''
    const mm = String(m).padStart(2, '0')
    return `${y}-${mm}`
  } catch {
    return ''
  }
}

export function currentYearMonthKeyInTimeZone(timeZone) {
  return yearMonthKeyInTimeZone(new Date(), timeZone)
}

/** YYYY-MM-DD в заданном TZ (для агрегации sparkline). */
export function dateKeyInTimeZone(dateInput, timeZone) {
  const tz = String(timeZone || 'UTC').trim() || 'UTC'
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  } catch {
    return ''
  }
}

/**
 * Последние `dayCount` календарных дней в TZ, от старых к новым (для sparkline слева направо).
 * @param {number} dayCount
 * @param {string} timeZone
 * @returns {string[]}
 */
export function rollingDayKeysInTimeZone(dayCount, timeZone) {
  const n = Math.min(90, Math.max(1, Math.floor(Number(dayCount) || 14)))
  const tz = String(timeZone || 'Asia/Bangkok').trim() || 'Asia/Bangkok'
  const keys = []
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(Date.now() - i * 86400000)
    const k = dateKeyInTimeZone(t, tz)
    if (k) keys.push(k)
  }
  return keys
}
