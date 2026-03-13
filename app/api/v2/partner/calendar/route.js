/**
 * Gostaylo - Partner Calendar API (v2) - LIVE DATA
 * 
 * Aggregates availability and bookings for ALL partner listings
 * Uses seasonal_prices table for pricing
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { getUserIdFromRequest, verifyPartnerAccess } from '@/lib/services/session-service'
import { addDays, format, parseISO, isWithinInterval, isSameDay, differenceInDays } from 'date-fns'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Get seasonal price for a date
 */
function getSeasonalPrice(seasonalPrices, listingId, date) {
  const dateObj = parseISO(date)
  const seasonal = seasonalPrices.find(sp => 
    sp.listing_id === listingId &&
    dateObj >= parseISO(sp.start_date) &&
    dateObj <= parseISO(sp.end_date)
  )
  return seasonal ? {
    price: seasonal.price_daily,
    minStay: seasonal.min_stay || 1,
    seasonType: seasonal.season_type,
    label: seasonal.label
  } : null
}

/**
 * Process calendar data with seasonal pricing
 */
function processCalendarData(listings, bookings, blocks, seasonalPrices, startDate, endDate) {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  
  const dates = []
  let current = start
  while (current <= end) {
    dates.push(format(current, 'yyyy-MM-dd'))
    current = addDays(current, 1)
  }
  
  const calendarData = listings.map(listing => {
    const listingBookings = bookings.filter(b => b.listing_id === listing.id)
    const listingBlocks = blocks.filter(b => b.listing_id === listing.id)
    
    const availability = {}
    
    dates.forEach(date => {
      const dateObj = parseISO(date)
      
      // Check booking
      const booking = listingBookings.find(b => {
        const checkIn = parseISO(b.check_in)
        const checkOut = parseISO(b.check_out)
        return (dateObj >= checkIn && dateObj <= checkOut) ||
               isSameDay(dateObj, checkIn) || isSameDay(dateObj, checkOut)
      })
      
      // Check block
      const block = listingBlocks.find(b => {
        const blockStart = parseISO(b.start_date)
        const blockEnd = parseISO(b.end_date)
        return (dateObj >= blockStart && dateObj <= blockEnd) ||
               isSameDay(dateObj, blockStart) || isSameDay(dateObj, blockEnd)
      })
      
      if (booking) {
        const isCheckIn = isSameDay(dateObj, parseISO(booking.check_in))
        const isCheckOut = isSameDay(dateObj, parseISO(booking.check_out))
        
        // Transition detection
        const hasOtherCheckOut = listingBookings.some(b => 
          b.id !== booking.id && isSameDay(dateObj, parseISO(b.check_out))
        )
        const hasOtherCheckIn = listingBookings.some(b => 
          b.id !== booking.id && isSameDay(dateObj, parseISO(b.check_in))
        )
        
        availability[date] = {
          status: 'BOOKED',
          bookingId: booking.id,
          guestName: booking.guest_name,
          bookingStatus: booking.status,
          source: booking.source || 'PLATFORM',
          isCheckIn,
          isCheckOut,
          isTransition: (isCheckOut && hasOtherCheckIn) || (isCheckIn && hasOtherCheckOut),
          priceThb: parseFloat(booking.price_thb) || 0
        }
      } else if (block) {
        availability[date] = {
          status: 'BLOCKED',
          blockId: block.id,
          reason: block.reason,
          blockType: block.type
        }
      } else {
        // Available - get seasonal price if exists
        const seasonalData = getSeasonalPrice(seasonalPrices, listing.id, date)
        availability[date] = {
          status: 'AVAILABLE',
          priceThb: seasonalData?.price || listing.base_price_thb,
          minStay: seasonalData?.minStay || 1,
          seasonType: seasonalData?.seasonType,
          label: seasonalData?.label
        }
      }
    })
    
    return {
      listing: {
        id: listing.id,
        title: listing.title,
        district: listing.district,
        coverImage: listing.cover_image,
        basePriceThb: parseFloat(listing.base_price_thb) || 0,
        commissionRate: parseFloat(listing.commission_rate) || 15
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
    
    const { searchParams } = new URL(request.url)
    const today = new Date()
    const defaultStart = format(today, 'yyyy-MM-dd')
    const defaultEnd = format(addDays(today, 30), 'yyyy-MM-dd')
    
    const startDate = searchParams.get('startDate') || defaultStart
    const endDate = searchParams.get('endDate') || defaultEnd
    
    // Try direct Supabase REST API
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        // Fetch listings
        const listingsRes = await fetch(
          `${SUPABASE_URL}/rest/v1/listings?owner_id=eq.${userId}&select=id,title,district,cover_image,base_price_thb,commission_rate,status`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`
            }
          }
        )
        const listings = await listingsRes.json()
        
        if (!Array.isArray(listings) || listings.length === 0) {
          console.log(`[CALENDAR] No listings found for partner ${userId}`)
          return NextResponse.json({
            status: 'success',
            data: { dates: [], listings: [], summary: { totalListings: 0, totalBookings: 0, totalBlocks: 0 } },
            meta: { partnerId: userId, startDate, endDate }
          })
        }
        
        const listingIds = listings.map(l => l.id)
        console.log(`[CALENDAR] Found ${listings.length} listings for partner ${userId}`)
        
        // Fetch bookings
        const bookingsRes = await fetch(
          `${SUPABASE_URL}/rest/v1/bookings?partner_id=eq.${userId}&check_out=gte.${startDate}&check_in=lte.${endDate}&status=in.(PENDING,CONFIRMED,PAID)&select=id,listing_id,guest_name,check_in,check_out,status,price_thb,source`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`
            }
          }
        )
        const bookings = await bookingsRes.json()
        
        // Fetch blocks (calendar_blocks table)
        let blocks = []
        try {
          const blocksRes = await fetch(
            `${SUPABASE_URL}/rest/v1/calendar_blocks?listing_id=in.(${listingIds.join(',')})&end_date=gte.${startDate}&start_date=lte.${endDate}&select=id,listing_id,start_date,end_date,reason,type`,
            {
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
              }
            }
          )
          blocks = await blocksRes.json()
          if (!Array.isArray(blocks)) blocks = []
        } catch (e) {
          console.log('[CALENDAR] No calendar_blocks table or error:', e.message)
        }
        
        // Fetch seasonal prices
        let seasonalPrices = []
        try {
          const seasonalRes = await fetch(
            `${SUPABASE_URL}/rest/v1/seasonal_prices?listing_id=in.(${listingIds.join(',')})&end_date=gte.${startDate}&start_date=lte.${endDate}&select=*`,
            {
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
              }
            }
          )
          seasonalPrices = await seasonalRes.json()
          if (!Array.isArray(seasonalPrices)) seasonalPrices = []
        } catch (e) {
          console.log('[CALENDAR] No seasonal_prices:', e.message)
        }
        
        const calendarData = processCalendarData(
          listings,
          Array.isArray(bookings) ? bookings : [],
          blocks,
          seasonalPrices,
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
            hasSeasonalPrices: seasonalPrices.length > 0
          }
        })
        
      } catch (error) {
        console.error('[CALENDAR API] Supabase error:', error)
      }
    }
    
    // Fallback to mock if Supabase fails
    console.log('[CALENDAR API] Using mock data fallback')
    const mockData = generateMockCalendarData(startDate, endDate)
    
    return NextResponse.json({
      status: 'success',
      data: mockData,
      meta: { partnerId: userId, startDate, endDate, isMockData: true }
    })
    
  } catch (error) {
    console.error('[CALENDAR API ERROR]', error)
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 })
  }
}

function generateMockCalendarData(startDate, endDate) {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  const dates = []
  let current = start
  while (current <= end) {
    dates.push(format(current, 'yyyy-MM-dd'))
    current = addDays(current, 1)
  }
  
  return {
    dates,
    listings: [],
    summary: { totalListings: 0, totalBookings: 0, totalBlocks: 0 }
  }
}
