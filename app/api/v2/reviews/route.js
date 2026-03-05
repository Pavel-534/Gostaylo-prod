/**
 * Gostaylo - Reviews API
 * GET /api/v2/reviews?listing_id=xxx - Get reviews for a listing
 * POST /api/v2/reviews - Create a new review (requires CHECKED_IN or COMPLETED booking)
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Format user name: "Pavel S." (First name + Last initial)
function formatReviewerName(firstName, lastName) {
  if (!firstName) return 'Guest';
  if (!lastName) return firstName;
  return `${firstName} ${lastName[0]}.`;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get('listing_id');
    const partnerId = searchParams.get('partner_id');

    let query = supabaseAdmin
      .from('reviews')
      .select(`
        *,
        profiles:user_id (first_name, last_name, email),
        bookings:booking_id (id, check_in, check_out)
      `)
      .order('created_at', { ascending: false });

    if (listingId) {
      query = query.eq('listing_id', listingId);
    }
    
    if (partnerId) {
      // Get all listings for this partner first
      const { data: listings } = await supabaseAdmin
        .from('listings')
        .select('id')
        .eq('owner_id', partnerId);
      
      if (listings?.length) {
        const listingIds = listings.map(l => l.id);
        query = query.in('listing_id', listingIds);
      }
    }

    const { data: reviews, error } = await query;
    
    // Handle table not existing
    if (error?.code === 'PGRST205' || error?.message?.includes('reviews')) {
      console.log('[REVIEWS] Table does not exist yet, returning empty');
      return NextResponse.json({ 
        success: true, 
        data: {
          reviews: [],
          stats: { total: 0, averageRating: 0 },
          tableExists: false,
          setupInstructions: 'Run SQL from /app/database/reviews_table.sql in Supabase Dashboard'
        }
      });
    }
    
    if (error) {
      console.error('[REVIEWS GET ERROR]', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Transform for frontend
    const formattedReviews = reviews?.map(review => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      reviewerName: formatReviewerName(review.profiles?.first_name, review.profiles?.last_name),
      reviewerInitial: review.profiles?.first_name?.[0]?.toUpperCase() || 'G',
      createdAt: review.created_at,
      partnerReply: review.partner_reply,
      partnerReplyAt: review.partner_reply_at,
      isVerifiedBooking: !!review.booking_id,
      bookingDates: review.bookings ? {
        checkIn: review.bookings.check_in,
        checkOut: review.bookings.check_out
      } : null,
      listingId: review.listing_id
    })) || [];

    // Calculate stats
    const totalReviews = formattedReviews.length;
    const avgRating = totalReviews > 0 
      ? formattedReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
      : 0;

    return NextResponse.json({ 
      success: true, 
      data: {
        reviews: formattedReviews,
        stats: {
          total: totalReviews,
          averageRating: Math.round(avgRating * 10) / 10
        }
      }
    });
    
  } catch (error) {
    console.error('[REVIEWS GET ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, listingId, bookingId, rating, comment } = body;

    if (!userId || !listingId || !rating) {
      return NextResponse.json({ 
        success: false, 
        error: 'userId, listingId, and rating are required' 
      }, { status: 400 });
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ 
        success: false, 
        error: 'Rating must be between 1 and 5' 
      }, { status: 400 });
    }

    // If bookingId provided, verify it exists and has correct status
    if (bookingId) {
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .select('id, status, renter_id, listing_id')
        .eq('id', bookingId)
        .single();
      
      if (bookingError || !booking) {
        return NextResponse.json({ 
          success: false, 
          error: 'Booking not found' 
        }, { status: 404 });
      }

      // Check booking status - only CHECKED_IN or COMPLETED can leave reviews
      if (!['CHECKED_IN', 'COMPLETED'].includes(booking.status)) {
        return NextResponse.json({ 
          success: false, 
          error: 'You can only leave a review after check-in or completion' 
        }, { status: 403 });
      }

      // Check that the user is the renter
      if (booking.renter_id !== userId) {
        return NextResponse.json({ 
          success: false, 
          error: 'You can only review your own bookings' 
        }, { status: 403 });
      }

      // Check listing matches
      if (booking.listing_id !== listingId) {
        return NextResponse.json({ 
          success: false, 
          error: 'Booking does not match listing' 
        }, { status: 400 });
      }

      // Check if user already reviewed this booking
      const { data: existingReview } = await supabaseAdmin
        .from('reviews')
        .select('id')
        .eq('booking_id', bookingId)
        .single();
      
      if (existingReview) {
        return NextResponse.json({ 
          success: false, 
          error: 'You have already reviewed this booking' 
        }, { status: 400 });
      }
    }

    // Create review
    const reviewId = `review-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const { data: review, error } = await supabaseAdmin
      .from('reviews')
      .insert({
        id: reviewId,
        user_id: userId,
        listing_id: listingId,
        booking_id: bookingId || null,
        rating: parseInt(rating),
        comment: comment?.trim() || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('[REVIEWS POST ERROR]', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: review 
    });
    
  } catch (error) {
    console.error('[REVIEWS POST ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
