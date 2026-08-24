/**
 * Stage 202.7 — poll YooKassa for stuck INITIATED MIR intents when webhooks lag.
 * Architecture unchanged: capture:true + platform escrow (Stage 130). No two-stage hold.
 *
 * Invoked from POST /api/cron/reconcile-yookassa-pending
 * (external every 10 minutes; Vercel daily fallback).
 */

import { supabaseAdmin } from '@/lib/supabase'
import PaymentIntentService from '@/lib/services/payment-intent.service'
import { applyInvoicePostPaymentEffects } from '@/lib/services/invoice-extension.service'
import { formatRubAmountValue, getPayment } from '@/lib/payments/yookassa.js'
import {
  resolveAcquirerChargeAmount,
} from '@/lib/services/payment-adapters/acquirer-charge-amount.js'
import { ADAPTER_KEYS } from '@/lib/services/payment-adapters/constants'
import { isPaymentAcquiringWebhookIdempotentBookingStatus } from '@/lib/booking/status-sets.js'
import {
  healOrphanedPaidBookingEscrow,
  isHealSkipBookingStatus,
} from '@/lib/payment/reconcile-paid-intents-without-escrow.js'
import { logStructured, recordCriticalSignal } from '@/lib/critical-telemetry.js'
import {
  YOOKASSA_PENDING_MAX_AGE_MS,
  YOOKASSA_PENDING_MIN_AGE_MS,
  isIntentAgeEligibleForYookassaPoll,
  resolveYookassaPaymentIdFromIntent,
} from '@/lib/payment/yookassa-pending-reconcile-helpers.js'

export {
  YOOKASSA_PENDING_MAX_AGE_MS,
  YOOKASSA_PENDING_MIN_AGE_MS,
  isIntentAgeEligibleForYookassaPoll,
  resolveYookassaPaymentIdFromIntent,
} from '@/lib/payment/yookassa-pending-reconcile-helpers.js'

function stampIntentPollMeta(intentRow, patch) {
  const meta =
    intentRow.metadata && typeof intentRow.metadata === 'object' ? { ...intentRow.metadata } : {}
  meta.yookassa_pending_poll = {
    ...(meta.yookassa_pending_poll && typeof meta.yookassa_pending_poll === 'object'
      ? meta.yookassa_pending_poll
      : {}),
    ...patch,
    at: new Date().toISOString(),
  }
  return meta
}

/**
 * @param {{ limit?: number }} [opts]
 */
