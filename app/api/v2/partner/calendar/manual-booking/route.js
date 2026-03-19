/**
 * Gostaylo - Manual Booking API
 * 
 * POST /api/v2/partner/calendar/manual-booking - Create manual booking (offline sales)
 * 
 * @security Validates owner_id before any operation
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { v4 as uuidv4 } from 'uuid'
import { differenceInDays, parseISO } from 'date-fns'

export const dynamic = 'force-dynamic'

// In-memory store for mock bookings
let mockManualBookings = []

export async function POST(request) {
  try {
    const userId = await getUserIdFromSession()
    
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        error: 'Authentication required'
      }, { status: 401 })
    }
    
    const partner = await verifyPartnerAccess(userId)
    if (!partner) {
      return NextResponse.json({
        status: 'error',
        error: 'Partner access denied'
      }, { status: 403 })
    }
    
    const body = await request.json()
    const { 
      listingId, 
      checkIn, 
      checkOut, 
      guestName, 
      guestPhone, 
      guestEmail,
      priceThb,
      notes 
    } = body
    
    // Validation
    if (!listingId || !checkIn || !checkOut || !guestName) {
      return NextResponse.json({
        status: 'error',
        error: 'listingId, checkIn, checkOut, and guestName are required'
      }, { status: 400 })
    }
    
    const nights = differenceInDays(parseISO(checkOut), parseISO(checkIn))
    if (nights < 1) {
      return NextResponse.json({
        status: 'error',
        error: 'Check-out must be after check-in'
      }, { status: 400 })
    }
    
    console.log(`[MANUAL BOOKING] Creating for listing ${listingId}: ${checkIn} - ${checkOut}`)
    
    // Mock mode
    if (!isSupabaseConfigured() || !supabaseAdmin) {
      const newBooking = {
        id: `bk-manual-${uuidv4().slice(0, 8)}`,
        listingId,
        partnerId: userId,
        checkIn,
        checkOut,
        guestName,
        guestPhone: guestPhone || null,
        guestEmail: guestEmail || null,
        priceThb: parseFloat(priceThb) || 0,
        notes,
        status: 'CONFIRMED',
        source: 'MANUAL',
        createdAt: new Date().toISOString()
      }
      mockManualBookings.push(newBooking)
      
      return NextResponse.json({
        status: 'success',
        data: newBooking,
        message: 'Бронирование создано'
      })
    }
    
    // Verify listing ownership
    const { data: listing, error: listingError } = await supabaseAdmin
      .from('listings')
      .select('id, owner_id, base_price_thb, commission_rate')
      .eq('id', listingId)
      .eq('owner_id', userId)
      .single()
    
    if (listingError || !listing) {
      return NextResponse.json({
        status: 'error',
        error: 'Listing not found or access denied'
      }, { status: 404 })
    }
    
    // Check for conflicting bookings
    const { data: conflicts } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('listing_id', listingId)
      .in('status', ['PENDING', 'CONFIRMED', 'PAID'])
      .or(`and(check_in.lt.${checkOut},check_out.gt.${checkIn})`)
    
    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({
        status: 'error',
        error: 'Даты уже заняты другим бронированием'
      }, { status: 409 })
    }
    
    // Check for conflicting blocks
    const { data: blockConflicts } = await supabaseAdmin
      .from('availability_blocks')
      .select('id')
      .eq('listing_id', listingId)
      .or(`and(start_date.lt.${checkOut},end_date.gt.${checkIn})`)
    
    if (blockConflicts && blockConflicts.length > 0) {
      return NextResponse.json({
        status: 'error',
        error: 'Даты заблокированы'
      }, { status: 409 })
    }
    
    // Calculate price if not provided
    const finalPrice = priceThb || (listing.base_price_thb * nights)
    const commissionRate = listing.commission_rate || 15
    const commissionThb = finalPrice * (commissionRate / 100)
    const partnerEarningsThb = finalPrice - commissionThb
    
    // Create booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        id: `bk-${uuidv4().slice(0, 8)}`,
        listing_id: listingId,
        partner_id: userId,
        check_in: checkIn,
        check_out: checkOut,
        guest_name: guestName,
        guest_phone: guestPhone || null,
        guest_email: guestEmail || null,
        price_thb: finalPrice,
        commission_rate: commissionRate,
        commission_thb: commissionThb,
        partner_earnings_thb: partnerEarningsThb,
        notes,
        status: 'CONFIRMED',
        source: 'MANUAL',
        confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (bookingError) {
      console.error('[MANUAL BOOKING] Error:', bookingError)
      return NextResponse.json({
        status: 'error',
        error: bookingError.message
      }, { status: 500 })
    }
    
    return NextResponse.json({
      status: 'success',
      data: {
        id: booking.id,
        listingId: booking.listing_id,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        guestName: booking.guest_name,
        priceThb: booking.price_thb,
        status: booking.status,
        source: booking.source
      },
      message: 'Бронирование создано'
    })
    
  } catch (error) {
    console.error('[MANUAL BOOKING ERROR]', error)
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 })
  }
}
