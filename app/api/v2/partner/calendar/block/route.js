/**
 * GoStayLo - Calendar Block API
 * 
 * POST /api/v2/partner/calendar/block - Create availability block
 * DELETE /api/v2/partner/calendar/block - Remove block
 * 
 * @security Validates owner_id before any operation
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { v4 as uuidv4 } from 'uuid'
import { OCCUPYING_BOOKING_STATUSES } from '@/lib/booking-occupancy-statuses'

export const dynamic = 'force-dynamic'

// In-memory store for mock blocks (development only)
let mockBlocks = [
  {
    id: 'blk-001',
    listingId: 'lst-villa-001',
    startDate: '2026-03-10',
    endDate: '2026-03-12',
    reason: 'Техническое обслуживание',
    type: 'MAINTENANCE'
  }
]

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
    const { listingId, startDate, endDate, reason, type = 'OWNER_USE' } = body
    
    if (!listingId || !startDate || !endDate) {
      return NextResponse.json({
        status: 'error',
        error: 'listingId, startDate, and endDate are required'
      }, { status: 400 })
    }
    
    console.log(`[BLOCK API] Creating block for listing ${listingId}: ${startDate} - ${endDate}`)
    
    // Mock mode
    if (!isSupabaseConfigured() || !supabaseAdmin) {
      const newBlock = {
        id: `blk-${uuidv4().slice(0, 8)}`,
        listingId,
        startDate,
        endDate,
        reason: reason || 'Заблокировано владельцем',
        type,
        createdAt: new Date().toISOString()
      }
      mockBlocks.push(newBlock)
      
      return NextResponse.json({
        status: 'success',
        data: newBlock,
        message: 'Даты заблокированы'
      })
    }
    
    // Verify listing ownership
    const { data: listing, error: listingError } = await supabaseAdmin
      .from('listings')
      .select('id, owner_id')
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
      .in('status', OCCUPYING_BOOKING_STATUSES)
      .or(`and(check_in.lte.${endDate},check_out.gte.${startDate})`)
    
    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({
        status: 'error',
        error: 'Невозможно заблокировать - есть активные бронирования в этом периоде'
      }, { status: 409 })
    }
    
    // Create block
    const { data: block, error: blockError } = await supabaseAdmin
      .from('availability_blocks')
      .insert({
        id: `blk-${uuidv4().slice(0, 8)}`,
        listing_id: listingId,
        start_date: startDate,
        end_date: endDate,
        reason: reason || 'Заблокировано владельцем',
        type,
        created_by: userId,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (blockError) {
      console.error('[BLOCK API] Error:', blockError)
      return NextResponse.json({
        status: 'error',
        error: blockError.message
      }, { status: 500 })
    }
    
    return NextResponse.json({
      status: 'success',
      data: {
        id: block.id,
        listingId: block.listing_id,
        startDate: block.start_date,
        endDate: block.end_date,
        reason: block.reason,
        type: block.type
      },
      message: 'Даты заблокированы'
    })
    
  } catch (error) {
    console.error('[BLOCK API ERROR]', error)
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const userId = await getUserIdFromSession()
    
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        error: 'Authentication required'
      }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const blockId = searchParams.get('blockId')
    
    if (!blockId) {
      return NextResponse.json({
        status: 'error',
        error: 'blockId is required'
      }, { status: 400 })
    }
    
    console.log(`[BLOCK API] Deleting block ${blockId}`)
    
    // Mock mode
    if (!isSupabaseConfigured() || !supabaseAdmin) {
      mockBlocks = mockBlocks.filter(b => b.id !== blockId)
      return NextResponse.json({
        status: 'success',
        message: 'Блокировка снята'
      })
    }
    
    // Verify ownership through listing
    const { data: block, error: blockError } = await supabaseAdmin
      .from('availability_blocks')
      .select(`
        id,
        listing:listings!inner(owner_id)
      `)
      .eq('id', blockId)
      .single()
    
    if (blockError || !block || block.listing?.owner_id !== userId) {
      return NextResponse.json({
        status: 'error',
        error: 'Block not found or access denied'
      }, { status: 404 })
    }
    
    // Delete block
    const { error: deleteError } = await supabaseAdmin
      .from('availability_blocks')
      .delete()
      .eq('id', blockId)
    
    if (deleteError) {
      return NextResponse.json({
        status: 'error',
        error: deleteError.message
      }, { status: 500 })
    }
    
    return NextResponse.json({
      status: 'success',
      message: 'Блокировка снята'
    })
    
  } catch (error) {
    console.error('[BLOCK API DELETE ERROR]', error)
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 })
  }
}
