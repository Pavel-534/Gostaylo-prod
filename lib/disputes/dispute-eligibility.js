import { toListingDate } from '@/lib/listing-date'
import {
  DISPUTE_BLOCKED_BOOKING_STATUSES,
  DISPUTE_EARLY_BOOKING_STATUSES,
} from '@/lib/booking/status-sets.js'

function toTimestamp(value) {
  const ts = Date.parse(String(value || ''))
  return Number.isFinite(ts) ? ts : null
}

export function canOpenOfficialDispute({ status, checkInIso, checkOutIso, now = new Date() }) {
  const code = String(status || '').trim().toUpperCase()
  if (!code || DISPUTE_BLOCKED_BOOKING_STATUSES.has(code)) {
    return { allowed: false, reason: 'status_not_eligible' }
  }

  const nowMs = now instanceof Date ? now.getTime() : Date.now()
  const checkInTs = toTimestamp(checkInIso)
  const checkOutTs = toTimestamp(checkOutIso)

  // Avoid very early spam while booking is still ahead.
  if (DISPUTE_EARLY_BOOKING_STATUSES.has(code) && checkInTs) {
    const hoursBeforeCheckIn = (checkInTs - nowMs) / (1000 * 60 * 60)
    if (hoursBeforeCheckIn > 48) {
      return { allowed: false, reason: 'too_early_before_checkin' }
    }
  }

  // Disputes should be opened while evidence is still fresh.
  if (checkOutTs) {
    const msAfterCheckOut = nowMs - checkOutTs
    const daysAfterCheckOut = msAfterCheckOut / (1000 * 60 * 60 * 24)
    if (daysAfterCheckOut > 14) {
      return { allowed: false, reason: 'window_expired' }
    }
  }

  return { allowed: true, reason: null }
}

export function canOpenOfficialDisputeFromBooking(booking, now = new Date()) {
  const checkIn = booking?.check_in || booking?.checkIn || booking?.unified_order?.dates?.check_in || null
  const checkOut = booking?.check_out || booking?.checkOut || booking?.unified_order?.dates?.check_out || null
  const status = booking?.status || booking?.unified_order?.status || ''
  return canOpenOfficialDispute({
    status,
    checkInIso: checkIn,
    checkOutIso: checkOut,
    now,
  })
}

export function summarizeDisputeTiming(booking) {
  const checkIn = toListingDate(booking?.check_in || booking?.checkIn)
  const checkOut = toListingDate(booking?.check_out || booking?.checkOut)
  return { checkIn, checkOut }
}
