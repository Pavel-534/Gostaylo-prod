/**
 * Wave H1 — unpaid AWAITING_PAYMENT abandonment FCM (soft retention nudge).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { PushService } from '@/lib/services/push.service.js'
import {
  resolveCheckoutHoldExpiresAtIso,
  resolveCheckoutHoldTtlMinutes,
  isCheckoutHoldExpired,
} from '@/lib/booking/checkout-hold-policy.js'
import { resolveSilentForPushDelivery } from '@/lib/services/push/push-quiet-policy.js'
import {
  resolveUnpaidCheckoutNudgeDelayMinutes,
  resolveUnpaidCheckoutNudgeMinRemainingMinutes,
  evaluateUnpaidCheckoutNudgeEligibility,
  buildUnpaidCheckoutPushData,
} from '@/lib/booking/unpaid-checkout-retention-policy.js'

export {
  resolveUnpaidCheckoutNudgeDelayMinutes,
  resolveUnpaidCheckoutNudgeMinRemainingMinutes,
  unpaidCheckoutDeepLink,
  evaluateUnpaidCheckoutNudgeEligibility,
  buildUnpaidCheckoutPushData,
} from '@/lib/booking/unpaid-checkout-retention-policy.js'

/**
 * @param {{ limit?: number, nowMs?: number, delayMinutes?: number, minRemainingMinutes?: number }} [options]
 */
export async function processUnpaidCheckoutNudges(options = {}) {
  if (!supabaseAdmin) {
    return { success: false, error: 'no_supabase', scanned: 0, sent: 0, skipped: 0, errors: 0 }
  }

  const limit = Math.max(1, Math.min(200, Math.floor(Number(options.limit) || 80)))
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now()
  const delayMinutes =
    options.delayMinutes != null
      ? Math.max(1, Math.floor(Number(options.delayMinutes)))
      : resolveUnpaidCheckoutNudgeDelayMinutes()
  const minRemainingMinutes =
    options.minRemainingMinutes != null
      ? Math.max(1, Math.floor(Number(options.minRemainingMinutes)))
      : resolveUnpaidCheckoutNudgeMinRemainingMinutes()
  const defaultTtlMinutes = resolveCheckoutHoldTtlMinutes()

  const { data: rows, error } = await supabaseAdmin
    .from('bookings')
    .select(
      'id, status, created_at, updated_at, metadata, renter_id, guest_name, listings(title)',
    )
    .eq('status', 'AWAITING_PAYMENT')
    .order('updated_at', { ascending: true })
    .limit(limit)

  if (error) {
    return {
      success: false,
      error: error.message || 'UNPAID_NUDGE_READ_FAILED',
      scanned: 0,
      sent: 0,
      skipped: 0,
      errors: 1,
    }
  }

  let sent = 0
  let skipped = 0
  let errors = 0
  const sentIds = []

  for (const booking of rows || []) {
    const bookingId = String(booking.id || '')
    if (!bookingId) {
      skipped += 1
      continue
    }

    const meta = booking.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
    if (meta.unpaid_checkout_nudge_sent_at) {
      skipped += 1
      continue
    }

    const { data: intents } = await supabaseAdmin
      .from('payment_intents')
      .select('initiated_at, created_at, expires_at')
      .eq('booking_id', bookingId)
      .order('initiated_at', { ascending: false, nullsFirst: false })
      .limit(1)

    const intentRow = intents?.[0]
    let invoice = null
    if (meta.chat_invoice_id || meta.invoiceId) {
      const invId = String(meta.chat_invoice_id || meta.invoiceId)
      const { data: inv } = await supabaseAdmin
        .from('invoices')
        .select('id, booking_id, status, metadata, created_at')
        .eq('id', invId)
        .maybeSingle()
      invoice = inv
    }

    const expiresAtIso = resolveCheckoutHoldExpiresAtIso({
      booking,
      invoice,
      intentStartedAt: intentRow?.initiated_at || intentRow?.created_at || meta.paymentInitiatedAt || null,
      intentExpiresAt: intentRow?.expires_at || null,
      defaultTtlMinutes,
    })

    if (
      isCheckoutHoldExpired({
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

    const eligibility = evaluateUnpaidCheckoutNudgeEligibility({
      status: booking.status,
      metadata: meta,
      paymentInitiatedAt: meta.paymentInitiatedAt || intentRow?.initiated_at || intentRow?.created_at,
      createdAt: booking.created_at,
      expiresAtIso,
      nowMs,
      delayMinutes,
      minRemainingMinutes,
    })

    if (!eligibility.ok) {
      skipped += 1
      continue
    }

    const renterId = booking.renter_id != null ? String(booking.renter_id) : ''
    if (!renterId) {
      skipped += 1
      continue
    }

    const quiet = await resolveSilentForPushDelivery(renterId, [], {
      bookingId,
      listingId: null,
    })
    if (quiet) {
      skipped += 1
      continue
    }

    const listingTitle = booking?.listings?.title || meta.listing_title || '—'

    try {
      const pushResult = await PushService.sendToUser(
        renterId,
        'CHECKOUT_ABANDONED',
        buildUnpaidCheckoutPushData({ bookingId, listingTitle }),
      )

      if (!pushResult?.success && !pushResult?.skipped) {
        console.warn('[unpaid-checkout-nudge] push miss', bookingId, pushResult?.error)
      }

      const nextMeta = {
        ...meta,
        unpaid_checkout_nudge_sent_at: new Date(nowMs).toISOString(),
        unpaid_checkout_nudge_push_ok: Boolean(pushResult?.success),
      }
      const { error: upErr } = await supabaseAdmin
        .from('bookings')
        .update({ metadata: nextMeta, updated_at: new Date(nowMs).toISOString() })
        .eq('id', bookingId)
        .eq('status', 'AWAITING_PAYMENT')

      if (upErr) {
        console.error('[unpaid-checkout-nudge] metadata', upErr.message)
        errors += 1
        continue
      }

      if (pushResult?.success) {
        sent += 1
        sentIds.push(bookingId)
      } else {
        skipped += 1
      }
    } catch (e) {
      console.error('[unpaid-checkout-nudge]', e?.message || e)
      errors += 1
    }
  }

  return {
    success: true,
    scanned: (rows || []).length,
    sent,
    skipped,
    errors,
    delayMinutes,
    minRemainingMinutes,
    sentIds,
    nowIso: new Date(nowMs).toISOString(),
  }
}
