/**
 * GoStayLo - Calendar Blocks API
 * GET /api/v2/partner/listings/[id]/calendar - Get all blocks for listing
 * POST /api/v2/partner/listings/[id]/calendar - Add manual block
 * DELETE /api/v2/partner/listings/[id]/calendar - Remove block
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/auth/jwt-secret';
import { CalendarService } from '@/lib/services/calendar.service';
import { toListingDate, addListingDays } from '@/lib/listing-date';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function verifyAuth() {
  let secret;
  try {
    secret = getJwtSecret();
  } catch {
    return { misconfigured: true };
  }
  const cookieStore = cookies();
  const session = cookieStore.get('gostaylo_session');
  if (!session?.value) return null;

  try {
    return jwt.verify(session.value, secret);
  } catch {
    return null;
  }
}

/**
 * GET - Get all calendar blocks for a listing
 */
export async function GET(request, { params }) {
  const auth = verifyAuth();
  if (auth?.misconfigured) {
    return NextResponse.json({ success: false, error: 'Server misconfigured: JWT_SECRET is missing' }, { status: 500 });
  }
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  const listingId = params.id;
  const supabase = getSupabase();
  
  // Verify ownership (partner/admin)
  const { data: listing } = await supabase
    .from('listings')
    .select('owner_id')
    .eq('id', listingId)
    .single();
  
  if (!listing) {
    return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
  }
  
  if (listing.owner_id !== auth.userId && auth.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }
  
  // Get all blocks (manual + ical)
  const { data: blocks, error } = await supabase
    .from('calendar_blocks')
    .select('*')
    .eq('listing_id', listingId)
    .order('start_date', { ascending: true });
  
  if (error) {
    console.error('[CALENDAR] Error fetching blocks:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  
  // Transform dates to array format for calendar component
  const blockedDates = [];
  (blocks || []).forEach((block) => {
    const startStr = toListingDate(block.start_date);
    const endStr = toListingDate(block.end_date);
    if (!startStr || !endStr) return;
    let cur = startStr;
    while (cur <= endStr) {
      blockedDates.push(cur);
      cur = addListingDays(cur, 1);
    }
  });
  
  return NextResponse.json({
    success: true,
    blocks: blocks || [],
    blockedDates: [...new Set(blockedDates)], // Remove duplicates
    count: blocks?.length || 0
  });
}

/**
 * POST - Add manual block
 */
export async function POST(request, { params }) {
  const auth = verifyAuth();
  if (auth?.misconfigured) {
    return NextResponse.json({ success: false, error: 'Server misconfigured: JWT_SECRET is missing' }, { status: 500 });
  }
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  const listingId = params.id;
  const supabase = getSupabase();
  
  // Verify ownership
  const { data: listing } = await supabase
    .from('listings')
    .select('owner_id, max_capacity')
    .eq('id', listingId)
    .single();
  
  if (!listing) {
    return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
  }
  
  if (listing.owner_id !== auth.userId && auth.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }
  
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }
  
  const { startDate, endDate, reason, unitsBlocked: rawUnits, units_blocked: rawSnake } = body;
  const maxCap = Math.max(1, parseInt(listing.max_capacity, 10) || 1);
  let unitsBlocked = Math.max(1, parseInt(rawUnits ?? rawSnake ?? 1, 10) || 1);
  if (unitsBlocked > maxCap) {
    return NextResponse.json(
      { success: false, error: `unitsBlocked cannot exceed max_capacity (${maxCap})` },
      { status: 400 }
    );
  }
  
  if (!startDate || !endDate) {
    return NextResponse.json({ success: false, error: 'Start and end dates required' }, { status: 400 });
  }
  
  // Validate dates
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start > end) {
    return NextResponse.json({ success: false, error: 'Start date must be before end date' }, { status: 400 });
  }

  const blockFit = await CalendarService.validateManualBlockFits(
    listingId,
    startDate,
    endDate,
    unitsBlocked
  );
  if (!blockFit.success) {
    return NextResponse.json(
      {
        success: false,
        error: blockFit.error || 'Block does not fit current occupancy',
        conflicts: blockFit.conflicts || null,
      },
      { status: 409 }
    );
  }
  
  // Insert block
  const { data: block, error } = await supabase
    .from('calendar_blocks')
    .insert({
      listing_id: listingId,
      start_date: startDate,
      end_date: endDate,
      reason: reason || 'Ручная блокировка',
      source: 'manual',
      units_blocked: unitsBlocked,
    })
    .select()
    .single();
  
  if (error) {
    console.error('[CALENDAR] Error adding block:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  
  console.log(`[CALENDAR] Block added for listing ${listingId}: ${startDate} - ${endDate}`);
  
  return NextResponse.json({
    success: true,
    block,
    message: 'Даты заблокированы'
  });
}

/**
 * DELETE - Remove a block
 */
export async function DELETE(request, { params }) {
  const auth = verifyAuth();
  if (auth?.misconfigured) {
    return NextResponse.json({ success: false, error: 'Server misconfigured: JWT_SECRET is missing' }, { status: 500 });
  }
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  const listingId = params.id;
  const { searchParams } = new URL(request.url);
  const blockId = searchParams.get('blockId');
  
  if (!blockId) {
    return NextResponse.json({ success: false, error: 'Block ID required' }, { status: 400 });
  }
  
  const supabase = getSupabase();
  
  // Verify ownership
  const { data: listing } = await supabase
    .from('listings')
    .select('owner_id')
    .eq('id', listingId)
    .single();
  
  if (!listing) {
    return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
  }
  
  if (listing.owner_id !== auth.userId && auth.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }
  
  // Delete block
  const { error } = await supabase
    .from('calendar_blocks')
    .delete()
    .eq('id', blockId)
    .eq('listing_id', listingId);
  
  if (error) {
    console.error('[CALENDAR] Error deleting block:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  
  console.log(`[CALENDAR] Block ${blockId} removed from listing ${listingId}`);
  
  return NextResponse.json({
    success: true,
    message: 'Блокировка удалена'
  });
}
