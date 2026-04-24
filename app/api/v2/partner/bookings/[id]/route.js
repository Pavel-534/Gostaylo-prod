/**
 * GoStayLo - Partner Booking Actions API (v2) - LIVE DATA
 * 
 * PUT /api/v2/partner/bookings/[id] - Update booking status in Supabase
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { syncBookingStatusToConversationChat } from '@/lib/booking-status-chat-sync'
import { BookingService } from '@/lib/services/booking.service'
import { attachPartnerTrustToBookings } from '@/lib/booking/attach-partner-trust-to-bookings'
import { NotificationService, NotificationEvents } from '@/lib/services/notification.service'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const STATUS_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  INQUIRY: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED'],
  AWAITING_PAYMENT: ['CANCELLED'],
  PAID: ['COMPLETED', 'REFUNDED'],
  /** Funds in escrow until category thaw cron sets THAWED; partner completes stay from THAWED */
  PAID_ESCROW: ['REFUNDED', 'CANCELLED'],
  CHECKED_IN: ['COMPLETED', 'REFUNDED'],
  THAWED: ['COMPLETED', 'REFUNDED'],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: [],
}

export async function GET(request, { params }) {
  try {
    const { id } = await params
    const userId = await getUserIdFromSession()
    
    if (!userId) {
      return NextResponse.json({ status: 'error', error: 'Authentication required' }, { status: 401 })
    }
    
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json({
        status: 'success',
        data: { id, partnerId: userId, status: 'PENDING', guestName: 'Test' }
      })
    }
    
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${id}&partner_id=eq.${userId}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    )
    const bookings = await res.json()
    
    if (!Array.isArray(bookings) || bookings.length === 0) {
      return NextResponse.json({ status: 'error', error: 'Booking not found' }, { status: 404 })
    }
    
    const [withTrust] = await attachPartnerTrustToBookings([bookings[0]])
    return NextResponse.json({ status: 'success', data: withTrust })
    
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
    
    // 2. Validate transition
    const allowedTransitions = STATUS_TRANSITIONS[currentBooking.status] || []
    if (!allowedTransitions.includes(newStatus)) {
      return NextResponse.json({
        status: 'error',
        error: `Cannot transition from ${currentBooking.status} to ${newStatus}`
      }, { status: 400 })
    }

    if (newStatus === 'CONFIRMED') {
      const inv = await BookingService.verifyInventoryBeforePartnerConfirm(id)
      if (!inv.ok) {
        const msg =
          inv.error === 'INSUFFICIENT_CAPACITY'
            ? 'Недостаточно свободных мест на эти даты (возможно, другая заявка заняла лимит).'
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
    
    // 3. Build update
    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString()
    }
    
    if (newStatus === 'CONFIRMED') {
      updateData.confirmed_at = new Date().toISOString()
    } else if (newStatus === 'CANCELLED') {
      updateData.cancelled_at = new Date().toISOString()
    } else if (newStatus === 'COMPLETED') {
      updateData.completed_at = new Date().toISOString()
    }
    
    // 4. Update in Supabase
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      }
    )
    
    if (!updateRes.ok) {
      const error = await updateRes.text()
      console.error('[BOOKING UPDATE] Error:', error)
      return NextResponse.json({ status: 'error', error: 'Failed to update booking' }, { status: 500 })
    }
    
    const updated = await updateRes.json()
    console.log(`[BOOKING UPDATE] Success: ${id} -> ${newStatus}`)

    try {
      await syncBookingStatusToConversationChat({
        bookingId: id,
        previousStatus: currentBooking.status,
        newStatus,
        declineReasonKey,
        declineReasonDetail,
        reasonFreeText: reason,
      })
    } catch (e) {
      console.error('[BOOKING UPDATE] chat sync', e)
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
      data: updated[0] || { id, status: newStatus },
      message: newStatus === 'CONFIRMED' ? 'Бронирование подтверждено' : 
               newStatus === 'CANCELLED' ? 'Бронирование отклонено' : 'Статус обновлён'
    })
    
  } catch (error) {
    console.error('[BOOKING UPDATE ERROR]', error)
    return NextResponse.json({ status: 'error', error: error.message }, { status: 500 })
  }
}
