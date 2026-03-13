/**
 * Gostaylo - Partner Calendar API (v2)
 * 
 * "God View" - Aggregates availability and bookings for ALL partner listings
 * 
 * GET /api/v2/partner/calendar
 *   - Query params: partnerId, startDate, endDate
 *   - Returns: listings with their bookings and blocks
 * 
 * @security All queries filtered by owner_id = session.user.id
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { getUserIdFromRequest, verifyPartnerAccess } from '@/lib/services/session-service'
import { addDays, format, parseISO, isWithinInterval, isSameDay } from 'date-fns'

export const dynamic = 'force-dynamic'

// Mock data for development
const MOCK_LISTINGS = [
  {
    id: 'lst-villa-001',
    title: 'Роскошная вилла с бассейном',
    type: 'villa',
    district: 'Rawai',
    coverImage: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=400',
    basePriceThb: 8500
  },
  {
    id: 'lst-apt-002',
    title: 'Современные апартаменты в центре',
    type: 'apartment',
    district: 'Patong',
    coverImage: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400',
    basePriceThb: 3500
  },
  {
    id: 'lst-yacht-003',
    title: 'Яхта Princess 65ft',
    type: 'yacht',
    district: 'Chalong',
    coverImage: 'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=400',
    basePriceThb: 45000
  },
  {
    id: 'lst-bike-004',
    title: 'Honda PCX 160',
    type: 'bike',
    district: 'Kata',
    coverImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
    basePriceThb: 350
  }
]

const MOCK_BOOKINGS = [
  {
    id: 'bk-001',
    listingId: 'lst-villa-001',
    guestName: 'Иван Петров',
    guestPhone: '+7 999 123 4567',
    checkIn: '2026-03-15',
    checkOut: '2026-03-20',
    status: 'CONFIRMED',
    priceThb: 42500,
    source: 'PLATFORM'
  },
  {
    id: 'bk-002',
    listingId: 'lst-villa-001',
    guestName: 'Мария Сидорова',
    guestPhone: '+7 999 765 4321',
    checkIn: '2026-03-22',
    checkOut: '2026-03-25',
    status: 'PENDING',
    priceThb: 25500,
    source: 'PLATFORM'
  },
  {
    id: 'bk-003',
    listingId: 'lst-apt-002',
    guestName: 'Алексей Козлов',
    guestPhone: '+7 999 111 2233',
    checkIn: '2026-03-18',
    checkOut: '2026-03-23',
    status: 'CONFIRMED',
    priceThb: 17500,
    source: 'MANUAL'
  },
  {
    id: 'bk-004',
    listingId: 'lst-yacht-003',
    guestName: 'Дмитрий Волков',
    guestPhone: '+7 999 444 5566',
    checkIn: '2026-03-20',
    checkOut: '2026-03-20',
    status: 'CONFIRMED',
    priceThb: 45000,
    source: 'PLATFORM'
  },
  {
    id: 'bk-005',
    listingId: 'lst-bike-004',
    guestName: 'Елена Новикова',
    guestPhone: '+7 999 777 8899',
    checkIn: '2026-03-14',
    checkOut: '2026-03-28',
    status: 'CONFIRMED',
    priceThb: 4900,
    source: 'MANUAL'
  }
]

const MOCK_BLOCKS = [
  {
    id: 'blk-001',
    listingId: 'lst-villa-001',
    startDate: '2026-03-10',
    endDate: '2026-03-12',
    reason: 'Техническое обслуживание',
    type: 'MAINTENANCE'
  },
  {
    id: 'blk-002',
    listingId: 'lst-apt-002',
    startDate: '2026-03-25',
    endDate: '2026-03-27',
    reason: 'Личное использование',
    type: 'OWNER_USE'
  }
]

/**
 * Calculate is_transition flag for check-in/check-out overlaps
 */
function processCalendarData(listings, bookings, blocks, startDate, endDate) {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  
  // Create date range array
  const dates = []
  let current = start
  while (current <= end) {
    dates.push(format(current, 'yyyy-MM-dd'))
    current = addDays(current, 1)
  }
  
  // Process each listing
  const calendarData = listings.map(listing => {
    const listingBookings = bookings.filter(b => b.listingId === listing.id)
    const listingBlocks = blocks.filter(b => b.listingId === listing.id)
    
    // Build day-by-day availability
    const availability = {}
    
    dates.forEach(date => {
      const dateObj = parseISO(date)
      
      // Check for booking
      const booking = listingBookings.find(b => {
        const checkIn = parseISO(b.checkIn)
        const checkOut = parseISO(b.checkOut)
        return isWithinInterval(dateObj, { start: checkIn, end: checkOut }) ||
               isSameDay(dateObj, checkIn) || isSameDay(dateObj, checkOut)
      })
      
      // Check for block
      const block = listingBlocks.find(b => {
        const blockStart = parseISO(b.startDate)
        const blockEnd = parseISO(b.endDate)
        return isWithinInterval(dateObj, { start: blockStart, end: blockEnd }) ||
               isSameDay(dateObj, blockStart) || isSameDay(dateObj, blockEnd)
      })
      
      if (booking) {
        const isCheckIn = isSameDay(dateObj, parseISO(booking.checkIn))
        const isCheckOut = isSameDay(dateObj, parseISO(booking.checkOut))
        
        // Check for transition (check-out and check-in on same day)
        const hasCheckOutToday = listingBookings.some(b => 
          b.id !== booking.id && isSameDay(dateObj, parseISO(b.checkOut))
        )
        const hasCheckInToday = listingBookings.some(b => 
          b.id !== booking.id && isSameDay(dateObj, parseISO(b.checkIn))
        )
        
        availability[date] = {
          status: 'BOOKED',
          bookingId: booking.id,
          guestName: booking.guestName,
          bookingStatus: booking.status,
          source: booking.source,
          isCheckIn,
          isCheckOut,
          isTransition: (isCheckOut && hasCheckInToday) || (isCheckIn && hasCheckOutToday),
          priceThb: booking.priceThb
        }
      } else if (block) {
        availability[date] = {
          status: 'BLOCKED',
          blockId: block.id,
          reason: block.reason,
          blockType: block.type
        }
      } else {
        availability[date] = {
          status: 'AVAILABLE'
        }
      }
    })
    
    return {
      listing: {
        id: listing.id,
        title: listing.title,
        type: listing.type,
        district: listing.district,
        coverImage: listing.coverImage,
        basePriceThb: listing.basePriceThb
      },
      availability,
      bookingsCount: listingBookings.length,
      blocksCount: listingBlocks.length
    }
  })
  
  return {
    dates,
    listings: calendarData,
    summary: {
      totalListings: listings.length,
      totalBookings: bookings.length,
      totalBlocks: blocks.length
    }
  }
}

