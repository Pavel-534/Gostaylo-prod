/**
 * Stage 125.0 — downstream side-effects for moveToEscrow (first capture + reconcile).
 * Markers live in bookings.metadata (no new tables).
 */
import { supabaseAdmin } from '@/lib/supabase'
import { NotificationService, NotificationEvents } from '../notification.service.js'
import { transitionBookingStatus } from '@/lib/services/booking/booking-status.service.js'
import { recordPromoUsageAfterEscrowPaid } from '@/lib/promo/record-promo-usage-on-payment.js'
import { FISCAL_STATUS } from '@/lib/services/fiscal-kassa.service.js'
import { BookingStatus } from './constants.js'
import { getBookingCommissionRate } from './commission.js'

/** Terminal — no provider calls on reconcile or repeat capture. */
const FISCAL_TERMINAL_STATUSES = new Set([
  FISCAL_STATUS.ISSUED,
  FISCAL_STATUS.SANDBOX_MOCK,
  FISCAL_STATUS.SKIPPED,
])

/** @param {object} booking */
export function isFiscalEscrowEffectSettled(booking) {
  const snap = booking?.pricing_snapshot
  if (!snap || snap.v !== 2) return true
  const st = booking?.metadata?.fiscal?.status
  if (!st) return false
  return FISCAL_TERMINAL_STATUSES.has(st)
}

/**
 * Stage 125.6 — idempotent fiscal on escrow reconcile (parallel webhook / moveToEscrow retry).
 * PENDING_FISCAL + attempts>0 → provider already tried; admin/cron retry only (`retryPendingFiscalReceipt`).
 *
 * @param {object} booking
 */
export function needsFiscalEscrowReconcile(booking) {
  if (isFiscalEscrowEffectSettled(booking)) return false
  const fiscal = booking?.metadata?.fiscal
  if (!fiscal || typeof fiscal !== 'object') return true
  const attempts = Number(fiscal.attempts) || 0
  if (String(fiscal.status || '') === FISCAL_STATUS.PENDING && attempts > 0) {
    return false
  }
  return true
}

/** @param {Record<string, unknown> | null | undefined} meta */
export function wasPaymentReceivedNotified(meta) {
  const effects =
    meta && typeof meta === 'object' && !Array.isArray(meta) && meta.escrow_side_effects
      ? meta.escrow_side_effects
      : null
  return Boolean(
    effects &&
      typeof effects === 'object' &&
      !Array.isArray(effects) &&
      effects.payment_received_at,
  )
}

/** @param {object} booking */
export function needsPromoUsageReconcile(booking) {
  const code = booking?.promo_code_used
  if (!code || typeof code !== 'string') return false
  const meta =
    booking.metadata && typeof booking.metadata === 'object' && !Array.isArray(booking.metadata)
      ? booking.metadata
      : {}
  return !meta.promo_usage_counted_at
}

/**
 * Stage 125.6 — merge marker into live row metadata (fiscal/promo may have been written earlier in capture).
 *
 * @param {string} bookingId
 * @param {Record<string, unknown>} [priorMeta] fallback when row read fails
 */
