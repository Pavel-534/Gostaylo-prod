/**
 * AUDIT_MONEY_FLOW_04 — heal payment_intents.status=PAID (and crypto payments with txid)
 * when booking never reached PAID_ESCROW. Same RPC idempotency as webhooks:
 * booking_payment_capture:{bookingId}.
 *
 * Invoked from reconcile-confirmed-payments cron alongside legacy payments.COMPLETED heal.
 */

import { supabaseAdmin } from '@/lib/supabase'
import EscrowService from '@/lib/services/escrow.service'
import {
  ESCROW_PIPELINE_STATUSES,
  isPaymentAcquiringWebhookIdempotentBookingStatus,
} from '@/lib/booking/status-sets.js'
import { recordCriticalSignal, logStructured } from '@/lib/critical-telemetry.js'
import {
  assertCryptoTxidAvailable,
  normalizeCryptoTxid,
} from '@/lib/payment/crypto-txid-replay-guard.js'

/** TZ: do not auto-escrow — manual review (HEAL_SKIP). */
export const HEAL_SKIP_BOOKING_STATUSES = Object.freeze(
  new Set(['CANCELLED', 'REFUNDED', 'COMPLETED', 'DISPUTED', 'DECLINED']),
)

const MIN_AGE_MS = 5 * 60 * 1000

/**
 * @param {string | null | undefined} status
 */
export function isHealSkipBookingStatus(status) {
  return HEAL_SKIP_BOOKING_STATUSES.has(String(status || '').toUpperCase())
}

/**
 * @param {string | null | undefined} status
 */
export function bookingAlreadyPastCapture(status) {
  const st = String(status || '').toUpperCase()
  if (ESCROW_PIPELINE_STATUSES.includes(st)) return true
  return isPaymentAcquiringWebhookIdempotentBookingStatus(st) && !isHealSkipBookingStatus(st)
}

function alertHealSkip({ bookingId, intentStatus, bookingStatus, source, extra }) {
  recordCriticalSignal('HEAL_SKIP', {
    severity: 'WARN',
    tag: '[FINANCE]',
    threshold: 1,
    windowMs: 60 * 60 * 1000,
    detailLines: [
      `[HEAL_SKIP] intent PAID but booking ${bookingId || 'unknown'} is ${bookingStatus || 'unknown'} — manual review required`,
      `intentStatus=${intentStatus || 'unknown'}`,
      `source=${source || 'unknown'}`,
      ...(extra ? [String(extra).slice(0, 300)] : []),
    ],
  })
}

/**
 * Avoid hourly HEAL_SKIP spam for the same intent/payment.
 * @param {'payment_intents' | 'payments'} table
 * @param {string} id
 * @param {object} [existingMeta]
 */
async function stampHealSkip(table, id, existingMeta = {}) {
  if (!supabaseAdmin || !id) return
  const now = new Date().toISOString()
  const meta = existingMeta && typeof existingMeta === 'object' ? { ...existingMeta } : {}
  if (meta.heal_skip_at) return { alreadyStamped: true }
  meta.heal_skip_at = now
  meta.heal_skip_reason = 'paid_without_escrow_terminal_booking'
  const { error } = await supabaseAdmin
    .from(table)
    .update({ metadata: meta, updated_at: now })
    .eq('id', id)
  if (error) {
    console.warn('[reconcile-paid-intents] stamp heal_skip', table, id, error.message)
  }
  return { alreadyStamped: false }
}

function alertHealError({ bookingId, error, source }) {
  recordCriticalSignal('HEAL_ERROR', {
    severity: 'CRITICAL',
    tag: '[FINANCE]',
    threshold: 1,
    windowMs: 60 * 60 * 1000,
    detailLines: [
      `[HEAL_ERROR] orphaned paid intent / crypto heal failed`,
      `bookingId=${bookingId || 'unknown'}`,
      `source=${source || 'unknown'}`,
      `error=${String(error || 'unknown').slice(0, 400)}`,
    ],
  })
}

/**
 * Extract crypto txid from intent metadata or payment row.
 * @param {object} row
 */
export function extractHealTxid(row) {
  if (!row || typeof row !== 'object') return null
  const fromPay = normalizeCryptoTxid(row.tx_id || row.txId)
  if (fromPay) return fromPay
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  return (
    normalizeCryptoTxid(meta.crypto_txid) ||
    normalizeCryptoTxid(meta.txid) ||
    normalizeCryptoTxid(meta.txId) ||
    null
  )
}

/**
 * Single booking heal attempt (deduped via attemptedBookingIds).
 *
 * @param {{
 *   bookingId: string,
 *   source: string,
 *   intentStatus?: string,
 *   txId?: string | null,
 *   gatewayRef?: string | null,
 *   captureGuestTotalThb?: number | null,
 *   paymentId?: string | null,
 *   intentId?: string | null,
 *   rowMetadata?: object | null,
 *   stampTable?: 'payment_intents' | 'payments' | null,
 *   attemptedBookingIds: Set<string>,
 * }} args
 */
