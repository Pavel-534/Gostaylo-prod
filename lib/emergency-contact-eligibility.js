/**
 * Stage 24.0 — Emergency contact vs official dispute: wider status window (pre-service),
 * same post-checkout horizon as disputes for freshness.
 */

const EMERGENCY_BLOCKED_STATUSES = new Set([
  'PENDING',
  'INQUIRY',
  'CANCELLED',
  'DECLINED',
  'COMPLETED',
  'FINISHED',
  'REFUNDED',
  'EXPIRED',
])

/** Active lifecycle: renter may need partner before or during service (Super-App: any listing type). */
const EMERGENCY_ALLOWED_STATUSES = new Set([
  'CONFIRMED',
  'AWAITING_PAYMENT',
  'PAID',
  'PAID_ESCROW',
  'CHECKED_IN',
  'THAWED',
])

function toTimestamp(value) {
  const ts = Date.parse(String(value || ''))
  return Number.isFinite(ts) ? ts : null
}

/**
 * @param {{ status: unknown, checkOutIso?: unknown, now?: Date }} p
 * @returns {{ allowed: boolean, reason: string | null }}
 */
export function canRenterUseEmergencyContactBooking({ status, checkOutIso, now = new Date() }) {
  const code = String(status || '').trim().toUpperCase()
  if (!code || EMERGENCY_BLOCKED_STATUSES.has(code)) {
    return { allowed: false, reason: 'status_not_eligible' }
  }
  if (!EMERGENCY_ALLOWED_STATUSES.has(code)) {
    return { allowed: false, reason: 'status_not_eligible' }
  }

  const nowMs = now instanceof Date ? now.getTime() : Date.now()
  const checkOutTs = toTimestamp(checkOutIso)
  if (checkOutTs) {
    const msAfterCheckOut = nowMs - checkOutTs
    const daysAfterCheckOut = msAfterCheckOut / (1000 * 60 * 60 * 24)
    if (daysAfterCheckOut > 14) {
      return { allowed: false, reason: 'window_expired' }
    }
  }

  return { allowed: true, reason: null }
}
