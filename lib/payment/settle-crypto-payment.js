/**
 * Stage 200.69 — Crypto settlement SSOT after on-chain verify (or same-booking heal).
 * Does not change ledger RPC contracts — uses PaymentsV3Service + PaymentIntentService + EscrowService.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { PaymentsV3Service } from '@/lib/services/payments-v3.service'
import PaymentIntentService from '@/lib/services/payment-intent.service'
import { applyInvoicePostPaymentEffects } from '@/lib/services/invoice-extension.service'
import EscrowService from '@/lib/services/escrow.service'
import { isPaymentAcquiringWebhookIdempotentBookingStatus } from '@/lib/booking/status-sets.js'
import {
  assertCryptoTxidAvailable,
  cryptoPaymentIdempotencyKey,
  normalizeCryptoTxid,
} from '@/lib/payment/crypto-txid-replay-guard.js'

/**
 * @param {object} booking
 * @returns {{ success: true, idempotent: true, alreadyProcessed: true, bookingId: string, bookingStatus: string, alreadyEscrowed?: boolean }}
 */
export function buildCryptoIdempotentSettledResult(booking) {
  const bookingId = String(booking.id)
  const status = String(booking.status || '').toUpperCase()
  return {
    success: true,
    idempotent: true,
    alreadyProcessed: true,
    bookingId,
    bookingStatus: status,
    ...(status === 'PAID_ESCROW' ? { alreadyEscrowed: true } : {}),
  }
}

/**
 * Classify txid replay before capture.
 * @returns {Promise<
 *   | { kind: 'available' }
 *   | { kind: 'idempotent_same_booking', code: string, existingBookingId: string }
 *   | { kind: 'foreign_booking', code: string, existingBookingId?: string, status: number, error: string }
 *   | { kind: 'error', code: string, status: number, error: string }
 * >}
 */
export async function classifyCryptoTxidReplay(supabase, { txid, bookingId }) {
  const replay = await assertCryptoTxidAvailable(supabase, { txid, bookingId })
  if (replay.ok) return { kind: 'available' }
  if (replay.code === 'ALREADY_PROCESSED') {
    return {
      kind: 'idempotent_same_booking',
      code: replay.code,
      existingBookingId: String(replay.existingBookingId || bookingId),
    }
  }
  if (replay.code === 'TXID_ALREADY_USED') {
    return {
      kind: 'foreign_booking',
      code: replay.code,
      existingBookingId: replay.existingBookingId,
      status: replay.status || 409,
      error: replay.error || 'already_processed',
    }
  }
  return {
    kind: 'error',
    code: replay.code || 'TX_LOOKUP_FAILED',
    status: replay.status || 500,
    error: replay.error || 'txid_check_failed',
  }
}

/**
 * Settle crypto after successful chain verify (or heal when txid already on this booking).
 *
 * @param {{
 *   bookingId: string,
 *   booking?: object | null,
 *   txid: string,
 *   tronData?: object | null,
 *   source: string,
 *   invoiceId?: string | null,
 * }} opts
 * @returns {Promise<{
 *   success: boolean,
 *   idempotent?: boolean,
 *   alreadyProcessed?: boolean,
 *   alreadyConfirmed?: boolean,
 *   escrowHealed?: boolean,
 *   paymentId?: string,
 *   intentId?: string,
 *   bookingId?: string,
 *   bookingStatus?: string,
 *   alreadyEscrowed?: boolean,
 *   error?: string,
 *   code?: string,
 *   httpStatus?: number,
 * }>}
 */
