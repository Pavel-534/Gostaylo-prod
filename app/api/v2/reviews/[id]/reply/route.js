/**
 * FunnyRent 2.1 - Partner Review Reply API
 * PUT /api/v2/reviews/[id]/reply - Add partner reply to a review
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { partnerId, reply } = body;

    if (!id || !partnerId || !reply) {
      return NextResponse.json({ 
        success: false, 
        error: 'Review ID, partner ID, and reply are required' 
      }, { status: 400 });
    }

    // Get the review and verify the partner owns the listing
    const { data: review, error: reviewError } = await supabaseAdmin
      .from('reviews')
      .select(`
        id, 
        listing_id,
        partner_reply,
        listings:listing_id (owner_id)
      `)
      .eq('id', id)
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ 
        success: false, 
        error: 'Review not found' 
      }, { status: 404 });
    }

    // Check if partner owns the listing
    if (review.listings?.owner_id !== partnerId) {
      return NextResponse.json({ 
        success: false, 
        error: 'You can only reply to reviews on your own listings' 
      }, { status: 403 });
    }

    // Check if already replied
    if (review.partner_reply) {
      return NextResponse.json({ 
        success: false, 
        error: 'You have already replied to this review' 
      }, { status: 400 });
    }

    // Update review with partner reply
    const { data: updatedReview, error } = await supabaseAdmin
      .from('reviews')
      .update({
        partner_reply: reply.trim(),
        partner_reply_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[REVIEW REPLY ERROR]', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: updatedReview 
    });
    
  } catch (error) {
    console.error('[REVIEW REPLY ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
