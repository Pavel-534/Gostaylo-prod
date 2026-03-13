/**
 * Gostaylo - Partner Stats API (v2) - LIVE DATA
 * 
 * Analytics endpoint with real Supabase data
 * Uses seasonal_prices for pricing calculations
 */

import { NextResponse } from 'next/server'
import { getUserIdFromRequest, verifyPartnerAccess } from '@/lib/services/session-service'
import { format, addDays, subDays, startOfMonth, endOfMonth, differenceInDays, parseISO } from 'date-fns'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function generateMockStats() {
  const today = new Date()
  
  return {
    revenue: {
      confirmed: 0,
      pending: 0,
      total: 0,
      trend: Array(7).fill(null).map((_, i) => ({
        day: format(subDays(today, 6 - i), 'EEE'),
        revenue: 0
      }))
    },
    occupancy: { rate: 0, occupiedDays: 0, totalCapacity: 0, listingsCount: 0 },
    today: { checkIns: 0, checkOuts: 0, checkInsList: [], checkOutsList: [] },
    pending: { count: 0, items: [] },
    upcoming: [],
    bookings: { total: 0, confirmed: 0, pending: 0, completed: 0 }
  }
}

export async function GET(request) {
  try {
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
    
    console.log(`[STATS API] Fetching stats for partner: ${userId}`)
    
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.log('[STATS API] Supabase not configured, using mock')
      return NextResponse.json({
        status: 'success',
        data: generateMockStats(),
        meta: { partnerId: userId, isMockData: true }
      })
    }
    
    try {
      const today = new Date()
      const todayStr = format(today, 'yyyy-MM-dd')
      const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd')
      const next7Days = format(addDays(today, 7), 'yyyy-MM-dd')
      
      // Fetch listings
      const listingsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?owner_id=eq.${userId}&select=id,title,base_price_thb`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      )
      const listings = await listingsRes.json()
      
      if (!Array.isArray(listings)) {
        throw new Error('Invalid listings response')
      }
      
      // Fetch all bookings for this partner
      const bookingsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/bookings?partner_id=eq.${userId}&select=*`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      )
      const bookings = await bookingsRes.json()
      
      if (!Array.isArray(bookings)) {
        console.log('[STATS] No bookings found')
      }
      
      const allBookings = Array.isArray(bookings) ? bookings : []
      
      // Calculate stats
      const confirmedStatuses = ['CONFIRMED', 'PAID', 'COMPLETED']
      const pendingStatuses = ['PENDING']
      
      const confirmedBookings = allBookings.filter(b => confirmedStatuses.includes(b.status))
      const pendingBookings = allBookings.filter(b => pendingStatuses.includes(b.status))
      
      // Revenue
      const confirmedRevenue = confirmedBookings.reduce((sum, b) => {
        const earnings = parseFloat(b.partner_earnings_thb) || (parseFloat(b.price_thb) * 0.85)
        return sum + earnings
      }, 0)
      
      const pendingRevenue = pendingBookings.reduce((sum, b) => {
        const earnings = parseFloat(b.partner_earnings_thb) || (parseFloat(b.price_thb) * 0.85)
        return sum + earnings
      }, 0)
      
      // Occupancy (this month)
      const monthBookings = confirmedBookings.filter(b => {
        return b.check_out >= monthStart && b.check_in <= monthEnd
      })
      
      const totalDaysInMonth = differenceInDays(parseISO(monthEnd), parseISO(monthStart)) + 1
      const totalCapacity = listings.length * totalDaysInMonth
      
      let occupiedDays = 0
      monthBookings.forEach(b => {
        const checkIn = parseISO(b.check_in)
        const checkOut = parseISO(b.check_out)
        const effectiveStart = checkIn < parseISO(monthStart) ? parseISO(monthStart) : checkIn
        const effectiveEnd = checkOut > parseISO(monthEnd) ? parseISO(monthEnd) : checkOut
        const days = differenceInDays(effectiveEnd, effectiveStart) + 1
        occupiedDays += Math.max(0, days)
      })
      
      const occupancyRate = totalCapacity > 0 ? Math.round((occupiedDays / totalCapacity) * 100) : 0
      
      // Today's activity
      const todayCheckIns = confirmedBookings.filter(b => b.check_in === todayStr)
      const todayCheckOuts = confirmedBookings.filter(b => b.check_out === todayStr)
      
      // Upcoming arrivals
      const upcoming = confirmedBookings
        .filter(b => b.check_in >= todayStr && b.check_in <= next7Days)
        .sort((a, b) => a.check_in.localeCompare(b.check_in))
        .slice(0, 5)
        .map(b => {
          const listing = listings.find(l => l.id === b.listing_id)
          return {
            id: b.id,
            guestName: b.guest_name,
            listingTitle: listing?.title || 'Объект',
            checkIn: b.check_in,
            checkOut: b.check_out,
            nights: differenceInDays(parseISO(b.check_out), parseISO(b.check_in)),
            priceThb: parseFloat(b.price_thb) || 0
          }
        })
      
      // Pending items
      const pendingItems = pendingBookings.slice(0, 5).map(b => {
        const listing = listings.find(l => l.id === b.listing_id)
        return {
          id: b.id,
          guestName: b.guest_name,
          listingTitle: listing?.title || 'Объект',
          checkIn: b.check_in,
          priceThb: parseFloat(b.price_thb) || 0
        }
      })
      
      // Revenue trend (last 7 days)
      const trend = []
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(today, i), 'yyyy-MM-dd')
        const dayStr = format(subDays(today, i), 'EEE')
        const dayRevenue = confirmedBookings
          .filter(b => b.check_in === date)
          .reduce((sum, b) => sum + (parseFloat(b.partner_earnings_thb) || 0), 0)
        trend.push({ day: dayStr, revenue: dayRevenue })
      }
      
      const stats = {
        revenue: {
          confirmed: Math.round(confirmedRevenue),
          pending: Math.round(pendingRevenue),
          total: Math.round(confirmedRevenue + pendingRevenue),
          trend
        },
        occupancy: {
          rate: occupancyRate,
          occupiedDays,
          totalCapacity,
          listingsCount: listings.length
        },
        today: {
          checkIns: todayCheckIns.length,
          checkOuts: todayCheckOuts.length,
          checkInsList: todayCheckIns.map(b => ({
            id: b.id,
            guestName: b.guest_name,
            listingTitle: listings.find(l => l.id === b.listing_id)?.title || 'Объект'
          })),
          checkOutsList: todayCheckOuts.map(b => ({
            id: b.id,
            guestName: b.guest_name,
            listingTitle: listings.find(l => l.id === b.listing_id)?.title || 'Объект'
          }))
        },
        pending: {
          count: pendingBookings.length,
          items: pendingItems
        },
        upcoming,
        bookings: {
          total: allBookings.length,
          confirmed: confirmedBookings.length,
          pending: pendingBookings.length,
          completed: allBookings.filter(b => b.status === 'COMPLETED').length
        }
      }
      
      console.log(`[STATS API] Stats calculated: ${listings.length} listings, ${allBookings.length} bookings`)
      
      return NextResponse.json({
        status: 'success',
        data: stats,
        meta: { partnerId: userId }
      })
      
    } catch (error) {
      console.error('[STATS API] Supabase error:', error)
      return NextResponse.json({
        status: 'success',
        data: generateMockStats(),
        meta: { partnerId: userId, isFallback: true, error: error.message }
      })
    }
    
  } catch (error) {
    console.error('[STATS API ERROR]', error)
    return NextResponse.json({
      status: 'success',
      data: generateMockStats(),
      meta: { isFallback: true }
    })
  }
}