export async function settleCryptoPayment({
  bookingId,
  booking: bookingIn = null,
  txid: rawTxid,
  tronData = null,
  source,
  invoiceId = null,
}) {
  const bookingIdStr = String(bookingId || '').trim()
  const txid = normalizeCryptoTxid(rawTxid)
  if (!bookingIdStr || !txid) {
    return { success: false, error: 'Missing txid or bookingId', code: 'MISSING_TX', httpStatus: 400 }
  }

  let booking = bookingIn
  if (!booking?.id) {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingIdStr)
      .maybeSingle()
    if (error || !data) {
      return { success: false, error: 'Booking not found', code: 'NOT_FOUND', httpStatus: 404 }
    }
    booking = data
  }

  if (isPaymentAcquiringWebhookIdempotentBookingStatus(booking.status)) {
    return buildCryptoIdempotentSettledResult(booking)
  }

  const idempotencyKey = cryptoPaymentIdempotencyKey(txid, bookingIdStr)
  const gatewayRef = tronData?.blockNumber != null ? String(tronData.blockNumber) : null
  const verificationPayload = {
    source,
    txid,
    idempotencyKey,
    tron: tronData || undefined,
  }

  const { data: latestPayment } = await supabaseAdmin
    .from('payments')
    .select('id, status')
    .eq('booking_id', bookingIdStr)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestPayment?.status === 'CONFIRMED' && latestPayment?.id) {
    const confirm = await PaymentsV3Service.confirmPayment(latestPayment.id, verificationPayload)
    if (!confirm?.success) {
      return {
        success: false,
        verified: true,
        alreadyConfirmed: true,
        error: confirm?.error || 'Escrow transition failed',
        code: confirm?.code || 'CONFIRMED_WITHOUT_ESCROW',
        bookingId: bookingIdStr,
        httpStatus: 500,
      }
    }
    return {
      success: true,
      alreadyConfirmed: true,
      escrowHealed: Boolean(confirm.escrowHealed),
      paymentId: latestPayment.id,
      bookingId: bookingIdStr,
    }
  }

  if (latestPayment?.id && String(latestPayment.status || '').toUpperCase() === 'PENDING') {
    const confirm = await PaymentsV3Service.confirmPayment(latestPayment.id, verificationPayload)
    if (!confirm?.success) {
      const isReplay =
        confirm?.code === 'ALREADY_PROCESSED' || String(confirm?.error || '') === 'already_processed'
      if (isReplay) {
        const { data: refreshed } = await supabaseAdmin
          .from('bookings')
          .select('id, status')
          .eq('id', bookingIdStr)
          .maybeSingle()
        if (refreshed && isPaymentAcquiringWebhookIdempotentBookingStatus(refreshed.status)) {
          return buildCryptoIdempotentSettledResult(refreshed)
        }
        return {
          success: true,
          idempotent: true,
          alreadyProcessed: true,
          bookingId: bookingIdStr,
          paymentId: latestPayment.id,
        }
      }
      return {
        success: false,
        error: confirm?.error || 'confirmPayment failed',
        code: confirm?.code,
        httpStatus: 500,
      }
    }
    return {
      success: true,
      paymentId: latestPayment.id,
      bookingId: bookingIdStr,
    }
  }

  const intentRes = await PaymentIntentService.findActiveByBookingOrInvoice({
    bookingId: bookingIdStr,
    ...(invoiceId ? { invoiceId: String(invoiceId) } : {}),
  })
  if (!intentRes.success || !intentRes.intent) {
    return {
      success: false,
      error: 'No pending payment row or active payment intent for this booking',
      code: 'NO_PAYMENT_TARGET',
      httpStatus: 409,
    }
  }

  const intent = intentRes.intent
  const marked = await PaymentIntentService.markPaid(intent.id, {
    source,
    txId: txid,
    gatewayRef,
    raw: tronData,
    idempotencyKey,
  })
  if (!marked.success) {
    const isReplay =
      String(marked.error || '').includes('payments_tx_id_unique') ||
      String(marked.code || '') === 'ALREADY_PROCESSED'
    if (isReplay) {
      const { data: refreshed } = await supabaseAdmin
        .from('bookings')
        .select('id, status')
        .eq('id', bookingIdStr)
        .maybeSingle()
      if (refreshed && isPaymentAcquiringWebhookIdempotentBookingStatus(refreshed.status)) {
        return buildCryptoIdempotentSettledResult(refreshed)
      }
      return {
        success: true,
        idempotent: true,
        alreadyProcessed: true,
        bookingId: bookingIdStr,
        intentId: intent.id,
      }
    }
    return {
      success: false,
      error: marked.error || 'intent_mark_failed',
      code: marked.code,
      httpStatus: 500,
    }
  }

  const captureGuestTotalThb = Number(intent.amountThb)
  const escrow = await EscrowService.moveToEscrow(bookingIdStr, {
    txId: txid,
    gatewayRef,
    source: `${source}_intent`,
    captureGuestTotalThb:
      Number.isFinite(captureGuestTotalThb) && captureGuestTotalThb > 0 ? captureGuestTotalThb : undefined,
  })
  if (!escrow?.success) {
    return {
      success: false,
      error: escrow?.error || 'escrow_failed',
      code: 'ESCROW_FAILED',
      intentId: intent.id,
      httpStatus: 502,
    }
  }

  await applyInvoicePostPaymentEffects({
    bookingId: bookingIdStr,
    invoiceId: intent.invoiceId || invoiceId || null,
    txId: txid,
    gatewayRef,
    source: `${source}_intent`,
  })

  return {
    success: true,
    intentId: intent.id,
    bookingId: bookingIdStr,
  }
}
