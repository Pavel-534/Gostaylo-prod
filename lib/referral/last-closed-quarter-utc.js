/**
 * Last fully closed calendar quarter in UTC (ADR-131A §9.6).
 * Leaf — no DB. Used by quarterly stats cron and unit tests.
 */

function pad2(n) {
  return String(n).padStart(2, '0')
}

function isoDateUtc(year, monthIndex, day) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`
}

/**
 * @param {Date} [now]
 * @returns {{
 *   periodStart: string,
 *   periodEnd: string,
 *   startIso: string,
 *   endExclusiveIso: string,
 *   year: number,
 *   quarter: number,
 * }}
 */
export function resolveLastClosedQuarterUtc(now = new Date()) {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const currentQ = Math.floor(m / 3)
  const lastQ = currentQ === 0 ? 3 : currentQ - 1
  const year = currentQ === 0 ? y - 1 : y
  const startMonth = lastQ * 3
  const endExclusive = new Date(Date.UTC(year, startMonth + 3, 1))
  const lastDay = new Date(Date.UTC(year, startMonth + 3, 0)).getUTCDate()
  return {
    periodStart: isoDateUtc(year, startMonth, 1),
    periodEnd: isoDateUtc(year, startMonth + 2, lastDay),
    startIso: new Date(Date.UTC(year, startMonth, 1)).toISOString(),
    endExclusiveIso: endExclusive.toISOString(),
    year,
    quarter: lastQ + 1,
  }
}
