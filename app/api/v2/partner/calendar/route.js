/**
 * Gostaylo - Partner Calendar API (v2) - LIVE DATA
 * 
 * Aggregates availability and bookings for ALL partner listings
 * Uses seasonal_prices table for pricing
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { addDays, format, parseISO, isSameDay } from 'date-fns'
import { toStorageProxyUrl } from '@/lib/supabase-proxy-urls'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
// Use service role to bypass RLS (partner listings may be restricted by RLS)
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Get seasonal price for a date
 */
function getSeasonalPrice(seasonalPrices, listingId, date) {
  const dateObj = parseISO(date)
  const seasonal = seasonalPrices.find(sp => {
    const spStart = parseISO(sp.start_date)
    const spEnd = parseISO(sp.end_date)
    const match = sp.listing_id === listingId &&
                  dateObj >= spStart &&
                  dateObj <= spEnd
    
    if (sp.listing_id === listingId && date >= '2025-12-20' && date <= '2025-12-27') {
      console.log(`[SEASONAL] Checking ${date}: start=${sp.start_date}, end=${sp.end_date}, match=${match}`)
    }
    
    return match
  })
  
  return seasonal ? {
    price: seasonal.price_daily,
    minStay: seasonal.min_stay || 1,
    seasonType: seasonal.season_type,
    label: seasonal.label
  } : null
}

