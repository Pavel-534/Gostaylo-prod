/**
 * Partner Calendar API (v2)
 *
 * Stage 200.53.3 — bulk raw load (3 DB queries for N listings) + in-memory `buildCalendar`
 * (same SSOT as guest/public). Response DTO unchanged.
 *
 * Guest/public single-listing calendar keeps its existing per-listing path — not this route.
 */

import { NextResponse } from 'next/server'
import { addDays, format } from 'date-fns'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { toPublicImageUrl } from '@/lib/public-image-url'
import { mapCategorySlugToListingType } from '@/lib/partner-calendar-filters'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'
import { addListingDays, toListingDate } from '@/lib/listing-date'
import { resolveListingTimeZoneFromMetadata } from '@/lib/geo/listing-timezone-ssot'
import { CalendarService } from '@/lib/services/calendar.service'
import { loadPartnerCalendarRaw } from '@/lib/services/calendar/partner-calendar-bulk-load.js'
import { promoIsActiveAt } from '@/lib/promo/promo-engine'
import { mapListingPriceFieldsForApi } from '@/lib/listing/listing-base-price-canon'
import { filterOutSoftDeletedListings } from '@/lib/listing/listing-soft-delete.js'
import { runWithConcurrency } from '@/lib/partner/run-with-concurrency.js'

export const dynamic = 'force-dynamic'
/** Partner calendar can span many listings × month/90d — avoid platform kill mid-build. */
export const maxDuration = 60

/** CPU-only parallel assemble (no DB inside workers). */
const PARTNER_CALENDAR_BUILD_CONCURRENCY = 5

const YMD = /^\d{4}-\d{2}-\d{2}$/
const MAX_RANGE_DAYS = 400

function ymdRangeInclusive(startYmd, endYmd) {
  const dates = []
  let cur = startYmd
  while (cur <= endYmd) {
    dates.push(cur)
    cur = addListingDays(cur, 1)
  }
  return dates
}

function assertRangeWithinLimit(startYmd, endYmd) {
  const rs = toListingDate(startYmd)
  const re = toListingDate(endYmd)
  if (!rs || !re || rs > re) {
    return { ok: false, code: 'INVALID_DATE_RANGE' }
  }
  let span = 0
  let cur = rs
  while (cur <= re) {
    span += 1
    if (span > MAX_RANGE_DAYS) {
      return { ok: false, code: 'RANGE_TOO_LARGE', maxDays: MAX_RANGE_DAYS }
    }
    cur = addListingDays(cur, 1)
  }
  return { ok: true, rs, re }
}

