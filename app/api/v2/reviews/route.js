/**
 * GoStayLo - Reviews API
 * GET /api/v2/reviews?listing_id=xxx - Get reviews for a listing
 * POST /api/v2/reviews - Create review (session cookie required; userId never from client body)
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getUserIdFromSession } from '@/lib/services/session-service';
import {
  formatPrivacyDisplayName,
  formatReviewerInitial,
} from '@/lib/utils/name-formatter';

export const dynamic = 'force-dynamic';

const MAX_REVIEW_PHOTOS = 5;

function normalizeReviewPhotoUrl(u) {
  const s = typeof u === 'string' ? u.trim() : '';
  if (!s) return null;
  if (s.startsWith('/_storage/review-images/')) return s;
  if (s.includes('/review-images/')) return s;
  return null;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get('listing_id');
    const partnerId = searchParams.get('partner_id');
    const reviewerUserId = searchParams.get('reviewer_id');

    let query = supabaseAdmin
      .from('reviews')
      .select(`
        *,
        profiles:user_id (first_name, last_name, is_verified),
        bookings:booking_id (id, check_in, check_out)
      `)
      .order('created_at', { ascending: false });

    if (listingId) {
      query = query.eq('listing_id', listingId);
    }
    
    if (partnerId) {
      const { data: listings } = await supabaseAdmin
        .from('listings')
        .select('id')
        .eq('owner_id', partnerId);

      if (!listings?.length) {
        return NextResponse.json({
          success: true,
          data: {
            reviews: [],
            stats: { total: 0, averageRating: 0 },
          },
        });
      }

      const listingIds = listings.map((l) => l.id);
      query = query.in('listing_id', listingIds);
    }

    if (reviewerUserId) {
      query = query.eq('user_id', reviewerUserId);
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
      // Multi-category ratings
      ratings: {
        cleanliness: review.rating_cleanliness,
        accuracy: review.rating_accuracy,
        communication: review.rating_communication,
        location: review.rating_location,
        value: review.rating_value
      },
      comment: review.comment,
      reviewerName: formatPrivacyDisplayName(review.profiles?.first_name, review.profiles?.last_name),
      reviewerInitial: formatReviewerInitial(review.profiles?.first_name),
      photos: Array.isArray(review.photos) ? review.photos : [],
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
    const sessionUserId = await getUserIdFromSession();
    if (!sessionUserId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      listingId,
      bookingId,
      rating,
      comment,
      ratings = null,
      photos: photosRaw = null,
    } = body;

    if (!listingId) {
      return NextResponse.json({
        success: false,
        error: 'listingId is required',
      }, { status: 400 });
    }

    if (!bookingId || !String(bookingId).trim()) {
      return NextResponse.json({
        success: false,
        error: 'bookingId is required'
      }, { status: 400 });
    }

    // Validate ratings - either single rating OR all 5 categories
    let ratingData = {};
    
    if (ratings && ratings.cleanliness) {
      // Multi-category rating (new system)
      const categories = ['cleanliness', 'accuracy', 'communication', 'location', 'value'];
      
      // Validate all categories present
      for (const cat of categories) {
        if (!ratings[cat] || ratings[cat] < 1 || ratings[cat] > 5) {
          return NextResponse.json({ 
            success: false, 
            error: `Invalid ${cat} rating. All category ratings must be between 1 and 5` 
          }, { status: 400 });
        }
      }
      
      ratingData = {
        rating_cleanliness: parseInt(ratings.cleanliness),
        rating_accuracy: parseInt(ratings.accuracy),
        rating_communication: parseInt(ratings.communication),
        rating_location: parseInt(ratings.location),
        rating_value: parseInt(ratings.value),
        // rating will be auto-calculated by trigger
      };
    } else if (rating) {
      // Legacy single rating
      if (rating < 1 || rating > 5) {
        return NextResponse.json({ 
          success: false, 
          error: 'Rating must be between 1 and 5' 
        }, { status: 400 });
      }
      ratingData = { rating: parseInt(rating) };
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Either rating or ratings object is required' 
      }, { status: 400 });
    }

    const trimmedBookingId = String(bookingId).trim();
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, status, renter_id, listing_id')
      .eq('id', trimmedBookingId)
      .single();
    
    if (bookingError || !booking) {
      return NextResponse.json({ 
        success: false, 
        error: 'Booking not found' 
      }, { status: 404 });
    }

    // Only COMPLETED bookings may be reviewed
    if (booking.status !== 'COMPLETED') {
      return NextResponse.json({ 
        success: false, 
        error: 'You can only leave a review after the stay is completed' 
      }, { status: 403 });
    }

    if (booking.renter_id !== sessionUserId) {
      return NextResponse.json({ 
        success: false, 
        error: 'You can only review your own bookings' 
      }, { status: 403 });
    }

    if (booking.listing_id !== listingId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Booking does not match listing' 
      }, { status: 400 });
    }

    const { data: existingReview } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('booking_id', trimmedBookingId)
      .maybeSingle();
    
    if (existingReview) {
      return NextResponse.json({ 
        success: false, 
        error: 'You have already reviewed this booking' 
      }, { status: 400 });
    }

    let photos = [];
    if (photosRaw != null) {
      if (!Array.isArray(photosRaw)) {
        return NextResponse.json(
          { success: false, error: 'photos must be an array of URLs' },
          { status: 400 }
        );
      }
      const seen = new Set();
      for (const item of photosRaw) {
        const url = normalizeReviewPhotoUrl(item);
        if (!url) {
          return NextResponse.json(
            { success: false, error: 'Invalid review photo URL' },
            { status: 400 }
          );
        }
        if (seen.has(url)) continue;
        seen.add(url);
        photos.push(url);
        if (photos.length > MAX_REVIEW_PHOTOS) {
          return NextResponse.json(
            { success: false, error: `At most ${MAX_REVIEW_PHOTOS} photos allowed` },
            { status: 400 }
          );
        }
      }
    }

    // Create review
    const reviewId = `review-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const { data: review, error } = await supabaseAdmin
      .from('reviews')
      .insert({
        id: reviewId,
        user_id: sessionUserId,
        listing_id: listingId,
        booking_id: trimmedBookingId,
        ...ratingData,
        comment: comment?.trim() || null,
        photos: photos.length ? photos : [],
        is_verified: true,
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
