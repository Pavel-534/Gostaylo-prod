/**
 * Stage 152.1 / 175.4 — auto-cancel stale AWAITING_PAYMENT bookings (checkout hold TTL).
 * Chat-invoice bookings: deadline = invoice `expires_at` (payment-window-policy SSOT), not default 30m.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { BookingService } from '@/lib/services/booking.service'
import {
  resolveCheckoutHoldTtlMinutes,
  resolveCheckoutHoldAnchorIso,
  resolveCheckoutHoldExpiresAtIso,
  isCheckoutHoldExpired,
} from '@/lib/booking/checkout-hold-policy.js'
import { isChatInvoiceCheckoutBooking } from '@/lib/booking/payment-window-policy.js'

export { isChatInvoiceCheckoutBooking } from '@/lib/booking/payment-window-policy.js'

export {
  resolveCheckoutHoldTtlMinutes,
  resolveCheckoutHoldAnchorIso,
  resolveCheckoutHoldExpiresAtIso,
  isCheckoutHoldExpired,
} from '@/lib/booking/checkout-hold-policy.js'

/**
 * @param {{ limit?: number, ttlMinutes?: number, trigger?: string, onlyBookingIds?: string[] }} [options]
 */
export async function processExpiredAwaitingPaymentCheckouts(options = {}) {
  const defaultTtlMinutes = Math.max(
    5,
    Math.floor(Number(options.ttlMinutes) || resolveCheckoutHoldTtlMinutes()),
  )
  const limit = Math.max(1, Math.min(500, Math.floor(Number(options.limit) || 200)))
  const trigger = String(options.trigger || 'cron_checkout_hold_ttl')
  const onlyBookingIds = Array.isArray(options.onlyBookingIds)
    ? [...new Set(options.onlyBookingIds.map((id) => String(id || '').trim()).filter(Boolean))]
    : []
  const nowMs = Date.now()

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

  const bookingIds = (rows || []).map((r) => String(r.id || '')).filter(Boolean)
  const invoiceByBookingId = new Map()

  if (bookingIds.length) {
    const { data: pendingInvoices } = await supabaseAdmin
      .from('invoices')
      .select('id, booking_id, status, metadata, created_at')
      .in('booking_id', bookingIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    for (const inv of pendingInvoices || []) {
      const bid = String(inv.booking_id || '')
      if (bid && !invoiceByBookingId.has(bid)) {
        invoiceByBookingId.set(bid, inv)
      }
    }

    const chatInvoiceIds = (rows || [])
      .map((b) => {
        const meta = b?.metadata && typeof b.metadata === 'object' ? b.metadata : {}
        return meta.chat_invoice_id ? String(meta.chat_invoice_id) : ''
      })
      .filter(Boolean)

    const missingIds = [...new Set(chatInvoiceIds)].filter((id) => {
      for (const inv of invoiceByBookingId.values()) {
        if (String(inv.id) === id) return false
      }
      return true
    })

    if (missingIds.length) {
      const { data: byIdInvoices } = await supabaseAdmin
        .from('invoices')
        .select('id, booking_id, status, metadata, created_at')
        .in('id', missingIds)

      for (const inv of byIdInvoices || []) {
        const bid = String(inv.booking_id || '')
        if (bid && !invoiceByBookingId.has(bid)) {
          invoiceByBookingId.set(bid, inv)
        }
      }
    }
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
      .select('initiated_at, created_at, expires_at')
      .eq('booking_id', bookingId)
      .order('initiated_at', { ascending: false, nullsFirst: false })
      .limit(1)

    const intentRow = intents?.[0]
    const invoice = invoiceByBookingId.get(bookingId) || null

    if (
      !isCheckoutHoldExpired({
        booking,
        invoice,
        intentStartedAt: intentRow?.initiated_at || intentRow?.created_at || null,
        intentExpiresAt: intentRow?.expires_at || null,
        nowMs,
        defaultTtlMinutes,
      })
    ) {
      skipped += 1
      continue
    }

    const statusResult = await BookingService.updateStatus(bookingId, 'CANCELLED', {
      reason: isChatInvoiceCheckoutBooking(booking)
        ? 'auto_expired_invoice_payment_window'
        : 'auto_expired_checkout_hold',
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
    ttlMinutes: defaultTtlMinutes,
    nowIso: new Date(nowMs).toISOString(),
    cancelledIds,
  }
}

export default {
  resolveCheckoutHoldTtlMinutes,
  resolveCheckoutHoldAnchorIso,
  resolveCheckoutHoldExpiresAtIso,
  isCheckoutHoldExpired,
  processExpiredAwaitingPaymentCheckouts,
}
