/**
 * GoStayLo - Escrow orchestrator (facade)
 *
 * Money flow (prod):
 * 1. moveToEscrow → RPC `move_to_escrow_and_post_ledger_v1` (PAID_ESCROW + BOOKING_PAYMENT_CAPTURED atomically)
 * 2. thaw cron → THAWED → PayoutBatchService.promoteThawedToReadyForPayout → READY_FOR_PAYOUT
 * 3. Treasury marks batch paid → PayoutBatchService.markBatchSettled → LedgerService.postPartnerBatchBookingPayoutSettled
 *    (legacy EscrowService.processPayout blocked: `legacy-payout-guard.js`)
 *
 * Ledger replay (ops only, idempotent): LedgerService.postPaymentCaptureFromBooking — not called from moveToEscrow.
 *
 * Thaw: `lib/services/escrow/thaw.service.js`
 * Legacy payout: `lib/services/escrow/payout.service.js`
 * Ledger SSOT: `lib/services/ledger.service.js` + `lib/services/ledger/*`
 */

import { supabaseAdmin } from '@/lib/supabase'
import { NotificationService, NotificationEvents } from './notification.service.js'
import { transitionBookingStatus } from '@/lib/services/booking/booking-status.service.js'
import {
  computeBookingPaymentLedgerLegs,
  scaleLedgerLegsToGuestTotal,
} from '@/lib/services/ledger.service'
import { resolveListingCategorySlug } from '@/lib/services/booking.service'
import { computeEscrowThawAt } from '@/lib/escrow-thaw-rules.js'

import { BookingStatus, PayoutStatus } from './escrow/constants.js'
import { extractSettlementSnapshot } from './escrow/utils.js'
import {
  getSettlementPolicy,
  getCurrentCommissionRate,
  snapshotCommissionRate,
  getBookingCommissionRate,
} from './escrow/commission.js'
import {
  getPartnerBalance,
  getPartnerBalanceByCategory,
  syncPartnerBalanceColumns,
} from './escrow/balance.service.js'
import {
  processPayout,
  getPayoutReadyBookings,
  processAllPayoutsForToday,
  requestPayout,
} from './escrow/payout.service.js'
import {
  thawBookingToThawed,
  getUpcomingThawBookings,
  notifyUpcomingThaw,
  backfillMissingEscrowThawAt,
} from './escrow/thaw.service.js'
import DisputeService from '@/lib/services/dispute.service'
import { recordPromoUsageAfterEscrowPaid } from '@/lib/promo/record-promo-usage-on-payment.js'

export { BookingStatus, PayoutStatus }

export class EscrowService {
  static getSettlementPolicy = getSettlementPolicy
  static getCurrentCommissionRate = getCurrentCommissionRate
  static snapshotCommissionRate = snapshotCommissionRate
  static getBookingCommissionRate = getBookingCommissionRate