async function loadActivePromoRows() {
  if (!supabaseAdmin) return []
  const { data: promosData } = await supabaseAdmin
    .from('promo_codes')
    .select(
      'code,promo_type,value,is_active,valid_until,max_uses,current_uses,created_by_type,partner_id,allowed_listing_ids,is_flash_sale',
    )
    .eq('is_active', true)
  const nowMs = Date.now()
  return (promosData || []).filter((row) => promoIsActiveAt(row, nowMs).ok)
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

    const rangeCheck = assertRangeWithinLimit(startDate, endDate)
    if (!rangeCheck.ok) {
      return NextResponse.json(
        {
          status: 'error',
          error:
            rangeCheck.code === 'RANGE_TOO_LARGE'
              ? `Date range too large (max ${rangeCheck.maxDays} days)`
              : 'Invalid startDate / endDate',
          code: rangeCheck.code,
          maxDays: rangeCheck.maxDays,
        },
        { status: 400 },
      )
    }

    if (!supabaseAdmin) {
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

      const { data: listingsData, error: listingsErr } = await supabaseAdmin
        .from('listings')
        .select(
          'id,title,district,cover_image,base_price_thb,base_currency,commission_rate,status,category_id,owner_id,metadata,min_booking_days,max_booking_days,max_capacity,categories(id,name,slug,icon)',
        )
        .eq('owner_id', userId)
      if (listingsErr) throw listingsErr
      listings = filterOutSoftDeletedListings(listingsData)

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
          meta: {
            partnerId: userId,
            startDate,
            endDate,
            calendarSsot: 'buildCalendar',
            calendarLoad: 'partner-calendar-bulk',
            hasSeasonalPrices: false,
          },
        })
      }

      const promoRows = await loadActivePromoRows()
      const defaultListingCommission = await resolveDefaultCommissionPercent()

      const listingIds = listings.map((l) => String(l.id))
      const raw = await loadPartnerCalendarRaw({
        listingIds,
        rangeStart: startDate,
        rangeEnd: endDate,
        includePartnerGridFields: true,
        supabase: supabaseAdmin,
      })

      const buildResults = await runWithConcurrency({
        items: listings,
        concurrency: PARTNER_CALENDAR_BUILD_CONCURRENCY,
        worker: async (listing) => {
          const id = String(listing.id)
          const rawCat = listing.categories
          const cat = Array.isArray(rawCat) ? rawCat[0] : rawCat
          const categorySlug = cat?.slug ? String(cat.slug).toLowerCase() : null

          const priceFields = mapListingPriceFieldsForApi(listing)
          const listingUi = {
            id: listing.id,
            title: listing.title,
            district: listing.district,
            coverImage: listing.cover_image ? toPublicImageUrl(listing.cover_image) : null,
            basePriceThb: priceFields.basePriceThb,
            baseCurrency: priceFields.baseCurrency,
            basePriceAsset: priceFields.basePriceAsset,
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

          const bookings = raw.bookingsByListingId.get(id) || []
          const blocks = raw.blocksByListingId.get(id) || []
          const seasonalPrices = raw.seasonalByListingId.get(id) || []
          const listingTimeZone = resolveListingTimeZoneFromMetadata(listing.metadata)

          const calendar = CalendarService.buildCalendar({
            rangeStart: startDate,
            rangeEnd: endDate,
            listing,
            listingTimeZone,
            bookings,
            blocks,
            seasonalPrices,
            metadataSeasonalPricing: listing.metadata?.seasonal_pricing || [],
            excludeBookingId: null,
            requestedGuests: 1,
            listingCategorySlug: categorySlug || '',
            marketingPromos: promoRows || [],
            partnerUi: true,
          })

          const calInner = {
            calendar,
            listingTimeZone,
            bookings,
            blocks,
          }

          const hasSeasonal = Array.isArray(calendar)
            ? calendar.some(
                (d) => d.season && String(d.season).trim() && String(d.season).trim() !== 'Base',
              )
            : false

          return {
            row: CalendarService.mapPartnerCalendarGridRow(listingUi, calInner),
            hasSeasonal,
          }
        },
      })

      const failed = buildResults.find((r) => !r.ok)
      if (failed) {
        const err = failed.error
        return NextResponse.json(
          {
            status: 'error',
            error: err?.message || 'Calendar build failed',
            code: err?.code || 'CALENDAR_BUILD',
          },
          { status: err?.httpStatus || 400 },
        )
      }

      const listingsPayload = []
      let hasSeasonalPrices = false
      for (const r of buildResults) {
        if (r.value?.hasSeasonal) hasSeasonalPrices = true
        if (r.value?.row) listingsPayload.push(r.value.row)
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
          calendarSsot: 'buildCalendar',
          calendarLoad: 'partner-calendar-bulk',
        },
      })
    } catch (error) {
      console.error('[CALENDAR API] Supabase error:', error)
      const code = error?.code || 'CALENDAR_DB_ERROR'
      const status = code === 'INVALID_DATE_RANGE' || code === 'RANGE_TOO_LARGE' ? 400 : 503
      return NextResponse.json(
        {
          status: 'error',
          error: error?.message || 'Не удалось загрузить календарь из базы данных.',
          code,
        },
        { status },
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