export async function healOrphanedPaidBookingEscrow(args) {
  const bookingId = String(args.bookingId || '').trim()
  const attempted = args.attemptedBookingIds
  if (!bookingId || !supabaseAdmin) {
    return { success: false, error: 'booking_required' }
  }
  if (attempted instanceof Set && attempted.has(bookingId)) {
    return { success: true, skippedDuplicate: true }
  }
  if (attempted instanceof Set) attempted.add(bookingId)

  const { data: booking, error: bErr } = await supabaseAdmin
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId)
    .maybeSingle()

  if (bErr || !booking) {
    const err = bErr?.message || 'booking_not_found'
    alertHealError({ bookingId, error: err, source: args.source })
    return { success: false, error: err }
  }

  const bookingStatus = String(booking.status || '').toUpperCase()

  if (bookingAlreadyPastCapture(bookingStatus) || bookingStatus === 'PAID_ESCROW') {
    return { success: true, alreadyEscrowed: true, bookingStatus }
  }

  if (isHealSkipBookingStatus(bookingStatus)) {
    const meta = args.rowMetadata && typeof args.rowMetadata === 'object' ? args.rowMetadata : {}
    const already = Boolean(meta.heal_skip_at)
    if (!already) {
      alertHealSkip({
        bookingId,
        intentStatus: args.intentStatus || 'PAID',
        bookingStatus,
        source: args.source,
      })
      if (args.stampTable && (args.intentId || args.paymentId)) {
        await stampHealSkip(args.stampTable, args.intentId || args.paymentId, meta)
      }
    }
    return { success: true, healSkipped: true, bookingStatus, alreadyAlerted: already }
  }

  const txId = normalizeCryptoTxid(args.txId) || null
  if (txId) {
    const replay = await assertCryptoTxidAvailable(supabaseAdmin, { txid: txId, bookingId })
    if (!replay.ok) {
      const code = String(replay.code || '')
      const sameBooking =
        code === 'ALREADY_PROCESSED' && String(replay.existingBookingId || '') === bookingId
      if (!sameBooking) {
        if (code === 'TXID_ALREADY_USED' || code === 'ALREADY_PROCESSED') {
          const meta = args.rowMetadata && typeof args.rowMetadata === 'object' ? args.rowMetadata : {}
          const already = Boolean(meta.heal_skip_at)
          if (!already) {
            alertHealSkip({
              bookingId,
              intentStatus: args.intentStatus || 'PAID',
              bookingStatus,
              source: args.source,
              extra: `txid_conflict code=${code} existing=${replay.existingBookingId || ''}`,
            })
            if (args.stampTable && (args.intentId || args.paymentId)) {
              await stampHealSkip(args.stampTable, args.intentId || args.paymentId, meta)
            }
          }
          return {
            success: true,
            healSkipped: true,
            bookingStatus,
            error: replay.error,
            alreadyAlerted: already,
          }
        }
        alertHealError({ bookingId, error: replay.error || code, source: args.source })
        return { success: false, error: replay.error || code, bookingStatus }
      }
      // same booking already has this txid — continue to moveToEscrow
    }
  }

  const escrow = await EscrowService.moveToEscrow(bookingId, {
    source: args.source || 'reconcile_paid_intent_without_escrow',
    txId,
    gatewayRef: args.gatewayRef || null,
    payment_id: args.paymentId || null,
    intent_id: args.intentId || null,
    ...(Number.isFinite(Number(args.captureGuestTotalThb)) && Number(args.captureGuestTotalThb) > 0
      ? { captureGuestTotalThb: Number(args.captureGuestTotalThb) }
      : {}),
  })

  if (!escrow?.success) {
    const err = escrow?.error || 'escrow_failed'
    alertHealError({ bookingId, error: err, source: args.source })
    return { success: false, error: err, bookingStatus }
  }

  logStructured({
    module: 'reconcile-paid-intents-without-escrow',
    stage: 'heal',
    bookingId,
    intentId: args.intentId || null,
    paymentId: args.paymentId || null,
    healed: true,
  })

  return { success: true, healed: true, bookingStatus: 'PAID_ESCROW', escrow: escrow.escrow }
}

/**
 * Scan PAID payment_intents older than 5 minutes whose bookings are not PAID_ESCROW.
 *
 * @param {{ limit?: number, attemptedBookingIds?: Set<string>, minAgeMs?: number }} [opts]
 */
