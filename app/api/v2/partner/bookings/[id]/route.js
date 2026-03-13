/**
 * Gostaylo - Partner Booking Actions API (v2)
 * 
 * SECURITY: All operations verify owner_id = session.user.id
 * 
 * GET /api/v2/partner/bookings/[id] - Get single booking
 * PUT /api/v2/partner/bookings/[id] - Update booking status
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { getUserIdFromRequest, verifyPartnerAccess } from '@/lib/services/session-service'

export const dynamic = 'force-dynamic'

// Valid status transitions
const STATUS_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  PAID: ['COMPLETED', 'REFUNDED'],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: []
}

export async function GET(request, { params }) {
  try {
    const { id } = await params
    const userId = getUserIdFromRequest(request)
    
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
    
    if (!isSupabaseConfigured() || !supabaseAdmin) {
      // Mock response
      return NextResponse.json({
        status: 'success',
        data: {
          id,
          partnerId: userId,
          status: 'PENDING',
          checkIn: '2026-03-20',
          checkOut: '2026-03-25',
          priceThb: 25000,
          guestName: 'Test Guest'
        }
      })
    }
    
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        listing:listings (*),
        renter:profiles!bookings_renter_id_fkey (id, name, email, phone)
      `)
      .eq('id', id)
      .eq('partner_id', userId) // SECURITY: Verify ownership
      .single()
    
    if (error || !booking) {
      return NextResponse.json({
        status: 'error',
        error: 'Booking not found or access denied'
      }, { status: 404 })
    }
    
    return NextResponse.json({
      status: 'success',
      data: booking
    })
    
  } catch (error) {
    console.error('[PARTNER BOOKING GET ERROR]', error)
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params
    const userId = getUserIdFromRequest(request)
    const body = await request.json()
    const { status: newStatus, reason } = body
    
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
    
    if (!newStatus) {
      return NextResponse.json({
        status: 'error',
        error: 'Status is required'
      }, { status: 400 })
    }
    
    console.log(`[PARTNER BOOKING] Updating booking ${id} to ${newStatus} by partner ${userId}`)
    
    if (!isSupabaseConfigured() || !supabaseAdmin) {
      // Mock response
      return NextResponse.json({
        status: 'success',
        data: {
          id,
          partnerId: userId,
          status: newStatus,
          updatedAt: new Date().toISOString()
        },
        message: `Booking status updated to ${newStatus}`
      })
    }
    
    // 1. Fetch current booking and verify ownership
    const { data: currentBooking, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('id, status, partner_id, renter_id, listing_id')
      .eq('id', id)
      .eq('partner_id', userId) // SECURITY: Verify ownership
      .single()
    
    if (fetchError || !currentBooking) {
      return NextResponse.json({
        status: 'error',
        error: 'Booking not found or access denied'
      }, { status: 404 })
    }
    
    // 2. Validate status transition
    const allowedTransitions = STATUS_TRANSITIONS[currentBooking.status] || []
    if (!allowedTransitions.includes(newStatus)) {
      return NextResponse.json({
        status: 'error',
        error: `Cannot transition from ${currentBooking.status} to ${newStatus}. Allowed: ${allowedTransitions.join(', ') || 'none'}`
      }, { status: 400 })
    }
    
    // 3. Build update object
    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString()
    }
    
    // Add status-specific timestamps
    if (newStatus === 'CONFIRMED') {
      updateData.confirmed_at = new Date().toISOString()
    } else if (newStatus === 'CANCELLED') {
      updateData.cancelled_at = new Date().toISOString()
      updateData.cancellation_reason = reason || null
    } else if (newStatus === 'COMPLETED') {
      updateData.completed_at = new Date().toISOString()
    }
    
    // 4. Update booking
    const { data: updatedBooking, error: updateError } = await supabaseAdmin
      .from('bookings')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        listing:listings (id, title),
        renter:profiles!bookings_renter_id_fkey (id, name, email)
      `)
      .single()
    
    if (updateError) {
      console.error('[PARTNER BOOKING] Update error:', updateError)
      return NextResponse.json({
        status: 'error',
        error: updateError.message
      }, { status: 500 })
    }
    
    console.log(`[PARTNER BOOKING] Successfully updated booking ${id} to ${newStatus}`)
    
    // 5. TODO: Send notification to renter via Telegram
    // await sendTelegramNotification(updatedBooking.renter, newStatus, updatedBooking)
    
    return NextResponse.json({
      status: 'success',
      data: updatedBooking,
      message: `Booking ${newStatus === 'CONFIRMED' ? 'подтверждено' : newStatus === 'CANCELLED' ? 'отклонено' : 'обновлено'}`
    })
    
  } catch (error) {
    console.error('[PARTNER BOOKING PUT ERROR]', error)
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 })
  }
}
