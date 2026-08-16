/**
 * AUDIT_03 C3.4 — heal payments that look paid when booking never reached escrow / capture journal.
 * Prod `payment_status` enum: PENDING | PROCESSING | COMPLETED | FAILED | REFUNDED
 * (no CONFIRMED — Stage 201.67; querying CONFIRMED always failed → STALE_CRON spam).
 */

import { supabaseAdmin } from '@/lib/supabase'
import EscrowService from '@/lib/services/escrow.service'
import { isPaymentAcquiringWebhookIdempotentBookingStatus } from '@/lib/booking/status-sets.js'
import { logStructured } from '@/lib/critical-telemetry.js'

/** DB-canonical “paid / verified” status for legacy `payments` rows. */
export const LEGACY_PAID_PAYMENT_STATUS = 'COMPLETED'

/**
 * @param {string | null | undefined} bookingStatus
 * @returns {boolean}
 */
export function bookingNeedsEscrowAfterConfirmedPayment(bookingStatus) {
  return !isPaymentAcquiringWebhookIdempotentBookingStatus(bookingStatus)
}

/**
 * Stamp retry metadata on a paid legacy payment (best-effort).
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
 * Scan COMPLETED payments whose bookings are still outside the escrow pipeline.
 * Prefer capture-journal absence when ledger_journals is queryable; always filter by booking status.
 *
 * @param {{ limit?: number, attemptedBookingIds?: Set<string> }} [opts]
 */
export async function reconcileConfirmedPaymentsWithoutEscrow({
  limit = 50,
  attemptedBookingIds = null,
} = {}) {
  if (!supabaseAdmin) {
    return { success: false, error: 'Database not configured', processed: 0, healed: 0, failed: 0 }
  }

  const pageSize = Math.min(Math.max(Number(limit) || 50, 1), 200)
  const attempted = attemptedBookingIds instanceof Set ? attemptedBookingIds : null

  const { data: rows, error } = await supabaseAdmin
    .from('payments')
    .select('id, booking_id, status, metadata, tx_id, amount, created_at')
    .eq('status', LEGACY_PAID_PAYMENT_STATUS)
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
    const bookingId = String(payment.booking_id || '')
    if (attempted && bookingId && attempted.has(bookingId)) {
      skipped += 1
      continue
    }
    if (attempted && bookingId) attempted.add(bookingId)

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

/**
 * Full cron body: legacy CONFIRMED payments + PAID intents + crypto txid orphans.
 * One moveToEscrow per bookingId per run (shared attempted set).
 *
 * @param {{ limit?: number }} [opts]
 */
export async function runReconcileConfirmedPaymentsCron({ limit = 50 } = {}) {
  const attemptedBookingIds = new Set()

  const legacy = await reconcileConfirmedPaymentsWithoutEscrow({ limit, attemptedBookingIds })

  const {
    reconcilePaidIntentsWithoutEscrow,
    reconcileCryptoPaidWithoutEscrow,
  } = await import('@/lib/payment/reconcile-paid-intents-without-escrow.js')

  const intents = await reconcilePaidIntentsWithoutEscrow({ limit, attemptedBookingIds })
  const crypto = await reconcileCryptoPaidWithoutEscrow({ limit, attemptedBookingIds })

  const legacyConfirmed = Number(legacy.healed) || 0
  const intentsHealed = (Number(intents.healed) || 0) + (Number(crypto.healed) || 0)
  const intentsSkipped = (Number(intents.healSkipped) || 0) + (Number(crypto.healSkipped) || 0)
  const errors =
    (Number(legacy.failed) || 0) + (Number(intents.failed) || 0) + (Number(crypto.failed) || 0)

  const summaryLine = `legacy_confirmed: ${legacyConfirmed}, intents_healed: ${intentsHealed}, intents_skipped: ${intentsSkipped}, errors: ${errors}`

  return {
    success: legacy.success !== false && intents.success !== false && crypto.success !== false,
    summary: summaryLine,
    legacy_confirmed: legacyConfirmed,
    intents_healed: intentsHealed,
    intents_skipped: intentsSkipped,
    errors,
    legacy,
    intents,
    crypto,
    orphanedFound: intentsHealed + intentsSkipped,
  }
}