  /**
   * Move booking to PAID_ESCROW after payment confirmed.
   * Ledger capture is inside RPC `move_to_escrow_and_post_ledger_v1` (same transaction as status update).
   */
  static async moveToEscrow(bookingId, paymentData = {}) {
    try {
      const { data: booking, error: fetchError } = await supabaseAdmin
        .from('bookings')
        .select(
          `
          *,
          listing:listings(
            id,
            title,
            owner_id,
            category_id,
            owner:profiles!owner_id(
              id,
              email,
              telegram_id,
              first_name,
              last_name
            )
          )
        `,
        )
        .eq('id', bookingId)
        .single()

      if (fetchError || !booking) {
        console.error('[ESCROW] Booking not found:', fetchError)
        return { success: false, error: 'Booking not found' }
      }

      if (booking.status === BookingStatus.PAID_ESCROW) {
        console.log(`[ESCROW] Booking ${bookingId} already in PAID_ESCROW (idempotent)`)
        if (!booking.terms_version) {
          try {
            const { stampBookingTermsOnSuccessfulPayment } = await import('@/lib/legal-consent.js')
            await stampBookingTermsOnSuccessfulPayment(bookingId)
          } catch (e) {
            console.warn('[ESCROW] idempotent terms_version backfill', e)
          }
        }
        const cr = await getBookingCommissionRate(booking)
        return {
          success: true,
          booking,
          alreadyEscrowed: true,
          escrow: {
            totalAmount: parseFloat(booking.price_thb) || 0,
            commission: parseFloat(booking.commission_thb) || 0,
            netAmount:
              Number.isFinite(parseFloat(booking.partner_earnings_thb))
                ? parseFloat(booking.partner_earnings_thb)
                : parseFloat(booking.price_thb || 0) - parseFloat(booking.commission_thb || 0),
            commissionRate: cr * 100,
            escrowedAt: booking?.metadata?.escrow_started || booking.updated_at,
          },
        }
      }

      const commissionRate = await getBookingCommissionRate(booking)
      const previousStatusForTransition = String(booking.status || '').toUpperCase()
      const settlement = extractSettlementSnapshot(booking)

      const totalAmount = parseFloat(booking.price_thb) || 0
      const captureGuestTotalThb = Number(paymentData.captureGuestTotalThb)

      let commission
      let netAmount
      let guestCaptureAmountThb

      if (Number.isFinite(captureGuestTotalThb) && captureGuestTotalThb > 0) {
        const legs0 = computeBookingPaymentLedgerLegs(booking)
        const scaled = scaleLedgerLegsToGuestTotal(legs0, captureGuestTotalThb)
        netAmount = scaled.partnerThb
        commission =
          Math.round((scaled.platformFeeThb + scaled.insuranceThb + scaled.roundingThb) * 100) / 100
        guestCaptureAmountThb = captureGuestTotalThb
      } else {
        commission = Number.isFinite(parseFloat(settlement?.platform_margin?.thb))
          ? parseFloat(settlement.platform_margin.thb)
          : Math.round(totalAmount * commissionRate * 100) / 100
        netAmount = Number.isFinite(parseFloat(settlement?.partner_net?.thb))
          ? parseFloat(settlement.partner_net.thb)
          : totalAmount - commission
        guestCaptureAmountThb = totalAmount
      }

      const paymentVerification = {
        ...(typeof booking.metadata?.payment_verification === 'object' && booking.metadata.payment_verification
          ? booking.metadata.payment_verification
          : {}),
        ...paymentData,
      }
      if (Number.isFinite(captureGuestTotalThb) && captureGuestTotalThb > 0) {
        paymentVerification.captureGuestTotalThb = captureGuestTotalThb
      }

      const categorySlug = await resolveListingCategorySlug(booking.listing?.category_id)
      const escrowThawAt = computeEscrowThawAt({
        checkInRaw: booking.check_in,
        categorySlug,
        escrowAtIso: new Date().toISOString(),
      })
      const verificationPayload = {
        ...paymentVerification,
        txId: paymentData?.txId || null,
        gatewayRef: paymentData?.gatewayRef || null,
        source: paymentData?.source || 'payment_confirm',
      }
      const { data: rpcRows, error: rpcError } = await supabaseAdmin.rpc(
        'move_to_escrow_and_post_ledger_v1',
        {
          p_booking_id: bookingId,
          p_tx_id: verificationPayload.txId,
          p_gateway_ref: verificationPayload.gatewayRef,
          p_source: verificationPayload.source,
          p_capture_guest_total_thb: Number(guestCaptureAmountThb || totalAmount),
          p_commission_thb: Number(commission || 0),
          p_partner_earnings_thb: Number(netAmount || 0),
          p_commission_rate_applied: Number(commissionRate || 0),
          p_listing_category_slug: categorySlug || null,
          p_escrow_thaw_at: escrowThawAt,
          p_payment_verification: verificationPayload,
        },
      )

      if (rpcError) {
        console.error('[ESCROW] Atomic RPC failed:', rpcError)
        return { success: false, error: rpcError.message || 'atomic_escrow_rpc_failed' }
      }
      const rpc = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows
      if (!rpc?.success) {
        return { success: false, error: rpc?.error_code || 'atomic_escrow_failed' }
      }

      const { data: updatedBooking, error: updatedErr } = await supabaseAdmin
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single()
      if (updatedErr || !updatedBooking) {
        console.error('[ESCROW] Read updated booking failed:', updatedErr)
        return { success: false, error: updatedErr?.message || 'updated_booking_not_found' }
      }

      try {
        const { stampBookingTermsOnSuccessfulPayment } = await import('@/lib/legal-consent.js')
        const termsStamp = await stampBookingTermsOnSuccessfulPayment(bookingId)
        if (!termsStamp.ok && !termsStamp.skippedColumns) {
          console.warn('[ESCROW] booking terms_version stamp', bookingId, termsStamp.error)
        }
      } catch (e) {
        console.error('[ESCROW] booking terms stamp', e)
      }

      try {
        await recordPromoUsageAfterEscrowPaid(bookingId)
      } catch (e) {
        console.error('[ESCROW] promo usage increment', e)
      }

      try {
        const { issueFiscalReceiptForBooking } = await import('@/lib/services/fiscal-kassa.service.js')
        const fiscalResult = await issueFiscalReceiptForBooking(updatedBooking)
        if (fiscalResult?.pending) {
          console.warn('[ESCROW] fiscal receipt pending', bookingId, fiscalResult.error)
        }
      } catch (e) {
        console.error('[ESCROW] fiscal kassa', e)
      }

      try {
        const statusRes = await transitionBookingStatus(bookingId, BookingStatus.PAID_ESCROW, {
          scope: 'system',
          skipDbUpdate: true,
          forceDownstream: true,
          skipReferralLifecycle: true,
          previousStatusOverride: previousStatusForTransition,
          actorContext: { actorRole: 'SYSTEM', trigger: 'payment_confirmed' },
        })
        if (!statusRes.success) {
          console.warn('[ESCROW] transitionBookingStatus downstream failed', statusRes.error)
        }
      } catch (e) {
        console.error('[ESCROW] transitionBookingStatus downstream', e)
      }

      await NotificationService.dispatch(NotificationEvents.PAYMENT_RECEIVED, {
        booking: updatedBooking,
        listing: booking.listing,
        partner: booking.listing?.owner,
        payment: {
          amount: guestCaptureAmountThb,
          commission,
          netAmount,
          commissionRate: commissionRate * 100,
        },
      })

      console.log(
        `[ESCROW] Booking ${bookingId} moved to escrow. Commission: ${(commissionRate * 100).toFixed(1)}%, Net: ฿${netAmount}`,
      )

      return {
        success: true,
        booking: updatedBooking,
        escrow: {
          totalAmount: guestCaptureAmountThb,
          commission,
          netAmount,
          commissionRate: commissionRate * 100,
          escrowedAt: new Date().toISOString(),
        },
        journalId: rpc?.journal_id || null,
      }
    } catch (error) {
      console.error('[ESCROW] Error:', error)
      return { success: false, error: error.message }
    }
  }

