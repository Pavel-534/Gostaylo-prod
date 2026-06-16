/**
 * Stage 152.1 — auto-cancel stale AWAITING_PAYMENT bookings (checkout hold TTL).
 * Releases calendar occupancy when guest abandons payment.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { BookingService } from '@/lib/services/booking.service'

const DEFAULT_TTL_MINUTES = 30

/**
 * @returns {number}
 */
export function resolveCheckoutHoldTtlMinutes() {
  const raw = Number(process.env.CHECKOUT_HOLD_TTL_MINUTES)
  if (Number.isFinite(raw) && raw >= 5) return Math.floor(raw)
  return DEFAULT_TTL_MINUTES
}

/**
 * Anchor for hold TTL: latest payment-intent start, else booking created_at.
 * Intentionally excludes `updated_at` — incidental row touches must not extend checkout hold.
 * @param {object} booking
 * @param {string|null|undefined} intentStartedAt — initiated_at or intent created_at
 */
export function resolveCheckoutHoldAnchorIso(booking, intentStartedAt) {
  const candidates = [intentStartedAt, booking?.created_at]
    .map((v) => (v != null && String(v).trim() !== '' ? String(v) : null))
    .filter(Boolean)
  if (!candidates.length) return null
  return candidates.sort().at(-1)
}

/**
 * @param {{ limit?: number, ttlMinutes?: number, trigger?: string, onlyBookingIds?: string[] }} [options]
 */
export async function processExpiredAwaitingPaymentCheckouts(options = {}) {
  const ttlMinutes = Math.max(
    5,
    Math.floor(Number(options.ttlMinutes) || resolveCheckoutHoldTtlMinutes()),
  )
  const limit = Math.max(1, Math.min(500, Math.floor(Number(options.limit) || 200)))
  const trigger = String(options.trigger || 'cron_checkout_hold_ttl')
  const onlyBookingIds = Array.isArray(options.onlyBookingIds)
    ? [...new Set(options.onlyBookingIds.map((id) => String(id || '').trim()).filter(Boolean))]
    : []
  const cutoffMs = Date.now() - ttlMinutes * 60 * 1000
  const cutoffIso = new Date(cutoffMs).toISOString()

  let bookingQuery = supabaseAdmin
    .from('bookings')
    .select('id, status, created_at, updated_at, metadata')
    .eq('status', 'AWAITING_PAYMENT')
    .order('updated_at', { ascending: true })
    .limit(onlyBookingIds.length ? Math.max(onlyBookingIds.length, limit) : limit)

  if (onlyBookingIds.length) {
    bookingQuery = bookingQuery.in('id', onlyBookingIds)
  }

  const { data: rows, error } = await bookingQuery

  if (error) {
    return { success: false, error: error.message || 'CHECKOUT_HOLD_READ_FAILED', scanned: 0, cancelled: 0 }
  }

  let cancelled = 0
  let skipped = 0
  let errors = 0
  const cancelledIds = []

  for (const booking of rows || []) {
    const bookingId = String(booking.id || '')
    if (!bookingId) continue

    const { data: intents } = await supabaseAdmin
      .from('payment_intents')
      .select('initiated_at, created_at')
      .eq('booking_id', bookingId)
      .order('initiated_at', { ascending: false, nullsFirst: false })
      .limit(1)

    const intentRow = intents?.[0]
    const anchorIso = resolveCheckoutHoldAnchorIso(
      booking,
      intentRow?.initiated_at || intentRow?.created_at || null,
    )
    if (!anchorIso || anchorIso > cutoffIso) {
      skipped += 1
      continue
    }

    const statusResult = await BookingService.updateStatus(bookingId, 'CANCELLED', {
      reason: 'auto_expired_checkout_hold',
      referralTrigger: trigger,
      bookingStatusScope: 'cancel',
    })
    if (!statusResult?.success) {
      errors += 1
      continue
    }
    cancelled += 1
    cancelledIds.push(bookingId)
  }

  return {
    success: true,
    scanned: (rows || []).length,
    cancelled,
    skipped,
    errors,
    ttlMinutes,
    cutoffIso,
    cancelledIds,
  }
}

export default {
  resolveCheckoutHoldTtlMinutes,
  resolveCheckoutHoldAnchorIso,
  processExpiredAwaitingPaymentCheckouts,
}
