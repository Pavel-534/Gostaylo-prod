import { supabaseAdmin } from '@/lib/supabase'
import { NotificationService, NotificationEvents } from '../notification.service.js'
import { syncBookingStatusToConversationChat } from '@/lib/booking-status-chat-sync'
import { PayoutRailsService } from '@/lib/services/payout-rails.service'
import {
  computePayoutFeeThb,
  buildPayoutFxMetadata,
  resolvePayoutCurrency,
} from '@/lib/partner/partner-payout-fx.js'
import { getBookingCommissionRate, getSettlementPolicy } from './commission.js'
import { extractSettlementSnapshot, mapWithConcurrency } from './utils.js'
import { getPartnerBalance } from './balance.service.js'
import { BookingStatus, PayoutStatus, PAYOUT_CRON_CONCURRENCY } from './constants.js'
import { toListingDate } from '@/lib/listing-date'
import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service'

export async function processPayout(bookingId) {
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
      return { success: false, error: 'Booking not found' }
    }

    if (booking.status !== BookingStatus.PAID_ESCROW) {
      return { success: false, error: `Invalid status: ${booking.status}` }
    }

    const commissionRate = await getBookingCommissionRate(booking)
    const settlement = extractSettlementSnapshot(booking)

    const totalAmount = parseFloat(booking.price_thb) || 0
    const commission = Number.isFinite(parseFloat(settlement?.platform_margin?.thb))
      ? parseFloat(settlement.platform_margin.thb)
      : parseFloat(booking.commission_thb) || Math.round(totalAmount * commissionRate * 100) / 100
    const netAmount = Number.isFinite(parseFloat(settlement?.partner_net?.thb))
      ? parseFloat(settlement.partner_net.thb)
      : parseFloat(booking.partner_earnings_thb) || totalAmount - commission
    const partnerId = booking.listing?.owner_id

    let payoutProfile = null
    let payoutMethod = null
    let payoutMath = { baseAmount: netAmount, feeAmount: 0, finalAmount: netAmount }
    try {
      payoutProfile = partnerId ? await PayoutRailsService.getPartnerDefaultPayoutProfile(partnerId) : null
      payoutMethod = payoutProfile?.method || null
      payoutMath = PayoutRailsService.calculatePayoutFee(netAmount, payoutMethod)
    } catch (e) {
      console.error('[PAYOUT] payout profile resolve error:', e)
    }
    if (payoutMath?.error) {
      return { success: false, error: payoutMath.error }
    }

    const { data: _payout, error: payoutError } = await supabaseAdmin
      .from('payouts')
      .insert({
        partner_id: partnerId,
        booking_id: bookingId,
        amount: payoutMath.finalAmount,
        currency: payoutMethod?.currency || 'THB',
        commission_amount: commission,
        commission_rate: commissionRate,
        payout_method_id: payoutMethod?.id || null,
        payout_profile_id: payoutProfile?.id || null,
        gross_amount: payoutMath.baseAmount,
        payout_fee_amount: payoutMath.feeAmount,
        final_amount: payoutMath.finalAmount,
        status: PayoutStatus.COMPLETED,
        processed_at: new Date().toISOString(),
        metadata: {
          total_booking_amount: totalAmount,
          listing_title: booking.listing?.title,
          commission_rate_percent: commissionRate * 100,
          payout_method_name: payoutMethod?.name || null,
          payout_fee_type: payoutMath.feeType || null,
          payout_fee_value: payoutMath.feeValue ?? null,
        },
      })
      .select()
      .single()

    if (payoutError) {
      console.warn('[PAYOUT] Could not create payout record:', payoutError)
    }

    const { data: completedBooking, error: completeError } = await supabaseAdmin
      .from('bookings')
      .update({
        status: BookingStatus.COMPLETED,
        completed_at: new Date().toISOString(),
        payout_at: new Date().toISOString(),
        metadata: {
          ...(booking.metadata || {}),
          payout_processed: new Date().toISOString(),
          payout_amount: netAmount,
          payout_commission_rate: commissionRate * 100,
        },
      })
      .eq('id', bookingId)
      .select()
      .single()

    if (completeError) {
      console.error('[PAYOUT] Booking update failed:', completeError)
      return { success: false, error: completeError.message }
    }

    try {
      await syncBookingStatusToConversationChat({
        bookingId,
        previousStatus: booking.status,
        newStatus: BookingStatus.COMPLETED,
      })
    } catch (e) {
      console.error('[PAYOUT] chat sync', e)
    }

    try {
      const referralResult = await ReferralPnlService.distribute(bookingId, {
        trigger: 'payout_completed',
      })
      if (referralResult?.success !== true && referralResult?.error) {
        console.warn('[PAYOUT] referral distribute failed:', referralResult.error)
      }
    } catch (e) {
      console.error('[PAYOUT] referral distribute', e)
    }
    try {
      const hostActivationResult = await ReferralPnlService.distributeHostPartnerActivation(bookingId)
      if (hostActivationResult?.success !== true && hostActivationResult?.error) {
        console.warn('[PAYOUT] host activation distribute failed:', hostActivationResult.error)
      }
    } catch (e) {
      console.error('[PAYOUT] host activation distribute', e)
    }

    await NotificationService.dispatch(NotificationEvents.PAYOUT_PROCESSED, {
      payout: {
        amount: payoutMath.finalAmount,
        grossAmount: payoutMath.baseAmount,
        payoutFeeAmount: payoutMath.feeAmount,
        commission,
        total: totalAmount,
        commissionRate: commissionRate * 100,
      },
      booking: completedBooking,
      listing: booking.listing,
      partner: booking.listing?.owner,
    })

    console.log(
      `[PAYOUT] Booking ${bookingId} completed. Commission: ${(commissionRate * 100).toFixed(1)}%, Payout: ฿${payoutMath.finalAmount}`,
    )

    return {
      success: true,
      payout: {
        amount: payoutMath.finalAmount,
        grossAmount: payoutMath.baseAmount,
        payoutFeeAmount: payoutMath.feeAmount,
        commission,
        total: totalAmount,
        commissionRate: commissionRate * 100,
        processedAt: new Date().toISOString(),
      },
    }
  } catch (error) {
    console.error('[PAYOUT] Error:', error)
    return { success: false, error: error.message }
  }
}

