/**
 * Gostaylo - Single Listing API for Partner
 * GET /api/v2/partner/listings/[id]
 * 
 * Returns a single listing by ID for the owner
 * Works for drafts (INACTIVE + is_draft) too
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production';

export async function GET(request, context) {
  const params = await Promise.resolve(context.params);
  const listingId = params.id;
  
  console.log('[PARTNER-LISTING] GET single listing:', listingId);
  
  // Verify JWT from cookie
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('gostaylo_session');
  
  if (!sessionCookie?.value) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  let decoded;
  try {
    decoded = jwt.verify(sessionCookie.value, JWT_SECRET);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
  }
  
  const userId = decoded.userId;
  const userRole = decoded.role;
  
  // Check role
  if (!['PARTNER', 'ADMIN', 'MODERATOR'].includes(userRole)) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }
  
  // Get Supabase client with service key
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
  }
  
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // Fetch listing with category
  const { data: listing, error } = await supabase
    .from('listings')
    .select(`
      *,
      categories (id, name, slug, icon)
    `)
    .eq('id', listingId)
    .single();
  
  if (error || !listing) {
    console.error('[PARTNER-LISTING] Not found or error:', error?.message);
    return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
  }
  
  // Check ownership (unless admin)
  if (userRole !== 'ADMIN' && listing.owner_id !== userId) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }
  
  console.log(`[PARTNER-LISTING] Found: ${listing.title}, status: ${listing.status}, is_draft: ${listing.metadata?.is_draft}`);
  
  const cat = listing.categories || listing.category;
  
  // Fetch seasonal prices
  let seasonalPrices = [];
  try {
    const { data: sp } = await supabase
      .from('seasonal_prices')
      .select('*')
      .eq('listing_id', listingId)
      .order('start_date', { ascending: true });
    seasonalPrices = sp || [];
  } catch (e) {
    console.warn('[PARTNER-LISTING] seasonal_prices error:', e?.message);
  }
  
  return NextResponse.json({
    success: true,
    data: {
      id: listing.id,
      categoryId: listing.category_id,
      category: cat,
      title: listing.title,
      description: listing.description,
      status: listing.status,
      district: listing.district,
      latitude: listing.latitude,
      longitude: listing.longitude,
      basePriceThb: parseFloat(listing.base_price_thb) || 0,
      commissionRate: parseFloat(listing.commission_rate) || 15,
      minBookingDays: listing.min_booking_days ?? 1,
      maxBookingDays: listing.max_booking_days ?? 90,
      images: listing.images || [],
      coverImage: listing.cover_image,
      available: listing.available,
      isFeatured: listing.is_featured,
      views: listing.views || 0,
      metadata: listing.metadata || {},
      ownerId: listing.owner_id,
      createdAt: listing.created_at,
      updatedAt: listing.updated_at,
      seasonalPrices: seasonalPrices.map(sp => ({
        id: sp.id,
        label: sp.label,
        startDate: sp.start_date,
        endDate: sp.end_date,
        priceDaily: parseFloat(sp.price_daily) || 0,
        seasonType: sp.season_type,
      })),
    },
    listing: {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      status: listing.status,
      district: listing.district,
      basePriceThb: parseFloat(listing.base_price_thb) || 0,
      commissionRate: parseFloat(listing.commission_rate) || 15,
      images: listing.images || [],
      coverImage: listing.cover_image,
      available: listing.available,
      isFeatured: listing.is_featured,
      views: listing.views || 0,
      metadata: listing.metadata || {},
      ownerId: listing.owner_id,
      createdAt: listing.created_at,
      updatedAt: listing.updated_at
    }
  });
}

/**
 * PUT /api/v2/partner/listings/[id]
 * Update a listing (same as PATCH, for compatibility)
 */
export async function PUT(request, context) {
  const params = await Promise.resolve(context.params)
  return PATCH(request, context)
}

/**
 * PATCH /api/v2/partner/listings/[id]
 * Update a listing
 */
