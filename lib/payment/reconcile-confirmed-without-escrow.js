/**
 * AUDIT_03 C3.4 — heal payments.status=CONFIRMED when booking never reached escrow / capture journal.
 */

import { supabaseAdmin } from '@/lib/supabase'
import EscrowService from '@/lib/services/escrow.service'
import { isPaymentAcquiringWebhookIdempotentBookingStatus } from '@/lib/booking/status-sets.js'
import { logStructured } from '@/lib/critical-telemetry.js'

/**
 * @param {string | null | undefined} bookingStatus
 * @returns {boolean}
 */
export function bookingNeedsEscrowAfterConfirmedPayment(bookingStatus) {
  return !isPaymentAcquiringWebhookIdempotentBookingStatus(bookingStatus)
}

/**
 * Stamp retry metadata on a CONFIRMED payment (best-effort).
 * @param {object} payment
 * @param {{ error?: string }} [extra]
 */
export async function stampPaymentEscrowAttempt(payment, extra = {}) {
  if (!supabaseAdmin || !payment?.id) return
  const now = new Date().toISOString()
  const meta =
    payment.metadata && typeof payment.metadata === 'object' ? { ...payment.metadata } : {}
  meta.escrow_attempted_at = now
  if (extra.error) {
    meta.escrow_last_error = String(extra.error).slice(0, 500)
  }
  const { error } = await supabaseAdmin
    .from('payments')
    .update({ metadata: meta, updated_at: now })
    .eq('id', payment.id)
  if (error) {
    console.warn('[reconcile-confirmed] stamp escrow attempt', payment.id, error.message)
  }
}

/**
 * If booking is not yet in escrow/completed pipeline, call moveToEscrow.
 * @param {object} payment — payments row
 * @param {object} [verificationData]
 */
export async function ensureEscrowForConfirmedPayment(payment, verificationData = {}) {
  const bookingId = payment?.booking_id
  if (!bookingId || !supabaseAdmin) {
    return { success: false, error: 'booking_required' }
  }

  const { data: booking, error: bErr } = await supabaseAdmin
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId)
    .maybeSingle()

  if (bErr || !booking) {
    return { success: false, error: bErr?.message || 'booking_not_found' }
  }

  if (!bookingNeedsEscrowAfterConfirmedPayment(booking.status)) {
    return { success: true, alreadyEscrowed: true, bookingStatus: booking.status }
  }

  await stampPaymentEscrowAttempt(payment)

  const escrow = await EscrowService.moveToEscrow(bookingId, {
    ...verificationData,
    payment_id: payment.id,
    source: verificationData?.source || 'reconcile_confirmed_without_escrow',
  })

  if (!escrow?.success) {
    await stampPaymentEscrowAttempt(payment, { error: escrow?.error || 'escrow_failed' })
    return { success: false, error: escrow?.error || 'Escrow transition failed', bookingStatus: booking.status }
  }

  return { success: true, escrow: escrow.escrow, bookingStatus: 'PAID_ESCROW' }
}

/**
 * Scan CONFIRMED payments whose bookings are still outside the escrow pipeline.
 * Prefer capture-journal absence when ledger_journals is queryable; always filter by booking status.
 *
 * @param {{ limit?: number }} [opts]
 */
export async function reconcileConfirmedPaymentsWithoutEscrow({ limit = 50 } = {}) {
  if (!supabaseAdmin) {
    return { success: false, error: 'Database not configured', processed: 0, healed: 0, failed: 0 }
  }

  const pageSize = Math.min(Math.max(Number(limit) || 50, 1), 200)

  const { data: rows, error } = await supabaseAdmin
    .from('payments')
    .select('id, booking_id, status, metadata, tx_id, amount, created_at')
    .eq('status', 'CONFIRMED')
    .not('booking_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(pageSize)

  if (error) {
    return { success: false, error: error.message, processed: 0, healed: 0, failed: 0 }
  }

  let processed = 0
  let healed = 0
  let failed = 0
  let skipped = 0
  const errors = []

  for (const payment of rows || []) {
    processed += 1
    const result = await ensureEscrowForConfirmedPayment(payment, {
      source: 'cron_reconcile_confirmed_without_escrow',
      txid: payment.tx_id || null,
    })
    if (result.alreadyEscrowed) {
      skipped += 1
      continue
    }
    if (result.success) {
      healed += 1
      logStructured({
        module: 'reconcile-confirmed-without-escrow',
        stage: 'C3.4',
        paymentId: payment.id,
        bookingId: payment.booking_id,
        healed: true,
      })
    } else {
      failed += 1
      errors.push({ paymentId: payment.id, bookingId: payment.booking_id, error: result.error })
    }
  }

  return {
    success: failed === 0,
    processed,
    healed,
    failed,
    skipped,
    errors: errors.slice(0, 20),
  }
}
