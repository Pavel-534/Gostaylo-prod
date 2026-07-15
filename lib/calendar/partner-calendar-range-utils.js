/**
 * Partner master calendar — date range selection helpers (Stage 188.0 Iteration 3).
 */

import { parseISO, format, eachDayOfInterval } from 'date-fns'

/**
 * @param {string} a YYYY-MM-DD
 * @param {string} b YYYY-MM-DD
 */
export function compareCalendarDates(a, b) {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * @param {Record<string, { status?: string }>|undefined} availability
 * @param {string} start YYYY-MM-DD
 * @param {string} end YYYY-MM-DD inclusive
 * @returns {{ valid: boolean, blockedDate?: string }}
 */
export function validateAvailableDateRange(availability, start, end) {
  if (!start || !end || !availability) {
    return { valid: false }
  }
  const from = start <= end ? start : end
  const to = start <= end ? end : start

  let days
  try {
    days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) })
  } catch {
    return { valid: false }
  }

  for (const day of days) {
    const key = format(day, 'yyyy-MM-dd')
    const cell = availability[key]
    if (cell?.status === 'BOOKED') {
      return { valid: false, blockedDate: key }
    }
  }

  return { valid: true }
}

/**
 * Visual role for range highlight on a cell.
 * @returns {'pending-start'|'single'|'start'|'end'|'middle'|null}
 */
export function resolveCalendarRangeCellRole({ listingId, date, rangeSelection }) {
  if (!rangeSelection || rangeSelection.listingId !== listingId || !rangeSelection.start) {
    return null
  }

  const { start, end } = rangeSelection

  if (!end) {
    return date === start ? 'pending-start' : null
  }

  const from = start <= end ? start : end
  const to = start <= end ? end : start

  if (date < from || date > to) return null
  if (from === to && date === from) return 'single'
  if (date === from) return 'start'
  if (date === to) return 'end'
  return 'middle'
}

/**
 * Tailwind classes for range highlight (AVAILABLE cells).
 * @param {'pending-start'|'single'|'start'|'end'|'middle'|null} role
 */
export function calendarRangeHighlightClass(role) {
  if (!role) return ''
  if (role === 'pending-start') {
    return 'bg-brand/15 ring-2 ring-inset ring-brand/50 z-[1]'
  }
  if (role === 'single') {
    return 'bg-brand/15 ring-2 ring-inset ring-brand/45 rounded-lg z-[1]'
  }
  if (role === 'start') {
    return 'bg-brand/10 ring-2 ring-inset ring-brand/35 rounded-l-xl z-[1]'
  }
  if (role === 'end') {
    return 'bg-brand/10 ring-2 ring-inset ring-brand/35 rounded-r-xl z-[1]'
  }
  return 'bg-brand/10 z-[1]'
}
