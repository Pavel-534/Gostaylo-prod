/**
 * GoStayLo - Manual Booking API
 * 
 * POST /api/v2/partner/calendar/manual-booking - Create manual booking (offline sales)
 * 
 * @security Validates owner_id before any operation
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { v4 as uuidv4 } from 'uuid'
import { differenceInDays, parseISO } from 'date-fns'
import { CalendarService } from '@/lib/services/calendar.service'
import { PricingService } from '@/lib/services/pricing.service'
import { computeRoundedGuestTotalPot } from '@/lib/booking-price-integrity'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { normalizeBookingInstantForDb } from '@/lib/listing-date'
import { resolveListingCategorySlug } from '@/lib/services/booking.service'

export const dynamic = 'force-dynamic'

// In-memory store for mock bookings
let mockManualBookings = []

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
    const {
      listingId,
      checkIn,
      checkOut,
      guestName,
      guestPhone,
      guestEmail,
      priceThb,
      notes,
      guestsCount: rawGuests,
      guests_count: rawGuestsSnake,
    } = body
    const guestsCount = Math.max(
      1,
      parseInt(rawGuests ?? rawGuestsSnake ?? 1, 10) || 1
    )
    
    // Validation
    if (!listingId || !checkIn || !checkOut || !guestName) {
      return NextResponse.json({
        status: 'error',
        error: 'listingId, checkIn, checkOut, and guestName are required'
      }, { status: 400 })
    }
    
    const nights = differenceInDays(parseISO(checkOut), parseISO(checkIn))
    if (nights < 1) {
      return NextResponse.json({
        status: 'error',
        error: 'Check-out must be after check-in'
      }, { status: 400 })
    }
    
    console.log(`[MANUAL BOOKING] Creating for listing ${listingId}: ${checkIn} - ${checkOut}`)
    
    // Mock mode
    if (!isSupabaseConfigured() || !supabaseAdmin) {
      const newBooking = {
        id: `bk-manual-${uuidv4().slice(0, 8)}`,
        listingId,
        partnerId: userId,
        checkIn,
        checkOut,
        guestName,
        guestPhone: guestPhone || null,
        guestEmail: guestEmail || null,
        priceThb: parseFloat(priceThb) || 0,
        notes,
        guestsCount,
        status: 'CONFIRMED',
        source: 'MANUAL',
        createdAt: new Date().toISOString()
      }
      mockManualBookings.push(newBooking)
      
      return NextResponse.json({
        status: 'success',
        data: newBooking,
        message: 'Бронирование создано'
      })
    }
    
    // Verify listing ownership
    const { data: listing, error: listingError } = await supabaseAdmin
      .from('listings')
      .select('id, owner_id, base_price_thb, commission_rate, max_capacity, category_id')
      .eq('id', listingId)
      .eq('owner_id', userId)
      .single()
    
    if (listingError || !listing) {
      return NextResponse.json({
        status: 'error',
        error: 'Listing not found or access denied'
      }, { status: 404 })
    }
    
    const listingCategorySlug = await resolveListingCategorySlug(listing?.category_id)
    const isVehicleListing = listingCategorySlug === 'vehicles'

    const maxCap = Math.max(1, parseInt(listing.max_capacity, 10) || 1)
    if (!isVehicleListing && guestsCount > maxCap) {
      return NextResponse.json(
        {
          status: 'error',
          error: `Party size exceeds listing capacity (${maxCap})`,
        },
        { status: 400 }
      )
    }

    const avail = await CalendarService.checkAvailability(listingId, checkIn, checkOut, {
      guestsCount: isVehicleListing ? 1 : guestsCount,
      listingCategorySlugOverride: isVehicleListing ? 'vehicles' : undefined,
    })
    if (!avail.success) {
      return NextResponse.json(
        { status: 'error', error: avail.error || 'Availability check failed' },
        { status: 500 }
      )
    }
    if (!avail.available) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'Недостаточно мест на выбранные даты',
          conflicts: avail.conflicts || [],
        },
        { status: 409 }
      )
    }

    const checkInDb = normalizeBookingInstantForDb(checkIn)
    const checkOutDb = normalizeBookingInstantForDb(checkOut)
    if (!checkInDb || !checkOutDb) {
      return NextResponse.json(
        { status: 'error', error: 'Invalid checkIn or checkOut' },
        { status: 400 },
      )
    }

    const rawSub =
      priceThb != null && priceThb !== '' && Number.isFinite(Number(priceThb))
        ? Number(priceThb)
        : Number(listing.base_price_thb) * nights
    const subtotalThb = Math.max(0, Math.round(rawSub))

    const feeSplit = await PricingService.calculateFeeSplit(subtotalThb, listing.owner_id)
    const roundedPot = computeRoundedGuestTotalPot(feeSplit.guestPayableThb)
    if (!roundedPot) {
      return NextResponse.json(
        { status: 'error', error: 'Could not compute guest payable total' },
        { status: 500 },
      )
    }
    const { roundedGuestTotalThb, roundingDiffPotThb } = roundedPot
    const taxableMarginAmount = Math.max(0, roundedGuestTotalThb - feeSplit.partnerEarningsThb)
    const nowIso = new Date().toISOString()
    const pricingSnapshot = {
      v: 1,
      computed_at: nowIso,
      tax: {
        rate_percent: feeSplit.taxRatePercent ?? 0,
        amount_thb: feeSplit.taxAmountThb ?? 0,
      },
      fee_split_v2: {
        immutable: true,
        guest_service_fee_percent: feeSplit.guestServiceFeePercent,
        guest_service_fee_thb: feeSplit.guestServiceFeeThb,
        host_commission_percent: feeSplit.hostCommissionRate,
        host_commission_thb: feeSplit.hostCommissionThb,
        platform_gross_revenue_thb: feeSplit.platformGrossRevenueThb,
        insurance_fund_percent: feeSplit.insuranceFundPercent,
        insurance_reserve_thb: feeSplit.insuranceReserveThb,
        tax_rate_percent: feeSplit.taxRatePercent ?? 0,
        tax_amount_thb: feeSplit.taxAmountThb ?? 0,
        guest_payable_thb: feeSplit.guestPayableThb,
        guest_payable_rounded_thb: roundedGuestTotalThb,
        rounding_diff_pot_thb: roundingDiffPotThb,
      },
    }

    // Create booking (fee split SSOT: commission_thb = guest service fee; commission_rate = host %)
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        id: `bk-${uuidv4().slice(0, 8)}`,
        listing_id: listingId,
        partner_id: userId,
        check_in: checkInDb,
        check_out: checkOutDb,
        guest_name: guestName,
        guest_phone: guestPhone || null,
        guest_email: guestEmail || null,
        price_thb: subtotalThb,
        currency: 'THB',
        price_paid: subtotalThb,
        exchange_rate: 1,
        commission_rate: feeSplit.hostCommissionRate,
        applied_commission_rate: feeSplit.hostCommissionRate,
        commission_thb: feeSplit.guestServiceFeeThb,
        partner_earnings_thb: feeSplit.partnerEarningsThb,
        rounding_diff_pot: roundingDiffPotThb,
        taxable_margin_amount: taxableMarginAmount,
        net_amount_local: Math.round(feeSplit.partnerEarningsThb * 100) / 100,
        listing_currency: 'THB',
        pricing_snapshot: pricingSnapshot,
        notes,
        guests_count: guestsCount,
        status: 'CONFIRMED',
        source: 'MANUAL',
        confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (bookingError) {
      if (String(bookingError.message || '').includes('VEHICLE_INTERVAL_CONFLICT')) {
        return NextResponse.json(
          {
            status: 'error',
            error: 'Недостаточно мест на выбранные даты',
            conflicts: [{ reason: 'INSUFFICIENT_CAPACITY' }],
          },
          { status: 409 },
        )
      }
      console.error('[MANUAL BOOKING] Error:', bookingError)
      void notifySystemAlert(
        `🧾 <b>Ручное бронирование: ошибка БД</b>\n` +
          `<code>${escapeSystemAlertHtml(bookingError.message)}</code>\n` +
          `partner: <code>${escapeSystemAlertHtml(userId)}</code>`,
      )
      return NextResponse.json({
        status: 'error',
        error: bookingError.message
      }, { status: 500 })
    }
    
    return NextResponse.json({
      status: 'success',
      data: {
        id: booking.id,
        listingId: booking.listing_id,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        guestName: booking.guest_name,
        priceThb: booking.price_thb,
        status: booking.status,
        source: booking.source
      },
      message: 'Бронирование создано'
    })
    
  } catch (error) {
    console.error('[MANUAL BOOKING ERROR]', error)
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 })
  }
}
