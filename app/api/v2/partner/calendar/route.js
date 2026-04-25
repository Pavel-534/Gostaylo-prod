/**
 * GoStayLo - Partner Calendar API (v2)
 *
 * SSOT: availability + nightly pricing come from `CalendarService.getCalendarForDateRange`
 * (same `buildCalendar` as guest/public flows). No duplicated night/promo logic here.
 */

import { NextResponse } from 'next/server'
import { addDays, format } from 'date-fns'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { toPublicImageUrl } from '@/lib/public-image-url'
import { mapCategorySlugToListingType } from '@/lib/partner-calendar-filters'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'
import { addListingDays } from '@/lib/listing-date'
import { CalendarService } from '@/lib/services/calendar.service'
import { promoIsActiveAt } from '@/lib/promo/promo-engine'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const YMD = /^\d{4}-\d{2}-\d{2}$/

function ymdRangeInclusive(startYmd, endYmd) {
  const dates = []
  let cur = startYmd
  while (cur <= endYmd) {
    dates.push(cur)
    cur = addListingDays(cur, 1)
  }
  return dates
}

async function loadActivePromoRows(useAdmin) {
  if (useAdmin && supabaseAdmin) {
    const { data: promosData } = await supabaseAdmin
      .from('promo_codes')
      .select(
        'code,promo_type,value,is_active,valid_until,max_uses,current_uses,created_by_type,partner_id,allowed_listing_ids,is_flash_sale',
      )
      .eq('is_active', true)
    const nowMs = Date.now()
    return (promosData || []).filter((row) => promoIsActiveAt(row, nowMs).ok)
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) return []
  try {
    const promosRes = await fetch(
      `${SUPABASE_URL}/rest/v1/promo_codes?is_active=eq.true&select=code,promo_type,value,is_active,valid_until,max_uses,current_uses,created_by_type,partner_id,allowed_listing_ids,is_flash_sale`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
    )
    const pd = await promosRes.json()
    const nowMs = Date.now()
    return (Array.isArray(pd) ? pd : []).filter((row) => promoIsActiveAt(row, nowMs).ok)
  } catch {
    return []
  }
}

export async function GET(request) {
  try {
    const userId = await getUserIdFromSession()

    if (!userId) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'Authentication required. Please log in.',
        },
        { status: 401 },
      )
    }

    const partner = await verifyPartnerAccess(userId)
    if (!partner) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'Partner access denied',
        },
        { status: 403 },
      )
    }

    const { searchParams } = new URL(request.url)
    const today = new Date()
    const defaultStart = format(today, 'yyyy-MM-dd')
    const defaultEnd = format(addDays(today, 30), 'yyyy-MM-dd')

    const startDate = searchParams.get('startDate') || defaultStart
    const endDate = searchParams.get('endDate') || defaultEnd
    const filterListingId = searchParams.get('listingId') || searchParams.get('listing_id')

    if (!YMD.test(startDate) || !YMD.test(endDate) || startDate > endDate) {
      return NextResponse.json(
        { status: 'error', error: 'Invalid startDate / endDate', code: 'INVALID_DATE_RANGE' },
        { status: 400 },
      )
    }

    const useAdmin = !!supabaseAdmin
    if (!useAdmin && (!SUPABASE_URL || !SUPABASE_KEY)) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'Календарь недоступен: не настроено подключение к базе данных.',
          code: 'CALENDAR_DISABLED',
        },
        { status: 503 },
      )
    }

    try {
      let listings = []

      if (useAdmin) {
        const { data: listingsData, error: listingsErr } = await supabaseAdmin
          .from('listings')
          .select(
            'id,title,district,cover_image,base_price_thb,commission_rate,status,category_id,owner_id,metadata,categories(id,name,slug,icon)',
          )
          .eq('owner_id', userId)
        if (listingsErr) throw listingsErr
        listings = listingsData || []
      } else {
        const listingsRes = await fetch(
          `${SUPABASE_URL}/rest/v1/listings?owner_id=eq.${userId}&select=id,title,district,cover_image,base_price_thb,commission_rate,status,category_id,owner_id,metadata,categories(id,name,slug,icon)`,
          { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
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
            { status: 404 },
          )
        }
      }

      if (!listings.length) {
        return NextResponse.json({
          status: 'success',
          data: { dates: [], listings: [], summary: { totalListings: 0, totalBookings: 0, totalBlocks: 0 } },
          meta: { partnerId: userId, startDate, endDate, calendarSsot: 'CalendarService', hasSeasonalPrices: false },
        })
      }

      const promoRows = await loadActivePromoRows(useAdmin)
      const defaultListingCommission = await resolveDefaultCommissionPercent()

      const listingsPayload = []
      let hasSeasonalPrices = false

      for (const listing of listings) {
        const rawCat = listing.categories
        const cat = Array.isArray(rawCat) ? rawCat[0] : rawCat
        const categorySlug = cat?.slug ? String(cat.slug).toLowerCase() : null

        const listingUi = {
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
        }

        const cal = await CalendarService.getCalendarForDateRange(String(listing.id), startDate, endDate, {
          marketingPromoRows: promoRows,
        })

        if (!cal.success) {
          return NextResponse.json(
            { status: 'error', error: cal.error || 'Calendar build failed', code: cal.code || 'CALENDAR_BUILD' },
            { status: 400 },
          )
        }

        if (!hasSeasonalPrices && Array.isArray(cal.data?.calendar)) {
          hasSeasonalPrices = cal.data.calendar.some(
            (d) => d.season && String(d.season).trim() && String(d.season).trim() !== 'Base',
          )
        }

        const row = CalendarService.mapPartnerCalendarGridRow(listingUi, cal.data)
        if (row) listingsPayload.push(row)
      }

      const dates = ymdRangeInclusive(startDate, endDate)
      const calendarData = {
        dates,
        listings: listingsPayload,
        summary: {
          totalListings: listings.length,
          totalBookings: listingsPayload.reduce((s, x) => s + (x.bookingsCount || 0), 0),
          totalBlocks: listingsPayload.reduce((s, x) => s + (x.blocksCount || 0), 0),
        },
      }

      return NextResponse.json({
        status: 'success',
        data: calendarData,
        meta: {
          partnerId: userId,
          startDate,
          endDate,
          hasSeasonalPrices,
          calendarSsot: 'CalendarService.getCalendarForDateRange',
        },
      })
    } catch (error) {
      console.error('[CALENDAR API] Supabase error:', error)
      return NextResponse.json(
        {
          status: 'error',
          error: error?.message || 'Не удалось загрузить календарь из базы данных.',
          code: 'CALENDAR_DB_ERROR',
        },
        { status: 503 },
      )
    }
  } catch (error) {
    console.error('[CALENDAR API ERROR]', error)
    return NextResponse.json(
      {
        status: 'error',
        error: error.message,
      },
      { status: 500 },
    )
  }
}
