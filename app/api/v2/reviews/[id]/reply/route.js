/**
 * GoStayLo - Partner Review Reply API
 * PUT /api/v2/reviews/[id]/reply — ответ владельца; partner ID только из сессии (не из JSON).
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getUserIdFromSession } from '@/lib/services/session-service';

export const dynamic = 'force-dynamic';

export async function PUT(request, { params }) {
  try {
    const sessionUserId = await getUserIdFromSession();
    if (!sessionUserId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { reply } = body;

    if (!id || !reply || !String(reply).trim()) {
      return NextResponse.json({
        success: false,
        error: 'Review ID and reply text are required',
      }, { status: 400 });
    }

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
        error: 'Review not found',
      }, { status: 404 });
    }

    if (review.listings?.owner_id !== sessionUserId) {
      return NextResponse.json({
        success: false,
        error: 'You can only reply to reviews on your own listings',
      }, { status: 403 });
    }

    // One reply per review only (no threads / back-and-forth)
    if (review.partner_reply) {
      return NextResponse.json({
        success: false,
        error: 'You have already replied to this review',
      }, { status: 400 });
    }

    const { data: updatedReview, error } = await supabaseAdmin
      .from('reviews')
      .update({
        partner_reply: String(reply).trim(),
        partner_reply_at: new Date().toISOString(),
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
      data: updatedReview,
    });
  } catch (error) {
    console.error('[REVIEW REPLY ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
