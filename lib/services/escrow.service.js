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
import {
  computeBookingPaymentLedgerLegs,
  scaleLedgerLegsToGuestTotal,
} from '@/lib/services/ledger.service'
import { resolveListingCategoryContext } from '@/lib/services/booking.service'
import { computeEscrowThawAt } from '@/lib/escrow-thaw-rules.js'

function round2Escrow(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

/** v2 ledger: booking.commission_thb = guest service fee (SSOT fee_split_v2), not platformFeeThb (legacy 0). */
function resolveEscrowCommissionThb(booking, scaled) {
  if (scaled?.ledgerV2) {
    const snap =
      booking?.pricing_snapshot && typeof booking.pricing_snapshot === 'object'
        ? booking.pricing_snapshot
        : {}
    const fs = snap.fee_split_v2 && typeof snap.fee_split_v2 === 'object' ? snap.fee_split_v2 : {}
    const guestSvc = round2Escrow(fs.guest_service_fee_thb ?? booking?.commission_thb ?? 0)
    if (guestSvc > 0) return guestSvc
    return round2Escrow(
      (scaled.ruFeeThb ?? 0) +
        (scaled.krFeeThb ?? 0) +
        (scaled.fxMarkupThb ?? 0) +
        (scaled.platformHostFeeThb ?? 0) +
        (scaled.insuranceThb ?? 0) +
        (scaled.roundingThb ?? 0),
    )
  }
  return round2Escrow(
    (scaled.platformFeeThb ?? 0) + (scaled.insuranceThb ?? 0) + (scaled.roundingThb ?? 0),
  )
}

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
import {
  ensureEscrowDownstreamEffects,
  buildAlreadyEscrowedResult,
} from './escrow/move-to-escrow-side-effects.js'

export { BookingStatus, PayoutStatus }

const ESCROW_BOOKING_SELECT = `
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
        `

export class EscrowService {
  static getSettlementPolicy = getSettlementPolicy
  static getCurrentCommissionRate = getCurrentCommissionRate
  static snapshotCommissionRate = snapshotCommissionRate
  static getBookingCommissionRate = getBookingCommissionRate

  /**
   * Move booking to PAID_ESCROW after payment confirmed.
   * Ledger capture is inside RPC `move_to_escrow_and_post_ledger_v1` (same transaction as status update).
   *
   * Stage 125.0: RPC `already_escrowed` → killswitch (no duplicate side-effects) + reconcile
   * missing downstream markers after Node crash or parallel webhook on another instance.
   */
  static async moveToEscrow(bookingId, paymentData = {}) {
    try {
      const { data: booking, error: fetchError } = await supabaseAdmin
        .from('bookings')
        .select(ESCROW_BOOKING_SELECT)
        .eq('id', bookingId)
        .single()

      if (fetchError || !booking) {
        console.error('[ESCROW] Booking not found:', fetchError)
        return { success: false, error: 'Booking not found' }
      }

      const wasPaidEscrowBeforeRpc = booking.status === BookingStatus.PAID_ESCROW

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
        commission = resolveEscrowCommissionThb(booking, scaled)
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

      const { slug: categorySlug, wizardProfile } = await resolveListingCategoryContext(
        booking.listing?.category_id,
      )
      const escrowThawAt = computeEscrowThawAt({
        checkInRaw: booking.check_in,
        categorySlug,
        wizardProfile,
        escrowAtIso: new Date().toISOString(),
      })
      const verificationPayload = {
        ...paymentVerification,
        txId: paymentData?.txId || null,
        gatewayRef: paymentData?.gatewayRef || null,
        source: paymentData?.source || 'payment_confirm',
      }

      const paymentPayload = {
        amount: guestCaptureAmountThb,
        commission,
        netAmount,
        commissionRate: commissionRate * 100,
      }

      let rpc = null
      if (!wasPaidEscrowBeforeRpc) {
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
        rpc = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows
        if (!rpc?.success) {
          return { success: false, error: rpc?.error_code || 'atomic_escrow_failed' }
        }
      }

      const rpcAlreadyEscrowed = rpc?.already_escrowed === true
      const isIdempotentPath = wasPaidEscrowBeforeRpc || rpcAlreadyEscrowed

      const { data: updatedBooking, error: updatedErr } = await supabaseAdmin
        .from('bookings')
        .select(ESCROW_BOOKING_SELECT)
        .eq('id', bookingId)
        .single()
      if (updatedErr || !updatedBooking) {
        console.error('[ESCROW] Read updated booking failed:', updatedErr)
        return { success: false, error: updatedErr?.message || 'updated_booking_not_found' }
      }

      if (isIdempotentPath) {
        console.log(
          `[ESCROW] Booking ${bookingId} idempotent escrow (pre_rpc=${wasPaidEscrowBeforeRpc}, rpc_already=${rpcAlreadyEscrowed})`,
        )
        const { ran } = await ensureEscrowDownstreamEffects({
          bookingId,
          booking: updatedBooking,
          listing: updatedBooking.listing || booking.listing,
          payment: paymentPayload,
          previousStatusForTransition,
          reconcileOnly: true,
        })
        if (ran.length) {
          console.log(`[ESCROW] Reconciled side-effects for ${bookingId}:`, ran.join(', '))
        }
        return {
          ...(await buildAlreadyEscrowedResult(updatedBooking, {
            guestCaptureAmountThb,
            commission,
            netAmount,
            commissionRate: commissionRate * 100,
            journalId: rpc?.journal_id || null,
          })),
          reconciledEffects: ran,
        }
      }

      await ensureEscrowDownstreamEffects({
        bookingId,
        booking: updatedBooking,
        listing: updatedBooking.listing || booking.listing,
        payment: paymentPayload,
        previousStatusForTransition,
        reconcileOnly: false,
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
        const { slug, wizardProfile } = await resolveListingCategoryContext(b.listing?.category_id)
        const escrowAt = (b.metadata && b.metadata.escrow_started) || new Date().toISOString()
        thawIso = computeEscrowThawAt({
          checkInRaw: b.check_in,
          categorySlug: slug,
          wizardProfile,
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
