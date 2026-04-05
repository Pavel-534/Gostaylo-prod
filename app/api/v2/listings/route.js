/**
 * GoStayLo - Listings API (v2)
 * 
 * GET /api/v2/listings - DEPRECATED! Use /api/v2/search instead
 * POST /api/v2/listings - Create new listing (ACTIVE)
 * 
 * @deprecated GET method - migrate to /api/v2/search for availability filtering
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service';
import { revalidateListingPaths } from '@/lib/revalidation';
import { scheduleListingEmbeddingRefresh } from '@/lib/ai/embeddings';

/**
 * @deprecated Use /api/v2/search instead
 * This endpoint does NOT support availability filtering
 */
export async function GET(request) {
  console.warn('[DEPRECATED] GET /api/v2/listings called - use /api/v2/search for availability filtering');
  
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse filters
    const category = searchParams.get('category');
    const district = searchParams.get('district');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const search = searchParams.get('search');
    const status = searchParams.get('status') || 'ACTIVE';
    const limit = parseInt(searchParams.get('limit')) || 50;
    
    // Build query
    let query = supabaseAdmin
      .from('listings')
      .select(`
        *,
        rating,
        reviews_count,
        categories (id, name, slug, icon),
        owner:profiles!owner_id (id, first_name, last_name)
      `)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    
    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    
    if (category) {
      // Find category by slug
      const { data: cat } = await supabaseAdmin
        .from('categories')
        .select('id')
        .eq('slug', category)
        .single();
      
      if (cat) {
        query = query.eq('category_id', cat.id);
      }
    }
    
    if (district) {
      query = query.eq('district', district);
    }
    
    if (minPrice) {
      query = query.gte('base_price_thb', parseFloat(minPrice));
    }
    
    if (maxPrice) {
      query = query.lte('base_price_thb', parseFloat(maxPrice));
    }
    
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    
    const { data: listings, error } = await query;
    
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const defaultListingCommission = await resolveDefaultCommissionPercent();

    // Transform for frontend compatibility
    const transformed = listings.map(l => ({
      id: l.id,
      ownerId: l.owner_id,
      categoryId: l.category_id,
      category: l.categories,
      status: l.status,
      title: l.title,
      description: l.description,
      district: l.district,
      basePriceThb: parseFloat(l.base_price_thb),
      commissionRate: (() => {
        const n = parseFloat(l.commission_rate);
        return Number.isFinite(n) && n >= 0 ? n : defaultListingCommission;
      })(),
      images: l.images || [],
      coverImage: l.cover_image,
      metadata: l.metadata || {},
      available: l.available,
      isFeatured: l.is_featured,
      views: l.views || 0,
      bookingsCount: l.bookings_count || 0,
      rating: parseFloat(l.rating) || 0,
      reviewsCount: l.reviews_count || 0,
      createdAt: l.created_at,
      owner: l.owner
    }));
    
    return NextResponse.json({ 
      success: true, 
      data: transformed,
      count: transformed.length
    });
    
  } catch (error) {
    console.error('[LISTINGS GET ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    const {
      ownerId,
      owner_id,
      categoryId,
      title,
      description,
      district,
      basePriceThb,
      base_price_thb,
      images,
      metadata,
      commissionRate: bodyCommissionRate,
      status: bodyStatus,
      available: bodyAvailable,
      minBookingDays,
      maxBookingDays,
    } = body;

    const uid = ownerId || owner_id;
    const price = basePriceThb ?? base_price_thb ?? 0;
    const parsedComm = parseFloat(bodyCommissionRate);
    const commissionRate =
      Number.isFinite(parsedComm) && parsedComm >= 0
        ? parsedComm
        : await resolveDefaultCommissionPercent();
    
    // Validate required fields (relaxed for drafts)
    if (!uid || !categoryId || !title) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: ownerId, categoryId, title' 
      }, { status: 400 });
    }
    
    // Draft: INACTIVE + available=false; New listing: PENDING
    const isDraft = metadata?.is_draft === true;
    const status = bodyStatus || (isDraft ? 'INACTIVE' : 'PENDING');
    const available = bodyAvailable !== undefined ? bodyAvailable : false;
    
    const insertRow = {
      owner_id: uid,
      category_id: categoryId,
      status,
      title,
      description: description || '',
      district: district || null,
      base_price_thb: parseFloat(price) || 0,
      commission_rate: commissionRate,
      images: images || [],
      cover_image: images?.[0] || null,
      metadata: metadata || {},
      available,
    };
    if (minBookingDays !== undefined && minBookingDays !== null) {
      insertRow.min_booking_days = parseInt(minBookingDays, 10) || 1;
    }
    if (maxBookingDays !== undefined && maxBookingDays !== null) {
      insertRow.max_booking_days = parseInt(maxBookingDays, 10) || null;
    }

    // Create listing
    const { data: listing, error } = await supabaseAdmin
      .from('listings')
      .insert(insertRow)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    // Trigger cache revalidation (Airbnb-style smart caching)
    await revalidateListingPaths('create', listing.id);

    scheduleListingEmbeddingRefresh(listing.id);
    
    return NextResponse.json({ 
      success: true, 
      data: {
        id: listing.id,
        ownerId: listing.owner_id,
        categoryId: listing.category_id,
        title: listing.title,
        status: listing.status,
        basePriceThb: parseFloat(listing.base_price_thb),
        createdAt: listing.created_at
      }
    });
    
  } catch (error) {
    console.error('[LISTINGS POST ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
