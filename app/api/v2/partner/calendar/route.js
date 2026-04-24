/**
 * GoStayLo - Partner Calendar API (v2) - LIVE DATA
 * 
 * Aggregates availability and bookings for ALL partner listings
 * Uses seasonal_prices table for pricing
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { addDays, format, parseISO } from 'date-fns'
import { toPublicImageUrl } from '@/lib/public-image-url'
import { OCCUPYING_BOOKING_STATUSES } from '@/lib/booking-occupancy-statuses'
import { mapCategorySlugToListingType } from '@/lib/partner-calendar-filters'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'
import { toListingDate } from '@/lib/listing-date'
import { PricingService } from '@/lib/services/pricing.service'
import { normalizeAllowedListingIdsFromRow } from '@/lib/promo/allowed-listing-ids'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
// Use service role to bypass RLS (partner listings may be restricted by RLS)
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function promoRowIsActive(row, nowMs) {
  if (!row || row.is_active === false) return false
  if (row.max_uses != null && Number(row.current_uses) >= Number(row.max_uses)) return false
  if (!row.valid_until) return true
  const endMs = new Date(row.valid_until).getTime()
  return Number.isFinite(endMs) && endMs > nowMs
}

function promoAppliesToListing(row, listingId, ownerId) {
  const listing = String(listingId || '')
  const owner = String(ownerId || '')
  const createdByType = String(row?.created_by_type || 'PLATFORM').toUpperCase()
  const allowedIds = normalizeAllowedListingIdsFromRow(row?.allowed_listing_ids)

  if (allowedIds && !allowedIds.includes(listing)) return false

  if (createdByType === 'PARTNER') {
    const pid = String(row?.partner_id || '')
    return Boolean(pid) && pid === owner
  }

  return createdByType === 'PLATFORM'
}

function buildMarketingPromoForDay({ promos, listingId, ownerId, date, dailyPrice }) {
  const daily = Math.max(0, Math.round(Number(dailyPrice) || 0))
  if (daily <= 0 || !Array.isArray(promos) || promos.length === 0) return null

  const dateEndMs = new Date(`${date}T23:59:59.999Z`).getTime()
  let best = null

  for (const row of promos) {
    if (!promoAppliesToListing(row, listingId, ownerId)) continue
    if (row.valid_until) {
      const endMs = new Date(row.valid_until).getTime()
      if (!Number.isFinite(endMs) || endMs < dateEndMs) continue
    }

    const promoType = String(row.promo_type || '').toUpperCase()
    const rawValue = Number(row.value)
    if (!Number.isFinite(rawValue) || rawValue <= 0) continue

    let discount = 0
    if (promoType === 'PERCENTAGE') {
      discount = Math.round((daily * Math.min(100, rawValue)) / 100)
    } else {
      discount = Math.round(rawValue)
    }
    discount = Math.min(daily, Math.max(0, discount))
    if (discount <= 0) continue

    if (!best || discount > best.discountAmount) {
      best = {
        code: String(row.code || '').toUpperCase(),
        discountAmount: discount,
        promoType,
        promoValue: rawValue,
        isFlashSale: row.is_flash_sale === true,
        validUntil: row.valid_until || null,
      }
    }
  }

  if (!best) return null
  return {
    ...best,
    baseSeasonPrice: daily,
    guestPrice: Math.max(0, daily - best.discountAmount),
  }
}

function resolveMinStayForDate(date, dbSeasonalPrices, metadataSeasonalPricing) {
  for (const season of dbSeasonalPrices || []) {
    const startDate = season.start_date
    const endDate = season.end_date
    if (startDate && endDate && date >= startDate && date <= endDate) {
      return Math.max(1, parseInt(season.min_stay, 10) || 1)
    }
  }
  for (const season of metadataSeasonalPricing || []) {
    const startDate = season.startDate || season.start_date
    const endDate = season.endDate || season.end_date
    if (startDate && endDate && date >= startDate && date <= endDate) {
      return Math.max(1, parseInt(season.minStay ?? season.min_stay, 10) || 1)
    }
  }
  return 1
}

/**
 * Process calendar data with seasonal pricing
 *
 * Priority (same night): BOOKING night > BLOCK > checkout transition > AVAILABLE
 * Night model: occupied nights are [check_in, check_out) — aligns with CalendarService / OTAs.
 * Blocks are inclusive [start_date, end_date].
 */
/** YYYY-MM-DD in listing TZ — avoids UTC slice(0,10) on TIMESTAMPTZ */
function calendarDateKey(value) {
  return toListingDate(value) || ''
}

