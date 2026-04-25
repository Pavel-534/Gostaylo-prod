/**
 * GoStayLo - Partner Stats API (v2) - LIVE DATA
 * 
 * Analytics endpoint with real Supabase data
 * Uses seasonal_prices for pricing calculations
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import {
  format,
  addDays,
  subDays,
  subMonths,
  startOfMonth,
  endOfMonth,
  differenceInDays,
  parseISO,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { toListingDate, listingDateToday, addListingDays } from '@/lib/listing-date'
import { buildBookingFinancialSnapshotFromRow } from '@/lib/services/booking-financial-read-model.service'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Get seasonal price for a specific date
 */
function getSeasonalPriceForDate(seasonalPrices, listingId, date) {
  const dateObj = parseISO(date)
  const seasonal = seasonalPrices.find(sp => 
    sp.listing_id === listingId &&
    dateObj >= parseISO(sp.start_date) &&
    dateObj <= parseISO(sp.end_date)
  )
  return seasonal?.price_daily || null
}

/** Partner net (THB) — read-model SSOT (Stage 46.0). */
function partnerNetThbFromBookingRow(b) {
  const s = buildBookingFinancialSnapshotFromRow(b)
  return s && Number.isFinite(s.net) ? s.net : 0
}

/** Последние 6 календарных месяцев (ключ yyyy-MM) + суммы выплат PAID/COMPLETED (нетто до удержания метода). */
function buildIncomeByMonthFromPayouts(payoutRows, today) {
  const keys = []
  for (let i = 5; i >= 0; i -= 1) {
    keys.push(format(subMonths(today, i), 'yyyy-MM'))
  }
  const sums = Object.fromEntries(keys.map((k) => [k, 0]))
  for (const row of payoutRows || []) {
    const raw = row.processed_at || row.created_at
    if (!raw) continue
    const d = typeof raw === 'string' ? parseISO(raw) : new Date(raw)
    const key = format(d, 'yyyy-MM')
    if (!Object.prototype.hasOwnProperty.call(sums, key)) continue
    const g =
      parseFloat(row.gross_amount) ||
      parseFloat(row.final_amount) ||
      parseFloat(row.amount) ||
      0
    sums[key] += g
  }
  return keys.map((key) => ({
    key,
    label: format(parseISO(`${key}-01`), 'LLL yy', { locale: ru }),
    amountThb: Math.round(sums[key] * 100) / 100,
  }))
}

