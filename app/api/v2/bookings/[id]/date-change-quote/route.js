/**
 * GET /api/v2/bookings/[id]/date-change-quote
 * Stage 202.14 — read-only old/new/delta quote for date change or stay extension.
 * Query: checkIn? (default current), checkOut (required), guestsCount?, currency?
 */

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { isStaffRole } from '@/lib/services/chat/access'
import { BookingService } from '@/lib/services/booking.service'
import { computeDateChangeQuoteForBooking } from '@/lib/services/booking/date-change-quote.js'

export const dynamic = 'force-dynamic'

export async function GET(request, context) {
  const params = await Promise.resolve(context.params)
  const bookingId = params?.id
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'Booking ID required' }, { status: 400 })
  }

  try {
    const session = await getSessionPayload()
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const userId = String(session.userId)
    const role = String(session.role || '').toUpperCase()
    const isStaff = isStaffRole(role)

    const booking = await BookingService.getBookingById(bookingId)
    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    const isRenter = booking.renter_id && String(booking.renter_id) === userId
    const isPartner = booking.partner_id && String(booking.partner_id) === userId
    if (!isStaff && !isRenter && !isPartner) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const checkIn = searchParams.get('checkIn') || searchParams.get('check_in') || undefined
    const checkOut = searchParams.get('checkOut') || searchParams.get('check_out')
    const guestsCount = searchParams.get('guestsCount') || searchParams.get('guests') || undefined
    const currency = searchParams.get('currency') || undefined

    if (!checkOut) {
      return NextResponse.json(
        { success: false, error: 'checkOut required', code: 'INVALID_INPUT' },
        { status: 400 },
      )
    }

    const quote = await computeDateChangeQuoteForBooking(booking, {
      checkIn,
      checkOut,
      guestsCount,
      currency,
    })

    if (!quote.ok) {
      const status = quote.code === 'NOT_FOUND' ? 404 : 400
      return NextResponse.json(
        { success: false, error: quote.error, code: quote.code || 'QUOTE_FAILED', data: quote },
        { status },
      )
    }

    return NextResponse.json({ success: true, data: quote })
  } catch (error) {
    console.error('[DATE-CHANGE-QUOTE]', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'quote_failed' },
      { status: 500 },
    )
  }
}