  /** @deprecated Use PayoutBatchService — blocked on prod / TREASURY_MANUAL_MODE (see legacy-payout-guard.js). */
  static processPayout = processPayout
  static getPayoutReadyBookings = getPayoutReadyBookings
  /** @deprecated Use PayoutBatchService — blocked on prod / TREASURY_MANUAL_MODE. */
  static processAllPayoutsForToday = processAllPayoutsForToday
  static notifyUpcomingThaw = notifyUpcomingThaw
  static getPartnerBalance = getPartnerBalance
  static requestPayout = requestPayout
  static syncPartnerBalanceColumns = syncPartnerBalanceColumns
  static thawBookingToThawed = thawBookingToThawed
  static backfillMissingEscrowThawAt = backfillMissingEscrowThawAt
  static getUpcomingThawBookings = getUpcomingThawBookings
  static getPartnerBalanceByCategory = getPartnerBalanceByCategory

  static async processDueEscrowThaws() {
    await backfillMissingEscrowThawAt(500)
    const nowMs = Date.now()
    const { data: rows, error } = await supabaseAdmin
      .from('bookings')
      .select('id, partner_id, check_in, escrow_thaw_at, metadata, listing:listings(category_id)')
      .eq('status', BookingStatus.PAID_ESCROW)
      .limit(800)
    if (error) {
      return { success: false, error: error.message, processed: 0 }
    }
    const frozenByDispute = await DisputeService.getFrozenBookingIdSet((rows || []).map((b) => b.id))
    const due = []
    for (const b of rows || []) {
      if (frozenByDispute.has(String(b.id))) continue
      let thawIso = b.escrow_thaw_at
      if (!thawIso) {
        const slug = await resolveListingCategorySlug(b.listing?.category_id)
        const escrowAt = (b.metadata && b.metadata.escrow_started) || new Date().toISOString()
        thawIso = computeEscrowThawAt({
          checkInRaw: b.check_in,
          categorySlug: slug,
          escrowAtIso: typeof escrowAt === 'string' ? escrowAt : new Date().toISOString(),
        })
        await supabaseAdmin.from('bookings').update({ escrow_thaw_at: thawIso }).eq('id', b.id)
      }
      if (Date.parse(thawIso) <= nowMs) {
        due.push({ id: b.id, partnerId: b.partner_id })
      }
    }
    const partners = new Set()
    for (const item of due) {
      const r = await thawBookingToThawed(item.id)
      if (r.success && item.partnerId) {
        partners.add(item.partnerId)
      }
    }
    for (const pid of partners) {
      await syncPartnerBalanceColumns(pid)
    }
    return { success: true, processed: due.length }
  }
}

export default EscrowService