function generateMockStats() {
  const today = new Date()

  return {
    revenue: {
      confirmed: 0,
      pending: 0,
      total: 0,
      trend: Array(7)
        .fill(null)
        .map((_, i) => ({
          day: format(subDays(today, 6 - i), 'EEE'),
          revenue: 0,
        })),
    },
    occupancy: { rate: 0, occupiedDays: 0, totalCapacity: 0, listingsCount: 0 },
    today: { checkIns: 0, checkOuts: 0, checkInsList: [], checkOutsList: [] },
    pending: { count: 0, items: [] },
    upcoming: [],
    bookings: { total: 0, confirmed: 0, pending: 0, completed: 0 },
    financialV2: {
      moneyInTransitThb: 0,
      incomeByMonth: buildIncomeByMonthFromPayouts([], today),
    },
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
      const listingToday = listingDateToday()
      const next7Listing = addListingDays(listingToday, 7)
      const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd')
      
      // Fetch listings
      const listingsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?owner_id=eq.${userId}&select=id,title,base_price_thb,category_id`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          },
          cache: 'no-store'
        }
      )
      const listings = await listingsRes.json()
      
      if (!Array.isArray(listings)) {
        throw new Error('Invalid listings response')
      }

      const categoryIds = [...new Set(listings.map((l) => l.category_id).filter(Boolean))]
      const categorySlugById = {}
      if (categoryIds.length) {
        const catRes = await fetch(
          `${SUPABASE_URL}/rest/v1/listing_categories?id=in.(${categoryIds.join(',')})&select=id,slug`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
            cache: 'no-store',
          },
        )
        const cats = await catRes.json()
        if (Array.isArray(cats)) {
          for (const c of cats) {
            if (c?.id) categorySlugById[String(c.id)] = c.slug || null
          }
        }
      }
      
      // Fetch all bookings for this partner
      const bookingsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/bookings?partner_id=eq.${userId}&select=*`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          },
          cache: 'no-store'
        }
      )
      const bookings = await bookingsRes.json()
      
      if (!Array.isArray(bookings)) {
        console.log('[STATS] No bookings found')
      }
      
      const allBookings = Array.isArray(bookings) ? bookings : []
      
      // Fetch seasonal prices for potential revenue calculation
      let seasonalPrices = []
      try {
        const listingIds = listings.map(l => l.id)
        const seasonalRes = await fetch(
          `${SUPABASE_URL}/rest/v1/seasonal_prices?listing_id=in.(${listingIds.join(',')})&end_date=gte.${todayStr}&select=*`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`
            }
          }
        )
        seasonalPrices = await seasonalRes.json()
        if (!Array.isArray(seasonalPrices)) seasonalPrices = []
        console.log(`[STATS] Found ${seasonalPrices.length} seasonal prices`)
      } catch (e) {
        console.log('[STATS] No seasonal prices:', e.message)
      }
      
      // Calculate stats
      const confirmedStatuses = ['CONFIRMED', 'PAID', 'PAID_ESCROW', 'COMPLETED']
      const pendingStatuses = ['PENDING']
      
      const confirmedBookings = allBookings.filter(b => confirmedStatuses.includes(b.status))
      const pendingBookings = allBookings.filter(b => pendingStatuses.includes(b.status))
      
      // Revenue
      const confirmedRevenue = confirmedBookings.reduce((sum, b) => sum + partnerNetThbFromBookingRow(b), 0)

      const pendingRevenue = pendingBookings.reduce((sum, b) => sum + partnerNetThbFromBookingRow(b), 0)
      
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
      
      // Today's activity (listing calendar YMD, matches TIMESTAMPTZ + occupancy)
      const todayCheckIns = confirmedBookings.filter(
        (b) => toListingDate(b.check_in) === listingToday,
      )
      const todayCheckOuts = confirmedBookings.filter(
        (b) => toListingDate(b.check_out) === listingToday,
      )
      
      // Upcoming arrivals
      const upcoming = confirmedBookings
        .filter((b) => {
          const cin = toListingDate(b.check_in)
          return cin && cin >= listingToday && cin <= next7Listing
        })
        .sort((a, b) => a.check_in.localeCompare(b.check_in))
        .slice(0, 5)
        .map(b => {
          const listing = listings.find(l => l.id === b.listing_id)
          const catId = listing?.category_id ? String(listing.category_id) : ''
          return {
            id: b.id,
            guestName: b.guest_name,
            listingTitle: listing?.title || 'Объект',
            checkIn: b.check_in,
            checkOut: b.check_out,
            nights: differenceInDays(parseISO(b.check_out), parseISO(b.check_in)),
            categorySlug: catId ? categorySlugById[catId] ?? null : null,
            priceThb: parseFloat(b.price_thb) || 0,
            partnerNetThb: partnerNetThbFromBookingRow(b),
          }
        })
      
      // Pending items
      const pendingItems = pendingBookings.slice(0, 5).map((b) => {
        const listing = listings.find((l) => l.id === b.listing_id)
        return {
          id: b.id,
          guestName: b.guest_name,
          listingTitle: listing?.title || 'Объект',
          checkIn: b.check_in,
          priceThb: parseFloat(b.price_thb) || 0,
          partnerNetThb: partnerNetThbFromBookingRow(b),
        }
      })
      
      // Revenue trend (last 7 days)
      const trend = []
      for (let i = 6; i >= 0; i--) {
        const date = addListingDays(listingToday, -(6 - i))
        const dayStr = format(parseISO(date), 'EEE')
        const dayRevenue = confirmedBookings
          .filter((b) => toListingDate(b.check_in) === date)
          .reduce((sum, b) => sum + partnerNetThbFromBookingRow(b), 0)
        trend.push({ day: dayStr, revenue: dayRevenue })
      }
      
      // Calculate potential revenue (next 30 days, available dates only) — partner share from default commission SSOT
      let potentialRevenue = 0
      const defaultCommissionPct = await resolveDefaultCommissionPercent()
      const partnerShareRatio = Math.max(0, Math.min(1, (100 - defaultCommissionPct) / 100))

      for (const listing of listings) {
        const basePrice = parseFloat(listing.base_price_thb) || 0

        for (let i = 0; i < 30; i++) {
          const date = format(addDays(today, i), 'yyyy-MM-dd')

          const isBooked = confirmedBookings.some((b) => {
            const checkIn = parseISO(b.check_in)
            const checkOut = parseISO(b.check_out)
            const currentDate = parseISO(date)
            return (
              b.listing_id === listing.id && currentDate >= checkIn && currentDate < checkOut
            )
          })

          if (!isBooked) {
            const seasonalPrice = getSeasonalPriceForDate(seasonalPrices, listing.id, date)
            const dailyPrice = seasonalPrice || basePrice
            potentialRevenue += dailyPrice * partnerShareRatio
          }
        }
      }
      
      let incomeByMonth = buildIncomeByMonthFromPayouts([], today)
      let moneyInTransitThb = 0
      try {
        const escrowBookings = allBookings.filter((b) => b.status === 'PAID_ESCROW')
        moneyInTransitThb =
          Math.round(
            escrowBookings.reduce((sum, b) => sum + partnerNetThbFromBookingRow(b), 0) * 100,
          ) / 100

        const { data: payoutRows, error: payoutsErr } = await supabaseAdmin
          .from('payouts')
          .select('gross_amount, amount, final_amount, processed_at, created_at, status')
          .eq('partner_id', userId)
          .in('status', ['PAID', 'COMPLETED'])
          .order('created_at', { ascending: false })
          .limit(3000)
        if (payoutsErr) {
          console.warn('[STATS] payouts query:', payoutsErr.message)
        } else {
          incomeByMonth = buildIncomeByMonthFromPayouts(payoutRows || [], today)
        }
      } catch (e) {
        console.warn('[STATS] financialV2:', e.message)
      }

      const stats = {
        revenue: {
          confirmed: Math.round(confirmedRevenue),
          pending: Math.round(pendingRevenue),
          total: Math.round(confirmedRevenue + pendingRevenue),
          potential: Math.round(potentialRevenue),
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
        },
        financialV2: {
          moneyInTransitThb,
          incomeByMonth,
        },
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