export async function getPayoutReadyBookings() {
  try {
    const policy = await getSettlementPolicy()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - policy.delayDays)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const { data: rawRows, error } = await supabaseAdmin
      .from('bookings')
      .select(
        `
        id,
        check_in,
        price_thb,
        commission_thb,
        partner_earnings_thb,
        applied_commission_rate,
        listing:listings(
          id,
          title,
          owner_id,
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
      .eq('status', BookingStatus.PAID_ESCROW)

    if (error) {
      console.error('[PAYOUT] Query error:', error)
      return { success: false, bookings: [] }
    }

    const data = (rawRows || []).filter((b) => {
      const cin = toListingDate(b.check_in)
      return cin && cin <= yesterdayStr
    })

    console.log(
      `[PAYOUT] Found ${data?.length || 0} bookings ready for payout (check-in ≤ ${yesterdayStr}, delayDays=${policy.delayDays}, payoutHourLocal=${policy.payoutHourLocal})`,
    )
    return { success: true, bookings: data || [] }
  } catch (error) {
    console.error('[PAYOUT] Error:', error)
    return { success: false, bookings: [] }
  }
}

export async function processAllPayoutsForToday() {
  try {
    const { bookings } = await getPayoutReadyBookings()

    if (!bookings || bookings.length === 0) {
      console.log('[PAYOUT CRON] No bookings ready for payout (24h rule)')
      return { success: true, processed: 0, results: [] }
    }

    const results = await mapWithConcurrency(bookings, PAYOUT_CRON_CONCURRENCY, async (booking) => {
      const result = await processPayout(booking.id)
      return {
        bookingId: booking.id,
        listingTitle: booking.listing?.title,
        amount: booking.partner_earnings_thb,
        ...result,
      }
    })

    const successCount = results.filter((r) => r.success).length
    console.log(`[PAYOUT CRON] Processed ${successCount}/${bookings.length} payouts`)

    if (successCount > 0) {
      await NotificationService.dispatch(NotificationEvents.PAYOUT_BATCH_COMPLETED, {
        count: successCount,
        total: bookings.length,
        results,
      })
    }

    return {
      success: true,
      processed: successCount,
      total: bookings.length,
      results,
    }
  } catch (error) {
    console.error('[PAYOUT CRON] Error:', error)
    return { success: false, error: error.message }
  }
}

export async function requestPayout(partnerId, amount, details) {
  try {
    const { balance } = await getPartnerBalance(partnerId)
    const availableThb = balance?.availableBalanceThb ?? balance?.availableBalance ?? 0

    const requestThb = Math.max(0, Number(amount) || 0)
    if (requestThb <= 0) {
      return { success: false, error: 'Invalid payout amount' }
    }
    if (requestThb > availableThb) {
      return {
        success: false,
        error: `Insufficient balance. Available: ฿${availableThb}`,
        code: 'INSUFFICIENT_BALANCE',
      }
    }

    let payoutProfile = null
    if (details?.payoutProfileId) {
      const profiles = await PayoutRailsService.listPartnerPayoutProfiles(partnerId)
      payoutProfile = profiles.find((p) => p.id === details.payoutProfileId) || null
    } else {
      payoutProfile = await PayoutRailsService.getPartnerDefaultPayoutProfile(partnerId)
    }
    if (!payoutProfile?.id) {
      return { success: false, error: 'Payout profile required', code: 'NO_PAYOUT_PROFILE' }
    }
    if (!payoutProfile.is_verified) {
      return { success: false, error: 'Payout profile not verified', code: 'PROFILE_NOT_VERIFIED' }
    }

    const payoutMethod = payoutProfile?.method || null
    const payoutMath = await computePayoutFeeThb(requestThb, payoutMethod)
    if (payoutMath?.error) {
      return { success: false, error: payoutMath.error }
    }

    const payoutCurrency =
      payoutMath.payoutCurrency || resolvePayoutCurrency(payoutMethod?.id, payoutMethod)
    const amountInPayoutCurrency = payoutMath.amountInPayoutCurrency ?? payoutMath.fx?.amountInPayoutCurrency
    const fxMeta = payoutMath.fx ? buildPayoutFxMetadata(payoutMath.fx) : {}

    const { data: payout, error } = await supabaseAdmin
      .from('payouts')
      .insert({
        partner_id: partnerId,
        amount: payoutMath.finalAmountThb,
        gross_amount: payoutMath.baseAmountThb,
        payout_fee_amount: payoutMath.feeAmount,
        final_amount: payoutMath.finalAmountThb,
        payout_method_id: payoutMethod?.id || null,
        payout_profile_id: payoutProfile?.id || null,
        currency: payoutCurrency,
        payout_currency: payoutCurrency,
        amount_in_payout_currency: amountInPayoutCurrency,
        status: PayoutStatus.PENDING,
        wallet_address: details.walletAddress || payoutProfile?.data?.address || null,
        bank_account: details.bankAccount || payoutProfile?.data?.accountNumber || null,
        metadata: {
          requested_at: new Date().toISOString(),
          payout_type: 'partner_request',
          payout_method_name: payoutMethod?.name || null,
          payout_fee_type: payoutMath.feeType || null,
          payout_fee_value: payoutMath.feeValue ?? null,
          reserved_thb: payoutMath.baseAmountThb,
          ...fxMeta,
        },
      })
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      payout,
      payoutMath: {
        ...payoutMath,
        finalAmount: payoutMath.finalAmountThb,
        baseAmount: payoutMath.baseAmountThb,
        amountInPayoutCurrency,
        payoutCurrency,
      },
    }
  } catch (error) {
    console.error('[PAYOUT REQUEST] Error:', error)
    return { success: false, error: error.message }
  }
}
