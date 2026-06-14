/**
 * GoStayLo - Partner Booking Actions API (v2) - LIVE DATA
 * 
 * PUT /api/v2/partner/bookings/[id] - Update booking status in Supabase
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { BookingService } from '@/lib/services/booking.service'
import { attachPartnerTrustToBookings } from '@/lib/booking/attach-partner-trust-to-bookings'
import { attachDisputeToBookings } from '@/lib/booking/attach-dispute-to-bookings.js'
import { NotificationService, NotificationEvents } from '@/lib/services/notification.service'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'
import { buildBookingFinancialSnapshotFromRow } from '@/lib/services/booking-financial-read-model.service'
import { transformPartnerBookingToClient } from '@/lib/partner/partner-booking-transform'
import { transitionBookingStatus } from '@/lib/services/booking/booking-status.service.js'
import { validatePartnerBookingStatusTransition } from '@/lib/booking/status-transitions.js'
import { releaseInquirySoftHold } from '@/lib/booking/inquiry-soft-hold.js'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const PARTNER_BOOKING_DETAIL_SELECT = `
  *,
  listing:listings (
    id,
    title,
    district,
    images,
    cover_image,
    base_price_thb,
    commission_rate,
    metadata,
    category_id,
    categories ( slug )
  ),
  renter:profiles!renter_id (
    id,
    first_name,
    last_name,
    email
  )
`

export async function GET(request, { params }) {
  try {
    const { id } = await params
    const userId = await getUserIdFromSession()

    if (!userId) {
      return NextResponse.json({ status: 'error', error: 'Authentication required' }, { status: 401 })
    }

    const partner = await verifyPartnerAccess(userId)
    if (!partner) {
      return NextResponse.json({ status: 'error', error: 'Partner access denied' }, { status: 403 })
    }

    if (!isSupabaseConfigured() || !supabaseAdmin) {
      return NextResponse.json({
        status: 'success',
        data: {
          id,
          partnerId: userId,
          status: 'PENDING',
          guestName: 'Test',
          financial_snapshot: null,
        },
      })
    }

    const { data: row, error } = await supabaseAdmin
      .from('bookings')
      .select(PARTNER_BOOKING_DETAIL_SELECT)
      .eq('id', id)
      .eq('partner_id', userId)
      .maybeSingle()

    if (error || !row) {
      return NextResponse.json({ status: 'error', error: 'Booking not found' }, { status: 404 })
    }

    const dc = await resolveDefaultCommissionPercent()
    const dto = transformPartnerBookingToClient(row, dc)
    const financial_snapshot = buildBookingFinancialSnapshotFromRow(row)
    let [merged] = await attachDisputeToBookings(supabaseAdmin, [{ ...dto, financial_snapshot }])
    ;[merged] = await attachPartnerTrustToBookings([merged])

    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('booking_id', id)
      .maybeSingle()
    if (conv?.id) merged = { ...merged, conversationId: conv.id }

    return NextResponse.json({ status: 'success', data: merged })
  } catch (error) {
    return NextResponse.json({ status: 'error', error: error.message }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params
    const userId = await getUserIdFromSession()

    let body = {}
    try {
      const raw = await request.text()
      if (raw != null && String(raw).trim() !== '') {
        body = JSON.parse(raw)
      }
    } catch {
      return NextResponse.json(
        { status: 'error', error: 'Invalid or empty JSON body' },
        { status: 400 },
      )
    }

    const { status: newStatus, reason, declineReasonKey, declineReasonDetail } = body
    
    if (!userId) {
      return NextResponse.json({ status: 'error', error: 'Authentication required' }, { status: 401 })
    }
    
    const partner = await verifyPartnerAccess(userId)
    if (!partner) {
      return NextResponse.json({ status: 'error', error: 'Partner access denied' }, { status: 403 })
    }
    
    if (!newStatus) {
      return NextResponse.json({ status: 'error', error: 'Status is required' }, { status: 400 })
    }
    
    console.log(`[BOOKING UPDATE] ${id} -> ${newStatus} by ${userId}`)
    
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json({
        status: 'success',
        data: { id, partnerId: userId, status: newStatus, updatedAt: new Date().toISOString() },
        message: `Status updated to ${newStatus}`
      })
    }
    
    // 1. Fetch current booking
    const getRes = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${id}&partner_id=eq.${userId}&select=id,status,partner_id,listing_id`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    )
    const bookings = await getRes.json()
    
    if (!Array.isArray(bookings) || bookings.length === 0) {
      return NextResponse.json({ status: 'error', error: 'Booking not found or access denied' }, { status: 404 })
    }
    
    const currentBooking = bookings[0]
    
    const transition = validatePartnerBookingStatusTransition(
      currentBooking.status,
      newStatus,
    )
    if (!transition.ok) {
      return NextResponse.json({ status: 'error', error: transition.error }, { status: 400 })
    }

    if (newStatus === 'CONFIRMED') {
      const inv = await BookingService.verifyInventoryBeforePartnerConfirm(id)
      if (!inv.ok) {
        const hasInquiryHoldConflict = Array.isArray(inv.conflicts) &&
          inv.conflicts.some((c) => String(c?.source || c?.reason || '').includes('inquiry'))
        const msg =
          inv.error === 'INSUFFICIENT_CAPACITY'
            ? hasInquiryHoldConflict
              ? 'Даты заняты другой заявкой (временный hold до оплаты). Подтвердите другую заявку или дождитесь истечения hold.'
              : 'Недостаточно свободных мест на эти даты (возможно, другая заявка заняла лимит).'
            : inv.error || 'Inventory check failed'
        return NextResponse.json(
          {
            status: 'error',
            error: msg,
            conflicts: inv.conflicts || null,
          },
          { status: 409 }
        )
      }
    }
    
    const statusRes = await transitionBookingStatus(id, newStatus, {
      scope: 'partner',
      actorContext: {
        actorId: userId,
        actorRole: 'PARTNER',
        trigger: 'partner_api_put',
      },
      metadata: { reason, declineReasonKey, declineReasonDetail },
    })

    if (!statusRes.success) {
      return NextResponse.json(
        { status: 'error', error: statusRes.error || 'Failed to update booking' },
        { status: 400 },
      )
    }

    const updated = statusRes.booking
    console.log(`[BOOKING UPDATE] Success: ${id} -> ${newStatus}`)

    if (newStatus === 'CONFIRMED' || newStatus === 'CANCELLED' || newStatus === 'DECLINED') {
      await releaseInquirySoftHold(id)
    }

    if (newStatus === 'CONFIRMED') {
      try {
        await BookingService.attachSettlementSnapshotForBooking(id)
      } catch (e) {
        console.error('[BOOKING UPDATE] settlement snapshot attach', e)
      }
      try {
        const full = await BookingService.getBookingById(id)
        if (full) {
          await NotificationService.dispatch(NotificationEvents.BOOKING_CONFIRMED, {
            booking: full,
            renter: full.renter,
            listing: full.listings,
          })
        }
      } catch (e) {
        console.error('[BOOKING UPDATE] BOOKING_CONFIRMED notify', e)
      }
    }

    return NextResponse.json({
      status: 'success',
      data: updated || { id, status: newStatus },
      message: newStatus === 'CONFIRMED' ? 'Бронирование подтверждено' : 
               newStatus === 'CANCELLED' ? 'Бронирование отклонено' : 'Статус обновлён'
    })
    
  } catch (error) {
    console.error('[BOOKING UPDATE ERROR]', error)
    return NextResponse.json({ status: 'error', error: error.message }, { status: 500 })
  }
}