/**
 * Process calendar data with seasonal pricing
 *
 * Priority (same night): BOOKING night > BLOCK > checkout transition > AVAILABLE
 * Night model: occupied nights are [check_in, check_out) — aligns with CalendarService / OTAs.
 * Blocks are inclusive [start_date, end_date].
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
      
      // 1) Occupied nights only: check_in <= date < check_out
      const booking = listingBookings.find(b => {
        const checkIn = parseISO(b.check_in)
        const checkOut = parseISO(b.check_out)
        return dateObj >= checkIn && dateObj < checkOut
      })
      
      // 2) Inclusive block (manual / iCal) — skipped if a booking occupies this night
      const block = !booking && listingBlocks.find(b => {
        const blockStart = parseISO(b.start_date)
        const blockEnd = parseISO(b.end_date)
        return dateObj >= blockStart && dateObj <= blockEnd
      })
      
      // Checkout morning: not an occupied night; may still be blocked above
      const checkoutBooking = listingBookings.find(b => isSameDay(dateObj, parseISO(b.check_out)))
      
      if (booking) {
        const isCheckIn = isSameDay(dateObj, parseISO(booking.check_in))
        const hasOtherCheckOut = listingBookings.some(b =>
          b.id !== booking.id && isSameDay(dateObj, parseISO(b.check_out))
        )
        
        availability[date] = {
          status: 'BOOKED',
          bookingId: booking.id,
          guestName: booking.guest_name,
          bookingStatus: booking.status,
          source: booking.source || 'PLATFORM',
          isCheckIn,
          isCheckOut: false,
          // Same-day turnover: new guest checks in while another checks out
          isTransition: isCheckIn && hasOtherCheckOut,
          priceThb: parseFloat(booking.price_thb) || 0
        }
      } else if (block) {
        availability[date] = {
          status: 'BLOCKED',
          blockId: block.id,
          reason: block.reason,
          blockType: block.type
        }
      } else if (checkoutBooking) {
        const seasonalData = getSeasonalPrice(seasonalPrices, listing.id, date)
        availability[date] = {
          status: 'AVAILABLE',
          priceThb: seasonalData?.price || listing.base_price_thb,
          minStay: seasonalData?.minStay || 1,
          seasonType: seasonalData?.seasonType,
          label: seasonalData?.label,
          isTransition: false,
          isCheckOut: true,
          previousGuestName: checkoutBooking.guest_name
        }
      } else {
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
        coverImage: listing.cover_image ? toStorageProxyUrl(listing.cover_image) : null,
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
    const userId = await getUserIdFromSession()
    
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        error: 'Authentication required. Please log in.'
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
    
    // Use supabaseAdmin (service role) to bypass RLS, or direct fetch with service key
    const useAdmin = !!supabaseAdmin
    if (useAdmin || (SUPABASE_URL && SUPABASE_KEY)) {
      try {
        let listings = []
        let bookings = []
        let blocks = []
        let seasonalPrices = []

        if (useAdmin) {
          // Use supabaseAdmin - bypasses RLS
          const { data: listingsData, error: listingsErr } = await supabaseAdmin
            .from('listings')
            .select('id,title,district,cover_image,base_price_thb,commission_rate,status')
            .eq('owner_id', userId)
          if (listingsErr) throw listingsErr
          listings = listingsData || []
        } else {
          const listingsRes = await fetch(
            `${SUPABASE_URL}/rest/v1/listings?owner_id=eq.${userId}&select=id,title,district,cover_image,base_price_thb,commission_rate,status`,
            { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
          )
          const data = await listingsRes.json()
          listings = Array.isArray(data) ? data : []
        }
        
        if (!listings.length) {
          console.log(`[CALENDAR] No listings found for partner ${userId}`)
          return NextResponse.json({
            status: 'success',
            data: { dates: [], listings: [], summary: { totalListings: 0, totalBookings: 0, totalBlocks: 0 } },
            meta: { partnerId: userId, startDate, endDate }
          })
        }
        
        const listingIds = listings.map(l => l.id)
        console.log(`[CALENDAR] Found ${listings.length} listings for partner ${userId}`)
        
        if (useAdmin) {
          const { data: bookingsData } = await supabaseAdmin
            .from('bookings')
            .select('id,listing_id,guest_name,check_in,check_out,status,price_thb,source')
            .eq('partner_id', userId)
            .gte('check_out', startDate)
            .lte('check_in', endDate)
            .in('status', ['PENDING', 'CONFIRMED', 'PAID'])
          bookings = bookingsData || []
          
          try {
            const { data: blocksData } = await supabaseAdmin
              .from('calendar_blocks')
              .select('id,listing_id,start_date,end_date,reason,type')
              .in('listing_id', listingIds)
              .gte('end_date', startDate)
              .lte('start_date', endDate)
            blocks = blocksData || []
          } catch (e) {
            console.log('[CALENDAR] No calendar_blocks table:', e.message)
          }
          
          try {
            const { data: seasonalData } = await supabaseAdmin
              .from('seasonal_prices')
              .select('*')
              .in('listing_id', listingIds)
              .gte('end_date', startDate)
              .lte('start_date', endDate)
            seasonalPrices = seasonalData || []
          } catch (e) {
            console.log('[CALENDAR] Error fetching seasonal_prices:', e.message)
          }
        } else {
          const bookingsRes = await fetch(
            `${SUPABASE_URL}/rest/v1/bookings?partner_id=eq.${userId}&check_out=gte.${startDate}&check_in=lte.${endDate}&status=in.(PENDING,CONFIRMED,PAID)&select=id,listing_id,guest_name,check_in,check_out,status,price_thb,source`,
            { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
          )
          const bookingsJson = await bookingsRes.json()
          bookings = Array.isArray(bookingsJson) ? bookingsJson : []
          
          try {
            const blocksRes = await fetch(
              `${SUPABASE_URL}/rest/v1/calendar_blocks?listing_id=in.(${listingIds.join(',')})&end_date=gte.${startDate}&start_date=lte.${endDate}&select=id,listing_id,start_date,end_date,reason,type`,
              { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
            )
            blocks = Array.isArray(await blocksRes.json()) ? await blocksRes.json() : []
          } catch (e) {
            console.log('[CALENDAR] No calendar_blocks table or error:', e.message)
          }
          
          try {
            const seasonalRes = await fetch(
              `${SUPABASE_URL}/rest/v1/seasonal_prices?listing_id=in.(${listingIds.join(',')})&end_date=gte.${startDate}&start_date=lte.${endDate}&select=*`,
              { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
            )
            const sd = await seasonalRes.json()
            seasonalPrices = Array.isArray(sd) ? sd : []
          } catch (e) {
            console.log('[CALENDAR] Error fetching seasonal_prices:', e.message)
          }
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
        return NextResponse.json(
          {
            status: 'error',
            error: error?.message || 'Не удалось загрузить календарь из базы данных.',
            code: 'CALENDAR_DB_ERROR'
          },
          { status: 503 }
        )
      }
    }

    return NextResponse.json(
      {
        status: 'error',
        error: 'Календарь недоступен: не настроено подключение к базе данных.',
        code: 'CALENDAR_DISABLED'
      },
      { status: 503 }
    )
    
  } catch (error) {
    console.error('[CALENDAR API ERROR]', error)
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 })
  }
}
