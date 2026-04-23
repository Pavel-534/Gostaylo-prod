/**
 * GoStayLo - Escrow orchestrator
 * Thaw: `lib/services/escrow/thaw.service.js` — Payout: `lib/services/escrow/payout.service.js`
 *
 * DYNAMIC COMMISSION: snapshotted at booking creation (`applied_commission_rate`).
 * Settlement: `system_settings.general` (delay days, local payout hour).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { NotificationService, NotificationEvents } from './notification.service.js'
import { syncBookingStatusToConversationChat } from '@/lib/booking-status-chat-sync'
import {
  computeBookingPaymentLedgerLegs,
  scaleLedgerLegsToGuestTotal,
} from '@/lib/services/ledger.service'
import { resolveListingCategorySlug } from '@/lib/services/booking.service'
import { computeEscrowThawAt } from '@/lib/escrow-thaw-rules.js'

import { BookingStatus, PayoutStatus } from './escrow/constants.js'
import { extractSettlementSnapshot } from './escrow/utils.js'
import { schedulePostPaymentLedgerCapture } from './escrow/ledger-capture.js'
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

export { BookingStatus, PayoutStatus }

export class EscrowService {
  static getSettlementPolicy = getSettlementPolicy
  static getCurrentCommissionRate = getCurrentCommissionRate
  static snapshotCommissionRate = snapshotCommissionRate
  static getBookingCommissionRate = getBookingCommissionRate

  /**
   * Move booking to PAID_ESCROW after payment confirmed. Ledger capture is scheduled (non-blocking).
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

      const { data: updatedBooking, error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({
          status: BookingStatus.PAID_ESCROW,
          commission_thb: commission,
          partner_earnings_thb: netAmount,
          escrow_thaw_at: escrowThawAt,
          metadata: {
            ...(booking.metadata || {}),
            escrow_started: new Date().toISOString(),
            listing_category_slug: categorySlug || null,
            payment_verification: paymentVerification,
            commission_rate_applied: commissionRate,
          },
        })
        .eq('id', bookingId)
        .select()
        .single()

      if (updateError) {
        console.error('[ESCROW] Update failed:', updateError)
        return { success: false, error: updateError.message }
      }

      schedulePostPaymentLedgerCapture(updatedBooking)

      try {
        await syncBookingStatusToConversationChat({
          bookingId,
          previousStatus: booking.status,
          newStatus: BookingStatus.PAID_ESCROW,
        })
      } catch (e) {
        console.error('[ESCROW] chat sync', e)
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
      }
    } catch (error) {
      console.error('[ESCROW] Error:', error)
      return { success: false, error: error.message }
    }
  }

  static processPayout = processPayout
  static getPayoutReadyBookings = getPayoutReadyBookings
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
    const due = []
    for (const b of rows || []) {
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