export async function GET(request) {
  try {
    // 1. Extract and validate user
    const userId = getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        error: 'Authentication required. Please provide partnerId.'
      }, { status: 401 })
    }
    
    const partner = await verifyPartnerAccess(userId)
    if (!partner) {
      return NextResponse.json({
        status: 'error',
        error: 'Partner access denied'
      }, { status: 403 })
    }
    
    console.log(`[CALENDAR API] Fetching calendar for partner: ${userId}`)
    
    // 2. Parse date range (default: today + 30 days)
    const { searchParams } = new URL(request.url)
    const today = new Date()
    const defaultStart = format(today, 'yyyy-MM-dd')
    const defaultEnd = format(addDays(today, 30), 'yyyy-MM-dd')
    
    const startDate = searchParams.get('startDate') || defaultStart
    const endDate = searchParams.get('endDate') || defaultEnd
    
    // 3. Check if Supabase is configured
    if (!isSupabaseConfigured() || !supabaseAdmin) {
      console.log('[CALENDAR API] Using mock data (Supabase not configured)')
      
      const calendarData = processCalendarData(
        MOCK_LISTINGS,
        MOCK_BOOKINGS,
        MOCK_BLOCKS,
        startDate,
        endDate
      )
      
      return NextResponse.json({
        status: 'success',
        data: calendarData,
        meta: {
          partnerId: userId,
          startDate,
          endDate,
          isMockData: true
        }
      })
    }
    
    // 4. Fetch all partner listings
    const { data: listings, error: listingsError } = await supabaseAdmin
      .from('listings')
      .select('id, title, type, district, cover_image, base_price_thb, images')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
    
    if (listingsError) {
      console.error('[CALENDAR API] Listings error:', listingsError)
      throw new Error(listingsError.message)
    }
    
    const listingIds = (listings || []).map(l => l.id)
    
    if (listingIds.length === 0) {
      return NextResponse.json({
        status: 'success',
        data: {
          dates: [],
          listings: [],
          summary: { totalListings: 0, totalBookings: 0, totalBlocks: 0 }
        },
        meta: { partnerId: userId, startDate, endDate }
      })
    }
    
    // 5. Fetch all bookings for these listings in date range
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('id, listing_id, guest_name, guest_phone, check_in, check_out, status, price_thb, source, created_at')
      .in('listing_id', listingIds)
      .gte('check_out', startDate)
      .lte('check_in', endDate)
      .in('status', ['PENDING', 'CONFIRMED', 'PAID'])
    
    if (bookingsError) {
      console.error('[CALENDAR API] Bookings error:', bookingsError)
    }
    
    // 6. Fetch all blocks for these listings in date range
    const { data: blocks, error: blocksError } = await supabaseAdmin
      .from('availability_blocks')
      .select('id, listing_id, start_date, end_date, reason, type')
      .in('listing_id', listingIds)
      .gte('end_date', startDate)
      .lte('start_date', endDate)
    
    if (blocksError) {
      console.error('[CALENDAR API] Blocks error:', blocksError)
    }
    
    // 7. Transform data
    const transformedListings = (listings || []).map(l => ({
      id: l.id,
      title: l.title,
      type: l.type,
      district: l.district,
      coverImage: l.cover_image || l.images?.[0],
      basePriceThb: parseFloat(l.base_price_thb) || 0
    }))
    
    const transformedBookings = (bookings || []).map(b => ({
      id: b.id,
      listingId: b.listing_id,
      guestName: b.guest_name,
      guestPhone: b.guest_phone,
      checkIn: b.check_in,
      checkOut: b.check_out,
      status: b.status,
      priceThb: parseFloat(b.price_thb) || 0,
      source: b.source || 'PLATFORM'
    }))
    
    const transformedBlocks = (blocks || []).map(b => ({
      id: b.id,
      listingId: b.listing_id,
      startDate: b.start_date,
      endDate: b.end_date,
      reason: b.reason,
      type: b.type
    }))
    
    // 8. Process calendar data
    const calendarData = processCalendarData(
      transformedListings,
      transformedBookings,
      transformedBlocks,
      startDate,
      endDate
    )
    
    console.log(`[CALENDAR API] Returning ${calendarData.listings.length} listings with ${calendarData.dates.length} days`)
    
    return NextResponse.json({
      status: 'success',
      data: calendarData,
      meta: {
        partnerId: userId,
        startDate,
        endDate
      }
    })
    
  } catch (error) {
    console.error('[CALENDAR API ERROR]', error)
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 })
  }
}
