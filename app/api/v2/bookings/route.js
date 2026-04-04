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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters = {
      renterId: searchParams.get('renterId'),
      partnerId: searchParams.get('partnerId'),
      listingId: searchParams.get('listingId'),
      status: searchParams.get('status'),
      limit: parseInt(searchParams.get('limit')) || 50
    };
    
    const result = await BookingService.getBookings(filters);
    
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      data: result.bookings,
      count: result.bookings.length
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
    } = parseResult.data;

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

    const { data: listingData } = await supabaseAdmin
      .from('listings')
      .select('min_booking_days, title, max_capacity')
      .eq('id', listingId)
      .single();

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

    const availabilityCheck = await CalendarService.checkAvailability(listingId, checkIn, checkOut, {
      guestsCount,
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
      guestsCount > minRem;

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
      });

      if (result.error) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }

      await NotificationService.dispatch(NotificationEvents.NEW_BOOKING_REQUEST, {
        booking: { ...result.booking },
        partner: result.partner ?? null,
        listing: {
          title: result.booking.listing?.title ?? null,
          district: result.booking.listing?.district ?? null,
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

    const maxCap = Math.max(1, parseInt(listingData?.max_capacity, 10) || 1);
    if (guestsCount > maxCap) {
      return NextResponse.json(
        {
          success: false,
          error: `This listing allows at most ${maxCap} guest(s) per booking.`,
          code: 'GUESTS_EXCEED_CAPACITY',
          max_capacity: maxCap,
        },
        { status: 400 }
      );
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
    });

    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    // Emails + Telegram (guest, partner, admin topic) — всегда после успешного create;
    // данные партнёра уже загружены в BookingService (owner:profiles!owner_id).
    await NotificationService.dispatch(NotificationEvents.NEW_BOOKING_REQUEST, {
      booking: { ...result.booking },
      partner: result.partner ?? null,
      listing: {
        title: result.booking.listing?.title ?? null,
        district: result.booking.listing?.district ?? null,
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