export async function PATCH(request, context) {
  const params = await Promise.resolve(context.params)
  const listingId = params.id;
  
  console.log('[PARTNER-LISTING] PATCH listing:', listingId);
  
  // Verify JWT
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('gostaylo_session');
  
  if (!sessionCookie?.value) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  let decoded;
  try {
    decoded = jwt.verify(sessionCookie.value, JWT_SECRET);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
  }
  
  const userId = decoded.userId;
  const userRole = decoded.role;
  
  if (!['PARTNER', 'ADMIN', 'MODERATOR'].includes(userRole)) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }
  
  const body = await request.json();
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // First verify ownership
  const { data: existing } = await supabase
    .from('listings')
    .select('owner_id, metadata')
    .eq('id', listingId)
    .single();
  
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
  }
  
  if (userRole !== 'ADMIN' && existing.owner_id !== userId) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }
  
  // Prepare update data
  const updateData = {
    updated_at: new Date().toISOString()
  };
  
  if (body.title !== undefined) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.basePriceThb !== undefined) updateData.base_price_thb = parseFloat(body.basePriceThb);
  if (body.district !== undefined) updateData.district = body.district;
  if (body.latitude !== undefined) updateData.latitude = body.latitude;
  if (body.longitude !== undefined) updateData.longitude = body.longitude;
  if (body.categoryId !== undefined) updateData.category_id = body.categoryId;
  if (body.minBookingDays !== undefined) updateData.min_booking_days = parseInt(body.minBookingDays) || 1;
  if (body.maxBookingDays !== undefined) updateData.max_booking_days = parseInt(body.maxBookingDays) || 90;
  if (body.images !== undefined) updateData.images = body.images;
  if (body.coverImage !== undefined) updateData.cover_image = body.coverImage;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.available !== undefined) updateData.available = body.available;
  
  // Handle metadata merge
  if (body.metadata !== undefined) {
    updateData.metadata = {
      ...(existing.metadata || {}),
      ...body.metadata
    };
  }
  
  // Update
  const { data: updated, error } = await supabase
    .from('listings')
    .update(updateData)
    .eq('id', listingId)
    .select()
    .single();
  
  if (error) {
    console.error('[PARTNER-LISTING] Update error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  
  console.log('[PARTNER-LISTING] Updated successfully');
  
  return NextResponse.json({
    success: true,
    listing: updated
  });
}

/**
 * DELETE /api/v2/partner/listings/[id]
 * Soft delete a listing (set status to 'DELETED')
 * Keeps message history intact
 */
export async function DELETE(request, context) {
  const params = await Promise.resolve(context.params);
  const listingId = params.id;
  
  console.log('[PARTNER-LISTING] SOFT DELETE listing:', listingId);
  
  // Verify JWT
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('gostaylo_session');
  
  if (!sessionCookie?.value) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  let decoded;
  try {
    decoded = jwt.verify(sessionCookie.value, JWT_SECRET);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
  }
  
  const userId = decoded.userId;
  const userRole = decoded.role;
  
  if (!['PARTNER', 'ADMIN', 'MODERATOR'].includes(userRole)) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // First get listing to check ownership
  const { data: listing } = await supabase
    .from('listings')
    .select('owner_id, images, status')
    .eq('id', listingId)
    .single();
  
  if (!listing) {
    return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
  }
  
  if (userRole !== 'ADMIN' && listing.owner_id !== userId) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }
  
  // SOFT DELETE: Update status to 'DELETED' instead of physical deletion
  const { error } = await supabase
    .from('listings')
    .update({
      status: 'DELETED',
      available: false,
      metadata: {
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        previous_status: listing.status
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', listingId);
  
  if (error) {
    console.error('[PARTNER-LISTING] Soft delete error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  
  console.log('[PARTNER-LISTING] Soft deleted successfully');
  
  // Note: Images are kept in storage for potential restoration
  // They will be cleaned up by the cleanup-drafts cron if needed
  
  return NextResponse.json({ success: true, softDeleted: true });
}
