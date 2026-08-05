/**
 * Shared month week matrix for partner mobile calendar (Stage 200.40 / 200.41).
 */

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
} from 'date-fns'

/**
 * @param {Date} anchorDate
 * @param {0|1|2|3|4|5|6} [weekStartsOn=1] Monday default
 * @returns {{ monthStart: Date, monthEnd: Date, weeks: Date[][] }}
 */
export function buildPartnerMonthMatrix(anchorDate, weekStartsOn = 1) {
  const monthStart = startOfMonth(anchorDate)
  const monthEnd = endOfMonth(anchorDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const weeks = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }
  return { monthStart, monthEnd, weeks }
}
