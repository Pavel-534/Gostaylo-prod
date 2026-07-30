/**
 * POST /api/v2/bookings/[id]/apply-promo
 * Stage 197.1 — Persist promo reprice on payable booking (checkout Apply).
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { isBookingPayable } from '@/lib/booking/booking-status-rules'
import { applyCheckoutPromoToBooking } from '@/lib/services/booking/apply-checkout-promo.service.js'
import { promoErrorJson, PromoErrorCode } from '@/lib/promo/promo-error-codes'

export const dynamic = 'force-dynamic'

export async function POST(request, { params }) {
  const bookingId = params?.id
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'Booking ID required' }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const promoCode = String(body?.promoCode ?? body?.code ?? body?.promo_code ?? '').trim()
    if (!promoCode) {
      return promoErrorJson(PromoErrorCode.PROMO_CODE_REQUIRED, 400)
    }

    const { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle()
    if (bErr || !booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    const sessionUserId = await getUserIdFromSession()
    if (!sessionUserId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    if (booking.renter_id && String(booking.renter_id) !== String(sessionUserId)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }
    if (!isBookingPayable(booking.status)) {
      return NextResponse.json(
        { success: false, error: 'Booking cannot be repriced', code: 'BOOKING_NOT_PAYABLE' },
        { status: 400 },
      )
    }

    const applied = await applyCheckoutPromoToBooking({ booking, promoCode })
    if (!applied.ok) {
      if (applied.error_code) {
        return promoErrorJson(applied.error_code, applied.status || 400, {
          min_amount_thb: applied.min_amount_thb,
        })
      }
      return NextResponse.json(
        {
          success: false,
          error: applied.error || 'PROMO_APPLY_FAILED',
          code: applied.code || 'PROMO_APPLY_FAILED',
        },
        { status: applied.status || 400 },
      )
    }

    const b = applied.booking
    return NextResponse.json({
      success: true,
      valid: true,
      data: {
        code: applied.promo.code,
        discountAmount: applied.promo.discountAmount,
        flashSale: applied.promo.flashSale,
        promoEndsAt: applied.promo.promoEndsAt,
        secondsRemaining: applied.promo.secondsRemaining,
        guestPayableRoundedThb: applied.guestPayableRoundedThb,
        unchanged: Boolean(applied.unchanged),
        booking: {
          id: b.id,
          price_thb: b.price_thb,
          commission_thb: b.commission_thb,
          rounding_diff_pot: b.rounding_diff_pot,
          partner_earnings_thb: b.partner_earnings_thb,
          promo_code_used: b.promo_code_used,
          discount_amount: b.discount_amount,
          pricing_snapshot: b.pricing_snapshot,
          status: b.status,
        },
      },
    })
  } catch (e) {
    console.error('[apply-promo]', e)
    return promoErrorJson(PromoErrorCode.PROMO_INTERNAL, 500)
  }
}
