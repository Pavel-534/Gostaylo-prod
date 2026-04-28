/**
 * Календарный месяц в UTC (полуинтервал [start, end)) — SSOT для админ-лидерборда и отчётов компании.
 */

/**
 * @param {number} year
 * @param {number} month1to12
 * @returns {{ ymKey: string, monthStartUtcIso: string, monthEndExclusiveUtcIso: string }}
 */
export function utcCalendarMonthBounds(year, month1to12) {
  const y = Math.floor(Number(year)) || new Date().getUTCFullYear()
  const m = Math.min(12, Math.max(1, Math.floor(Number(month1to12)) || 1))
  const pad = (n) => String(n).padStart(2, '0')
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0)).toISOString()
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  const endEx = new Date(Date.UTC(ny, nm - 1, 1, 0, 0, 0, 0)).toISOString()
  return {
    ymKey: `${y}-${pad(m)}`,
    monthStartUtcIso: start,
    monthEndExclusiveUtcIso: endEx,
  }
}

/** Текущий календарный месяц UTC (год и месяц по UTC «сейчас»). */
export function currentUtcYearMonth() {
  const d = new Date()
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
}
