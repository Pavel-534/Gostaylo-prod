/**
 * Stage 200.99 — stay listing arrival hours (check-in / check-out) + soft flexibility flags.
 * Informational only — no calendar block, no booking price, no ledger.
 */

/** HH:mm slots every 30 minutes. */
export function buildArrivalTimeSlots(stepMinutes = 30) {
  const out = []
  for (let h = 0; h < 24; h += 1) {
    for (let m = 0; m < 60; m += stepMinutes) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return out
}

export const ARRIVAL_TIME_SLOTS = buildArrivalTimeSlots(30)

const TIME_RE = /^\d{2}:\d{2}$/

/**
 * @param {unknown} raw
 * @returns {string} HH:mm or ''
 */
export function normalizeArrivalTime(raw) {
  const t = String(raw ?? '').trim()
  if (!TIME_RE.test(t)) return ''
  return ARRIVAL_TIME_SLOTS.includes(t) ? t : ''
}

/**
 * @param {Record<string, unknown> | null | undefined} meta
 */
export function readStayArrivalFromMetadata(meta) {
  const m = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {}
  return {
    checkInTime: normalizeArrivalTime(m.check_in_time ?? m.checkInTime),
    checkOutTime: normalizeArrivalTime(m.check_out_time ?? m.checkOutTime),
    earlyCheckInOnRequest: m.early_check_in_on_request === true || m.earlyCheckInOnRequest === true,
    lateCheckOutOnRequest: m.late_check_out_on_request === true || m.lateCheckOutOnRequest === true,
  }
}