export async function reconcileInitiatedYookassaIntents({ limit = 30 } = {}) {
  if (!supabaseAdmin) {
    return {
      success: false,
      error: 'Database not configured',
      processed: 0,
      settled: 0,
      canceled: 0,
      pending: 0,
      failed: 0,
      skipped: 0,
    }
  }

  const pageSize = Math.min(Math.max(Number(limit) || 30, 1), 100)
  const nowMs = Date.now()
  const oldestIso = new Date(nowMs - YOOKASSA_PENDING_MAX_AGE_MS).toISOString()
  const newestIso = new Date(nowMs - YOOKASSA_PENDING_MIN_AGE_MS).toISOString()

  const { data: rows, error } = await supabaseAdmin
    .from('payment_intents')
    .select(
      'id, booking_id, invoice_id, status, amount_thb, preferred_method, provider, external_ref, metadata, initiated_at, created_at',
    )
    .eq('status', 'INITIATED')
    .eq('provider', 'MIR_RU')
    .not('external_ref', 'is', null)
    .gte('initiated_at', oldestIso)
    .lte('initiated_at', newestIso)
    .order('initiated_at', { ascending: true })
    .limit(pageSize)

  if (error) {
    return {
      success: false,
      error: error.message,
      processed: 0,
      settled: 0,
      canceled: 0,
      pending: 0,
      failed: 0,
      skipped: 0,
    }
  }

  let processed = 0
  let settled = 0
  let canceled = 0
  let pending = 0
  let failed = 0
  let skipped = 0
  const errors = []
  const attemptedBookingIds = new Set()

  for (const row of rows || []) {
    processed += 1
    const intentId = String(row.id || '')
    const bookingId = String(row.booking_id || '')
    const paymentId = resolveYookassaPaymentIdFromIntent(row.external_ref, row.metadata)

    if (!paymentId || !bookingId || !intentId) {
      skipped += 1
      continue
    }

    if (
      !isIntentAgeEligibleForYookassaPoll(row.initiated_at || row.created_at, nowMs)
    ) {
      skipped += 1
      continue
    }

    const verified = await getPayment(paymentId)
    if (!verified.ok) {
      failed += 1
      errors.push({ intentId, bookingId, error: verified.code || 'getPayment_failed' })
      continue
    }

    const ykStatus = String(verified.status || '').toLowerCase()

    if (ykStatus === 'pending' || ykStatus === 'waiting_for_capture') {
      pending += 1
      await supabaseAdmin
        .from('payment_intents')
        .update({
          metadata: stampIntentPollMeta(row, { status: ykStatus, payment_id: paymentId }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', intentId)
      continue
    }

    if (ykStatus === 'canceled' || ykStatus === 'cancelled') {
      const marked = await PaymentIntentService.markTerminalFailure(intentId, {
        status: 'CANCELLED',
        gatewayRef: paymentId,
        source: 'cron_reconcile_yookassa_pending',
        raw: verified.raw || null,
      })
      if (marked.success) canceled += 1
      else {
        failed += 1
        errors.push({ intentId, bookingId, error: marked.error || 'mark_cancelled_failed' })
      }
      continue
    }

    if (ykStatus !== 'succeeded' || verified.paid !== true) {
      skipped += 1
      continue
    }

    const md = verified.metadata || {}
    const metaBookingId = String(md.booking_id || md.bookingId || '')
    const metaIntentId = String(md.payment_intent_id || md.paymentIntentId || '')
    if (metaBookingId !== bookingId || metaIntentId !== intentId) {
      failed += 1
      errors.push({ intentId, bookingId, error: 'metadata_mismatch' })
      recordCriticalSignal('YOOKASSA_PENDING_META_MISMATCH', {
        severity: 'CRITICAL',
        tag: '[FINANCE]',
        threshold: 1,
        windowMs: 60 * 60 * 1000,
        detailLines: [
          `intent=${intentId} booking=${bookingId}`,
          `yk_booking=${metaBookingId} yk_intent=${metaIntentId}`,
        ],
      })
      continue
    }

    const { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle()

    if (bErr || !booking) {
      failed += 1
      errors.push({ intentId, bookingId, error: bErr?.message || 'booking_not_found' })
      continue
    }

    const intentForCharge = {
      id: intentId,
      amountThb: Number(row.amount_thb || 0),
      metadata: row.metadata,
    }

    let expectedRub
    try {
      const charge = resolveAcquirerChargeAmount({
        booking,
        intent: intentForCharge,
        adapterKey: ADAPTER_KEYS.MIR_RU,
      })
      expectedRub = formatRubAmountValue(charge.acquirerAmount ?? charge.amount)
    } catch (e) {
      failed += 1
      errors.push({
        intentId,
        bookingId,
        error: e?.code || e?.message || 'expected_rub_unavailable',
      })
      continue
    }

    const receivedRub = formatRubAmountValue(verified.amount?.value)
    const receivedCur = String(verified.amount?.currency || '').toUpperCase()
    if (receivedCur !== 'RUB' || !expectedRub || receivedRub !== expectedRub) {
      failed += 1
      errors.push({ intentId, bookingId, error: 'amount_mismatch' })
      recordCriticalSignal('YOOKASSA_PENDING_AMOUNT_MISMATCH', {
        severity: 'CRITICAL',
        tag: '[FINANCE]',
        threshold: 1,
        windowMs: 60 * 60 * 1000,
        detailLines: [
          `intent=${intentId} booking=${bookingId}`,
          `expected=${expectedRub} RUB received=${receivedRub} ${receivedCur}`,
        ],
      })
      continue
    }

    const marked = await PaymentIntentService.markPaid(intentId, {
      gatewayRef: paymentId,
      source: 'cron_reconcile_yookassa_pending',
      raw: verified.raw || null,
    })
    if (!marked.success) {
      failed += 1
      errors.push({ intentId, bookingId, error: marked.error || 'markPaid_failed' })
      continue
    }

    const bookingStatus = String(booking.status || '').toUpperCase()
    if (isPaymentAcquiringWebhookIdempotentBookingStatus(bookingStatus)) {
      if (row.invoice_id) {
        await applyInvoicePostPaymentEffects({
          bookingId,
          invoiceId: row.invoice_id,
          txId: null,
          gatewayRef: paymentId,
          source: 'cron_reconcile_yookassa_pending',
        })
      }
      settled += 1
      logStructured({
        module: 'reconcile-initiated-yookassa',
        stage: '202.7',
        intentId,
        bookingId,
        outcome: 'post_escrow_or_idempotent',
      })
      continue
    }

    if (isHealSkipBookingStatus(bookingStatus)) {
      skipped += 1
      continue
    }

    const heal = await healOrphanedPaidBookingEscrow({
      bookingId,
      source: 'cron_reconcile_yookassa_pending',
      intentStatus: 'PAID',
      gatewayRef: paymentId,
      captureGuestTotalThb: Number(row.amount_thb || 0) || null,
      intentId,
      rowMetadata: row.metadata,
      stampTable: 'payment_intents',
      attemptedBookingIds,
    })

    if (heal.success && !heal.healSkipped) {
      settled += 1
      if (row.invoice_id) {
        await applyInvoicePostPaymentEffects({
          bookingId,
          invoiceId: row.invoice_id,
          txId: null,
          gatewayRef: paymentId,
          source: 'cron_reconcile_yookassa_pending',
        })
      }
      logStructured({
        module: 'reconcile-initiated-yookassa',
        stage: '202.7',
        intentId,
        bookingId,
        outcome: 'settled',
      })
    } else if (heal.healSkipped) {
      skipped += 1
    } else {
      // markPaid succeeded — leave for reconcile-confirmed-payments; count as settled-at-PSP
      settled += 1
      errors.push({
        intentId,
        bookingId,
        error: heal.error || 'escrow_deferred',
        deferred: true,
      })
    }
    }

  return {
    success: failed === 0,
    processed,
    settled,
    canceled,
    pending,
    failed,
    skipped,
    errors: errors.slice(0, 20),
    summary: `settled:${settled} canceled:${canceled} pending:${pending} failed:${failed} skipped:${skipped}`,
  }
}