export async function markPaymentReceivedNotified(bookingId, priorMeta = {}) {
  if (!supabaseAdmin || !bookingId) return
  const { data: row } = await supabaseAdmin
    .from('bookings')
    .select('metadata')
    .eq('id', bookingId)
    .maybeSingle()
  const liveMeta =
    row?.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata
      : null
  const meta =
    liveMeta ||
    (priorMeta && typeof priorMeta === 'object' && !Array.isArray(priorMeta) ? priorMeta : {})
  const effects = {
    ...(meta.escrow_side_effects && typeof meta.escrow_side_effects === 'object'
      ? meta.escrow_side_effects
      : {}),
    payment_received_at: new Date().toISOString(),
  }
  await supabaseAdmin
    .from('bookings')
    .update({
      metadata: { ...meta, escrow_side_effects: effects },
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
}

/**
 * First capture (full) or idempotent reconcile (only missing effects).
 *
 * @param {{
 *   bookingId: string,
 *   booking: object,
 *   listing: object | null | undefined,
 *   payment: { amount: number, commission: number, netAmount: number, commissionRate: number },
 *   previousStatusForTransition?: string,
 *   reconcileOnly?: boolean,
 * }} ctx
 * @returns {Promise<{ ran: string[] }>}
 */
export async function ensureEscrowDownstreamEffects(ctx) {
  const {
    bookingId,
    booking,
    listing,
    payment,
    previousStatusForTransition = '',
    reconcileOnly = false,
  } = ctx
  const ran = []
  const meta =
    booking.metadata && typeof booking.metadata === 'object' && !Array.isArray(booking.metadata)
      ? booking.metadata
      : {}

  if (!reconcileOnly || !booking.terms_version) {
    try {
      const { stampBookingTermsOnSuccessfulPayment } = await import('@/lib/legal-consent.js')
      const termsStamp = await stampBookingTermsOnSuccessfulPayment(bookingId)
      if (!termsStamp.ok && !termsStamp.skippedColumns) {
        console.warn('[ESCROW] booking terms_version stamp', bookingId, termsStamp.error)
      } else if (!booking.terms_version) {
        ran.push('terms_stamp')
      }
    } catch (e) {
      console.error('[ESCROW] booking terms stamp', e)
    }
  }

  if (!reconcileOnly || needsPromoUsageReconcile(booking)) {
    try {
      const promoRes = await recordPromoUsageAfterEscrowPaid(bookingId)
      if (promoRes.ok && !promoRes.skipped) ran.push('promo_usage')
    } catch (e) {
      console.error('[ESCROW] promo usage increment', e)
    }
  }

  const shouldRunFiscal = reconcileOnly
    ? needsFiscalEscrowReconcile(booking)
    : !isFiscalEscrowEffectSettled(booking)

  if (shouldRunFiscal) {
    try {
      const { issueFiscalReceiptForBooking } = await import('@/lib/services/fiscal-kassa.service.js')
      const fiscalResult = await issueFiscalReceiptForBooking(booking, { reconcileOnly })
      if (fiscalResult?.pending && !fiscalResult?.skipped) {
        console.warn('[ESCROW] fiscal receipt pending', bookingId, fiscalResult.error)
      }
      if (!fiscalResult?.skipped) ran.push('fiscal')
    } catch (e) {
      console.error('[ESCROW] fiscal kassa', e)
    }
  }

  if (!reconcileOnly) {
    try {
      const statusRes = await transitionBookingStatus(bookingId, BookingStatus.PAID_ESCROW, {
        scope: 'system',
        skipDbUpdate: true,
        forceDownstream: true,
        skipReferralLifecycle: true,
        viaEscrowRpc: true,
        previousStatusOverride: previousStatusForTransition,
        actorContext: { actorRole: 'SYSTEM', trigger: 'payment_confirmed' },
      })
      if (!statusRes.success) {
        console.warn('[ESCROW] transitionBookingStatus downstream failed', statusRes.error)
      } else {
        ran.push('status_downstream')
      }
    } catch (e) {
      console.error('[ESCROW] transitionBookingStatus downstream', e)
    }
  }

  if (!reconcileOnly || !wasPaymentReceivedNotified(meta)) {
    try {
      await NotificationService.dispatch(NotificationEvents.PAYMENT_RECEIVED, {
        booking,
        listing,
        partner: listing?.owner,
        payment,
      })
      await markPaymentReceivedNotified(bookingId, meta)
      ran.push('payment_received')
    } catch (e) {
      console.error('[ESCROW] PAYMENT_RECEIVED dispatch', e)
    }
  }

  return { ran }
}

/**
 * @param {object} booking
 * @param {{ guestCaptureAmountThb?: number, commission?: number, netAmount?: number, commissionRate?: number, journalId?: string | null }} [opts]
 */
export async function buildAlreadyEscrowedResult(booking, opts = {}) {
  const commissionRate =
    typeof opts.commissionRate === 'number'
      ? opts.commissionRate
      : (await getBookingCommissionRate(booking)) * 100
  const totalAmount = parseFloat(booking.price_thb) || 0
  const guestTotal =
    Number.isFinite(opts.guestCaptureAmountThb) && opts.guestCaptureAmountThb > 0
      ? opts.guestCaptureAmountThb
      : totalAmount
  const commission =
    Number.isFinite(opts.commission) ? opts.commission : parseFloat(booking.commission_thb) || 0
  const netAmount =
    Number.isFinite(opts.netAmount)
      ? opts.netAmount
      : Number.isFinite(parseFloat(booking.partner_earnings_thb))
        ? parseFloat(booking.partner_earnings_thb)
        : totalAmount - commission

  return {
    success: true,
    booking,
    alreadyEscrowed: true,
    idempotent: true,
    escrow: {
      totalAmount: guestTotal,
      commission,
      netAmount,
      commissionRate,
      escrowedAt: booking?.metadata?.escrow_started || booking.updated_at,
    },
    journalId: opts.journalId ?? null,
  }
}
