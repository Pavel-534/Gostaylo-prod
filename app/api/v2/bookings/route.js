/**
 * GoStayLo - Bookings API (v2)
 * GET /api/v2/bookings - List bookings
 * POST /api/v2/bookings - Create booking
 * 
 * SECURITY: Server-side double-booking prevention using CalendarService
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { BookingService } from '@/lib/services/booking.service';
import { CalendarService } from '@/lib/services/calendar.service';
import { NotificationService, NotificationEvents } from '@/lib/services/notification.service';
import { supabaseAdmin } from '@/lib/supabase';
import { rateLimitCheck } from '@/lib/rate-limit';
import { createBookingSchema } from '@/lib/validations/booking';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';
import { resolveBookingListScope } from '@/lib/api/api-guard';
import { toUnifiedOrder } from '@/lib/models/unified-order';
import { ReputationService } from '@/lib/services/reputation.service';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = await resolveBookingListScope(searchParams);
    if (!scope.ok) return scope.response;
    
    const result = await BookingService.getBookings(scope.filters);
    
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
    
    const partnerIds = [...new Set(result.bookings.map((b) => b.partner_id).filter(Boolean))];
    const trustByPartner =
      partnerIds.length > 0 ? await ReputationService.getPartnersTrustPublicBatch(partnerIds) : new Map();

    const unifiedBookings = result.bookings.map((booking) => ({
      ...booking,
      unified_order: toUnifiedOrder(booking),
      partner_trust: trustByPartner.get(String(booking.partner_id)) ?? null,
    }));

    return NextResponse.json({ 
      success: true, 
      data: unifiedBookings,
      count: unifiedBookings.length
    });
    
  } catch (error) {
    console.error('[BOOKINGS GET ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const rl = rateLimitCheck(request, 'booking');
  if (rl) {
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers });
  }

  try {
    const body = await request.json();
    
    const parseResult = createBookingSchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      const message = firstError?.message || 'Invalid request data';
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
    
    const {
      listingId,
      renterId,
      checkIn,
      checkOut,
      guestName,
      guestPhone,
      guestEmail,
      specialRequests,
      currency,
      promoCode,
      guestsCount,
      privateTrip,
      negotiationRequest,
      clientQuotedSubtotalThb,
      clientQuotedGuestTotalThb,
    } = parseResult.data;

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

    const { data: listingData } = await supabaseAdmin
      .from('listings')
      .select('min_booking_days, max_booking_days, title, max_capacity, metadata, category_id')
      .eq('id', listingId)
      .single();

    let listingCategorySlug = '';
    if (listingData?.category_id) {
      const { data: catRow } = await supabaseAdmin
        .from('categories')
        .select('slug')
        .eq('id', listingData.category_id)
        .maybeSingle();
      listingCategorySlug = String(catRow?.slug || '').toLowerCase();
    }

    const isTourListing = listingCategorySlug === 'tours';
    const isVehicleListing = listingCategorySlug === 'vehicles';

    if (isTourListing) {
      const meta =
        listingData?.metadata && typeof listingData.metadata === 'object' && !Array.isArray(listingData.metadata)
          ? listingData.metadata
          : {};
      let groupMin = parseInt(meta.group_size_min, 10);
      if (!Number.isFinite(groupMin) || groupMin < 1) groupMin = 1;
      let groupMax = parseInt(meta.group_size_max, 10);
      const maxCap = Math.max(0, parseInt(listingData?.max_capacity, 10) || 0);
      if (!Number.isFinite(groupMax) || groupMax < 1) {
        groupMax = maxCap > 0 ? maxCap : 999;
      }
      groupMax = Math.max(groupMin, groupMax);
      if (maxCap > 0) {
        groupMax = Math.min(groupMax, maxCap);
      }

      if (guestsCount < groupMin) {
        return NextResponse.json(
          {
            success: false,
            error: `This tour requires at least ${groupMin} guest(s). You selected ${guestsCount}.`,
            code: 'TOUR_GROUP_MIN_VIOLATION',
            group_size_min: groupMin,
            guestsCount,
          },
          { status: 400 },
        );
      }
      if (guestsCount > groupMax) {
        return NextResponse.json(
          {
            success: false,
            error: `This tour allows at most ${groupMax} guest(s) per booking. You selected ${guestsCount}.`,
            code: 'TOUR_GROUP_MAX_VIOLATION',
            group_size_max: groupMax,
            guestsCount,
          },
          { status: 400 },
        );
      }
    } else {
      const minStay = listingData?.min_booking_days || 1;

      if (nights < minStay) {
        return NextResponse.json({
          success: false,
          error: `Minimum stay for this property is ${minStay} night${minStay > 1 ? 's' : ''}. You selected ${nights} night${nights > 1 ? 's' : ''}.`,
          code: 'MIN_STAY_VIOLATION',
          minStay,
          selectedNights: nights,
        }, { status: 400 });
      }
    }

    const availabilityCheck = await CalendarService.checkAvailability(listingId, checkIn, checkOut, {
      guestsCount: isVehicleListing ? 1 : guestsCount,
      listingCategorySlugOverride: isVehicleListing ? 'vehicles' : undefined,
    });

    if (!availabilityCheck.success) {
      const isBadRange = availabilityCheck.error === 'INVALID_DATE_RANGE';
      return NextResponse.json(
        {
          success: false,
          error: isBadRange ? 'Invalid check-in / check-out dates' : 'Failed to check availability',
          code: isBadRange ? 'INVALID_DATE_RANGE' : undefined,
        },
        { status: isBadRange ? 400 : 500 }
      );
    }

    const minRem = availabilityCheck.min_remaining_spots ?? 0;
    const needsInquiry =
      privateTrip === true ||
      negotiationRequest === true ||
      (!isVehicleListing && guestsCount > minRem);

    if (needsInquiry) {
      const result = await BookingService.createInquiryBooking({
        listingId,
        renterId,
        checkIn,
        checkOut,
        guestName,
        guestPhone,
        guestEmail,
        specialRequests,
        currency,
        promoCode,
        guestsCount,
        privateTrip: privateTrip === true,
        negotiationRequest: negotiationRequest === true,
        minRemainingSpots: minRem,
        clientQuotedSubtotalThb,
        clientQuotedGuestTotalThb,
      });

      if (result.error) {
        return NextResponse.json(
          { success: false, error: result.error, code: result.code },
          { status: 400 },
        );
      }

      await NotificationService.dispatch(NotificationEvents.NEW_BOOKING_REQUEST, {
        booking: { ...result.booking },
        partner: result.partner ?? null,
        listing: {
          title: result.booking.listing?.title ?? null,
          district: result.booking.listing?.district ?? null,
          category_slug: result.booking.listing?.category_slug ?? null,
        },
      });

      return NextResponse.json({
        success: true,
        inquiry: true,
        booking: result.booking,
        conversationId: result.conversationId ?? null,
        code: 'INQUIRY_CREATED',
      });
    }

    if (!availabilityCheck.available) {
      console.log(`[BOOKING CONFLICT] ${listingId}: ${checkIn} to ${checkOut}`, availabilityCheck.conflicts);
      return NextResponse.json(
        {
          success: false,
          error:
            'Sorry, these dates were JUST taken by another user. Please select different dates.',
          code: 'DATES_CONFLICT',
          conflicts: availabilityCheck.conflicts,
        },
        { status: 409 }
      );
    }

    const rawMaxCap = parseInt(listingData?.max_capacity, 10);
    if (isTourListing) {
      if (Number.isFinite(rawMaxCap) && rawMaxCap > 0 && guestsCount > rawMaxCap) {
        return NextResponse.json(
          {
            success: false,
            error: `This listing allows at most ${rawMaxCap} guest(s) per booking.`,
            code: 'GUESTS_EXCEED_CAPACITY',
            max_capacity: rawMaxCap,
          },
          { status: 400 },
        );
      }
    } else if (!isVehicleListing) {
      const maxCap = Math.max(1, Number.isFinite(rawMaxCap) && rawMaxCap > 0 ? rawMaxCap : 1);
      if (guestsCount > maxCap) {
        return NextResponse.json(
          {
            success: false,
            error: `This listing allows at most ${maxCap} guest(s) per booking.`,
            code: 'GUESTS_EXCEED_CAPACITY',
            max_capacity: maxCap,
          },
          { status: 400 },
        );
      }
    }

    const result = await BookingService.createBooking({
      listingId,
      renterId,
      checkIn,
      checkOut,
      guestName,
      guestPhone,
      guestEmail,
      specialRequests,
      currency,
      promoCode,
      guestsCount,
      clientQuotedSubtotalThb,
      clientQuotedGuestTotalThb,
    });

    if (result.error) {
      const conflict = result.code === 'DATES_CONFLICT';
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          code: result.code,
          conflicts: result.conflictingBookings,
        },
        { status: conflict ? 409 : 400 },
      );
    }

    // Emails + Telegram (guest, partner, admin topic) — всегда после успешного create;
    // данные партнёра уже загружены в BookingService (owner:profiles!owner_id).
    await NotificationService.dispatch(NotificationEvents.NEW_BOOKING_REQUEST, {
      booking: { ...result.booking },
      partner: result.partner ?? null,
      listing: {
        title: result.booking.listing?.title ?? null,
        district: result.booking.listing?.district ?? null,
        category_slug: result.booking.listing?.category_slug ?? null,
      },
    });
    
    console.log(`[BOOKING] New booking created: ${result.booking.id} for listing ${listingId}`);
    
    return NextResponse.json({
      success: true,
      booking: result.booking,
      /** Linked chat thread (see BookingService.ensureBookingConversation) */
      conversationId: result.conversationId ?? null,
    });
    
  } catch (error) {
    console.error('[BOOKINGS POST ERROR]', error);
    void notifySystemAlert(
      `🧾 <b>Критическая ошибка POST /api/v2/bookings</b>\n<code>${escapeSystemAlertHtml(error?.message || error)}</code>`,
    )
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
