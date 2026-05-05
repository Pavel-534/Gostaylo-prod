/**
 * Archived from: app/api/v2/bookings/[id]/payment-status/route.js
 * Reason: P3 legacy candidate (mock payment payload + service-role fetch path).
 * Date: 2026-05-05
 */

import { NextResponse } from 'next/server';
import { toPublicImageUrl } from '@/lib/public-image-url';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request, { params }) {
  const bookingId = params.id;

  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'Booking ID required' }, { status: 400 });
  }

  try {
    const bookingRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}&select=*`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    const bookings = await bookingRes.json();
    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    const booking = bookings[0];
    const listingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=eq.${booking.listing_id}&select=id,title,district,images,cover_image,base_price_thb`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      },
    );

    const listings = await listingRes.json();
    const listing = listings?.[0] || null;

    const bookingData = {
      id: booking.id,
      status: booking.status,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      priceThb: parseFloat(booking.price_thb),
      currency: booking.currency || 'THB',
      guestName: booking.guest_name,
      guestEmail: booking.guest_email,
      guestPhone: booking.guest_phone,
      specialRequests: booking.special_requests,
      createdAt: booking.created_at,
      metadata: booking.metadata,
    };

    const payment =
      booking.status === 'CONFIRMED'
        ? {
            id: `pay-${booking.id}`,
            status: 'COMPLETED',
            method: 'CARD',
            amount: booking.price_thb,
          }
        : null;

    return NextResponse.json({
      success: true,
      data: {
        booking: bookingData,
        listing: listing
          ? {
              id: listing.id,
              title: listing.title,
              district: listing.district,
              coverImage: toPublicImageUrl(listing.cover_image || listing.images?.[0]),
              basePriceThb: parseFloat(listing.base_price_thb),
            }
          : null,
        payment,
      },
    });
  } catch (error) {
    console.error('[PAYMENT-STATUS ERROR]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch booking' }, { status: 500 });
  }
}
