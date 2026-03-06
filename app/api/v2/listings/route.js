/**
 * Gostaylo - Listings API (v2)
 * GET /api/v2/listings - Search/filter listings
 * POST /api/v2/listings - Create new listing
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
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
      commissionRate: parseFloat(l.commission_rate),
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
      categoryId,
      title,
      description,
      district,
      basePriceThb,
      images,
      metadata,
      commissionRate = 15
    } = body;
    
    // Validate required fields
    if (!ownerId || !categoryId || !title || !basePriceThb) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: ownerId, categoryId, title, basePriceThb' 
      }, { status: 400 });
    }
    
    // Create listing
    const { data: listing, error } = await supabaseAdmin
      .from('listings')
      .insert({
        owner_id: ownerId,
        category_id: categoryId,
        status: 'PENDING',
        title,
        description,
        district,
        base_price_thb: basePriceThb,
        commission_rate: commissionRate,
        images: images || [],
        cover_image: images?.[0] || null,
        metadata: metadata || {},
        available: false // Pending approval
      })
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
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