function processCalendarData(
  listings,
  bookings,
  blocks,
  seasonalPrices,
  promoRows,
  startDate,
  endDate,
  defaultListingCommission,
) {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  
  const dates = []
  let current = start
  while (current <= end) {
    dates.push(format(current, 'yyyy-MM-dd'))
    current = addDays(current, 1)
  }
  
  const calendarData = listings.map(listing => {
    const rawCat = listing.categories
    const cat = Array.isArray(rawCat) ? rawCat[0] : rawCat
    const lid = String(listing.id)
    const listingBookings = bookings.filter((b) => String(b.listing_id) === lid)
    const listingBlocks = blocks.filter((b) => String(b.listing_id) === lid)
    const listingSeasonal = seasonalPrices.filter((sp) => String(sp.listing_id) === lid)
    const metadataSeasonalPricing =
      listing?.metadata && typeof listing.metadata === 'object'
        ? listing.metadata.seasonal_pricing || []
        : []
    
    const availability = {}
    
    dates.forEach(date => {
      const dateObj = parseISO(date)
      
      // 1) Occupied nights only: check_in <= date < check_out (string calendar keys, no TZ drift)
      const booking = listingBookings.find((b) => {
        const checkIn = calendarDateKey(b.check_in)
        const checkOut = calendarDateKey(b.check_out)
        return checkIn && checkOut && date >= checkIn && date < checkOut
      })
      
      // 2) Inclusive block (manual / iCal) — skipped if a booking occupies this night
      const block = !booking && listingBlocks.find(b => {
        const blockStart = parseISO(b.start_date)
        const blockEnd = parseISO(b.end_date)
        return dateObj >= blockStart && dateObj <= blockEnd
      })
      
      // Checkout morning: not an occupied night; may still be blocked above
      const checkoutBooking = listingBookings.find((b) => date === calendarDateKey(b.check_out))
      
      if (booking) {
        const isCheckIn = date === calendarDateKey(booking.check_in)
        const hasOtherCheckOut = listingBookings.some(
          (b) => b.id !== booking.id && date === calendarDateKey(b.check_out)
        )
        
        availability[date] = {
          status: 'BOOKED',
          bookingId: booking.id,
          guestName: booking.guest_name,
          bookingStatus: booking.status,
          source: booking.source != null ? booking.source : 'PLATFORM',
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
        const { dailyPrice, seasonLabel } = PricingService.calculateDailyPrice(
          parseFloat(listing.base_price_thb) || 0,
          date,
          metadataSeasonalPricing,
          listingSeasonal,
        )
        const marketingPromo = buildMarketingPromoForDay({
          promos: promoRows,
          listingId: listing.id,
          ownerId: listing.owner_id,
          date,
          dailyPrice,
        })
        const minStay = resolveMinStayForDate(date, listingSeasonal, metadataSeasonalPricing)
        availability[date] = {
          status: 'AVAILABLE',
          priceThb: dailyPrice,
          minStay,
          seasonType: null,
          label: seasonLabel,
          marketingPromo,
          isTransition: false,
          isCheckOut: true,
          previousGuestName: checkoutBooking.guest_name
        }
      } else {
        const { dailyPrice, seasonLabel } = PricingService.calculateDailyPrice(
          parseFloat(listing.base_price_thb) || 0,
          date,
          metadataSeasonalPricing,
          listingSeasonal,
        )
        const marketingPromo = buildMarketingPromoForDay({
          promos: promoRows,
          listingId: listing.id,
          ownerId: listing.owner_id,
          date,
          dailyPrice,
        })
        const minStay = resolveMinStayForDate(date, listingSeasonal, metadataSeasonalPricing)
        availability[date] = {
          status: 'AVAILABLE',
          priceThb: dailyPrice,
          minStay,
          seasonType: null,
          label: seasonLabel,
          marketingPromo,
        }
      }
    })
    
    const categorySlug = cat?.slug ? String(cat.slug).toLowerCase() : null

    return {
      listing: {
        id: listing.id,
        title: listing.title,
        district: listing.district,
        coverImage: listing.cover_image ? toPublicImageUrl(listing.cover_image) : null,
        basePriceThb: parseFloat(listing.base_price_thb) || 0,
        commissionRate: (() => {
          const n = parseFloat(listing.commission_rate)
          return Number.isFinite(n) && n >= 0 ? n : defaultListingCommission
        })(),
        categoryId: listing.category_id ?? null,
        category: cat
          ? {
              id: cat.id,
              name: cat.name,
              slug: cat.slug,
              icon: cat.icon ?? null,
            }
          : null,
        categorySlug,
        type: mapCategorySlugToListingType(categorySlug || undefined),
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
    const filterListingId = searchParams.get('listingId') || searchParams.get('listing_id')

    // Use supabaseAdmin (service role) to bypass RLS, or direct fetch with service key
    const useAdmin = !!supabaseAdmin
    if (useAdmin || (SUPABASE_URL && SUPABASE_KEY)) {
      try {
        let listings = []
        let bookings = []
        let blocks = []
        let seasonalPrices = []
        let promoRows = []

        if (useAdmin) {
          // Use supabaseAdmin - bypasses RLS
          const { data: listingsData, error: listingsErr } = await supabaseAdmin
            .from('listings')
            .select(
              'id,title,district,cover_image,base_price_thb,commission_rate,status,category_id,owner_id,metadata,categories(id,name,slug,icon)'
            )
            .eq('owner_id', userId)
          if (listingsErr) throw listingsErr
          listings = listingsData || []
        } else {
          const listingsRes = await fetch(
            `${SUPABASE_URL}/rest/v1/listings?owner_id=eq.${userId}&select=id,title,district,cover_image,base_price_thb,commission_rate,status,category_id,owner_id,metadata,categories(id,name,slug,icon)`,
            { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
          )
          const data = await listingsRes.json()
          listings = Array.isArray(data) ? data : []
        }

        if (filterListingId) {
          const fid = String(filterListingId)
          listings = (listings || []).filter((l) => String(l.id) === fid)
          if (!listings.length) {
            return NextResponse.json(
              {
                status: 'error',
                error: 'Listing not found or does not belong to your account',
                code: 'LISTING_NOT_FOUND',
              },
              { status: 404 }
            )
          }
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
        
        // Bookings by listing_id (not partner_id): matches public availability. Some rows may have
        // missing/wrong partner_id while listing_id still points at this owner's listing.
        if (useAdmin) {
          const { data: bookingsData, error: bookingsQueryError } = await supabaseAdmin
            .from('bookings')
            .select('id,listing_id,guest_name,check_in,check_out,status,price_thb')
            .in('listing_id', listingIds)
            .gte('check_out', startDate)
            .lte('check_in', endDate)
            .in('status', OCCUPYING_BOOKING_STATUSES)
          if (bookingsQueryError) {
            console.error('[CALENDAR] bookings query error:', bookingsQueryError.message, bookingsQueryError)
            throw bookingsQueryError
          }
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

          try {
            const { data: promosData } = await supabaseAdmin
              .from('promo_codes')
              .select(
                'code,promo_type,value,is_active,valid_until,max_uses,current_uses,created_by_type,partner_id,allowed_listing_ids,is_flash_sale',
              )
              .eq('is_active', true)
            const nowMs = Date.now()
            promoRows = (promosData || []).filter((row) => promoRowIsActive(row, nowMs))
          } catch (e) {
            console.log('[CALENDAR] Error fetching promo_codes:', e.message)
          }
        } else {
          const listingIn =
            listingIds.length === 1
              ? `listing_id=eq.${listingIds[0]}`
              : `listing_id=in.(${listingIds.join(',')})`
          const bookingsRes = await fetch(
            `${SUPABASE_URL}/rest/v1/bookings?${listingIn}&check_out=gte.${startDate}&check_in=lte.${endDate}&status=in.(${OCCUPYING_BOOKING_STATUSES.join(',')})&select=id,listing_id,guest_name,check_in,check_out,status,price_thb`,
            { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
          )
          const bookingsJson = await bookingsRes.json()
          if (!bookingsRes.ok) {
            console.error('[CALENDAR] bookings REST error:', bookingsRes.status, bookingsJson)
            throw new Error(bookingsJson?.message || bookingsJson?.error || 'Bookings fetch failed')
          }
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

          try {
            const promosRes = await fetch(
              `${SUPABASE_URL}/rest/v1/promo_codes?is_active=eq.true&select=code,promo_type,value,is_active,valid_until,max_uses,current_uses,created_by_type,partner_id,allowed_listing_ids,is_flash_sale`,
              { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
            )
            const pd = await promosRes.json()
            const nowMs = Date.now()
            promoRows = (Array.isArray(pd) ? pd : []).filter((row) => promoRowIsActive(row, nowMs))
          } catch (e) {
            console.log('[CALENDAR] Error fetching promo_codes:', e.message)
          }
        }
        
        const defaultListingCommission = await resolveDefaultCommissionPercent()
        const calendarData = processCalendarData(
          listings,
          Array.isArray(bookings) ? bookings : [],
          blocks,
          seasonalPrices,
          promoRows,
          startDate,
          endDate,
          defaultListingCommission,
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