export async function reconcilePaidIntentsWithoutEscrow(opts = {}) {
  if (!supabaseAdmin) {
    return {
      success: false,
      error: 'Database not configured',
      processed: 0,
      healed: 0,
      skipped: 0,
      failed: 0,
    }
  }

  const pageSize = Math.min(Math.max(Number(opts.limit) || 50, 1), 200)
  const attempted = opts.attemptedBookingIds instanceof Set ? opts.attemptedBookingIds : new Set()
  const minAgeMs = Number.isFinite(opts.minAgeMs) ? opts.minAgeMs : MIN_AGE_MS
  const olderThanIso = new Date(Date.now() - minAgeMs).toISOString()

  const { data: rows, error } = await supabaseAdmin
    .from('payment_intents')
    .select(
      'id, booking_id, status, amount_thb, preferred_method, metadata, confirmed_at, created_at, external_ref',
    )
    .eq('status', 'PAID')
    .not('booking_id', 'is', null)
    .lt('created_at', olderThanIso)
    .order('created_at', { ascending: true })
    .limit(pageSize)

  if (error) {
    return {
      success: false,
      error: error.message,
      processed: 0,
      healed: 0,
      skipped: 0,
      failed: 0,
    }
  }

  let processed = 0
  let healed = 0
  let skipped = 0
  let healSkipped = 0
  let failed = 0
  const errors = []

  for (const intent of rows || []) {
    processed += 1
    const bookingId = String(intent.booking_id || '')
    const result = await healOrphanedPaidBookingEscrow({
      bookingId,
      source: 'cron_reconcile_paid_intent_without_escrow',
      intentStatus: intent.status,
      intentId: intent.id,
      txId: extractHealTxid(intent),
      gatewayRef: intent.external_ref || null,
      captureGuestTotalThb: intent.amount_thb,
      rowMetadata: intent.metadata,
      stampTable: 'payment_intents',
      attemptedBookingIds: attempted,
    })

    if (result.skippedDuplicate || result.alreadyEscrowed) {
      skipped += 1
      continue
    }
    if (result.healSkipped) {
      // Count only first-time skips for orphaned TG summary
      if (!result.alreadyAlerted) healSkipped += 1
      else skipped += 1
      continue
    }
    if (result.success && result.healed) {
      healed += 1
      continue
    }
    failed += 1
    errors.push({ intentId: intent.id, bookingId, error: result.error })
  }

  return {
    success: failed === 0,
    processed,
    healed,
    skipped,
    healSkipped,
    failed,
    errors: errors.slice(0, 20),
  }
}

/**
 * Crypto: payment row has txid, booking not escrowed (partial write / 409 after markPaid).
 *
 * @param {{ limit?: number, attemptedBookingIds?: Set<string>, minAgeMs?: number }} [opts]
 */
export async function reconcileCryptoPaidWithoutEscrow(opts = {}) {
  if (!supabaseAdmin) {
    return {
      success: false,
      error: 'Database not configured',
      processed: 0,
      healed: 0,
      skipped: 0,
      failed: 0,
    }
  }

  const pageSize = Math.min(Math.max(Number(opts.limit) || 50, 1), 200)
  const attempted = opts.attemptedBookingIds instanceof Set ? opts.attemptedBookingIds : new Set()
  const minAgeMs = Number.isFinite(opts.minAgeMs) ? opts.minAgeMs : MIN_AGE_MS
  const olderThanIso = new Date(Date.now() - minAgeMs).toISOString()

  const { data: rows, error } = await supabaseAdmin
    .from('payments')
    .select('id, booking_id, status, method, metadata, tx_id, amount, created_at')
    // Stage 201.71 — prod payment_status has no CONFIRMED (enum blow-up → STALE_CRON).
    .eq('status', 'COMPLETED')
    .eq('method', 'CRYPTO')
    .not('booking_id', 'is', null)
    .not('tx_id', 'is', null)
    .lt('created_at', olderThanIso)
    .order('created_at', { ascending: true })
    .limit(pageSize)

  if (error) {
    return {
      success: false,
      error: error.message,
      processed: 0,
      healed: 0,
      skipped: 0,
      failed: 0,
    }
  }

  let processed = 0
  let healed = 0
  let skipped = 0
  let healSkipped = 0
  let failed = 0
  const errors = []

  for (const payment of rows || []) {
    processed += 1
    const bookingId = String(payment.booking_id || '')
    const result = await healOrphanedPaidBookingEscrow({
      bookingId,
      source: 'cron_reconcile_crypto_paid_without_escrow',
      intentStatus: payment.status,
      paymentId: payment.id,
      txId: extractHealTxid(payment),
      captureGuestTotalThb: payment.amount,
      rowMetadata: payment.metadata,
      stampTable: 'payments',
      attemptedBookingIds: attempted,
    })

    if (result.skippedDuplicate || result.alreadyEscrowed) {
      skipped += 1
      continue
    }
    if (result.healSkipped) {
      if (!result.alreadyAlerted) healSkipped += 1
      else skipped += 1
      continue
    }
    if (result.success && result.healed) {
      healed += 1
      continue
    }
    failed += 1
    errors.push({ paymentId: payment.id, bookingId, error: result.error })
  }

  return {
    success: failed === 0,
    processed,
    healed,
    skipped,
    healSkipped,
    failed,
    errors: errors.slice(0, 20),
  }
}
