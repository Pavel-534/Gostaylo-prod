/**
 * Stage 202.14 — pure helpers for date-change quote (no DB / PricingService).
 */

/**
 * @param {string | Date | null | undefined} checkIn
 * @param {string | Date | null | undefined} checkOut
 * @returns {number | null}
 */
export function nightsBetweenStay(checkIn, checkOut) {
  const a = new Date(checkIn)
  const b = new Date(checkOut)
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return null
  const nights = Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
  return Number.isFinite(nights) && nights > 0 ? nights : null
}

/**
 * @param {{
 *   currentCheckIn: string,
 *   currentCheckOut: string,
 *   proposedCheckIn: string,
 *   proposedCheckOut: string,
 * }} p
 * @returns {'extension' | 'shorten' | 'reschedule' | 'unchanged' | 'invalid'}
 */
export function resolveDateChangeMode(p) {
  const curIn = new Date(p.currentCheckIn)
  const curOut = new Date(p.currentCheckOut)
  const nextIn = new Date(p.proposedCheckIn)
  const nextOut = new Date(p.proposedCheckOut)
  if (
    ![curIn, curOut, nextIn, nextOut].every((d) => Number.isFinite(d.getTime())) ||
    nextOut.getTime() <= nextIn.getTime()
  ) {
    return 'invalid'
  }
  if (curIn.getTime() === nextIn.getTime() && curOut.getTime() === nextOut.getTime()) {
    return 'unchanged'
  }
  if (curIn.getTime() === nextIn.getTime() && nextOut.getTime() > curOut.getTime()) {
    return 'extension'
  }
  if (curIn.getTime() === nextIn.getTime() && nextOut.getTime() < curOut.getTime()) {
    return 'shorten'
  }
  return 'reschedule'
}
