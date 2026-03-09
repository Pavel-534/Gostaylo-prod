/**
 * Gostaylo - Partner Listings API (v2)
 * GET /api/v2/partner/listings - Get partner's listings
 * POST /api/v2/partner/listings - Create new listing
 */

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partnerId');
    
    if (!partnerId) {
      return NextResponse.json({ 
        success: false, 
        error: 'partnerId is required' 
      }, { status: 400 });
    }
    
    const { data: listings, error } = await supabaseAdmin
      .from('listings')
      .select(`
        *,
        categories (id, name, slug, icon)
      `)
      .eq('owner_id', partnerId)
      .order('created_at', { ascending: false });
    
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    // Transform for frontend
    const transformed = listings.map(l => ({
      id: l.id,
      title: l.title,
      status: l.status,
      district: l.district,
      basePriceThb: parseFloat(l.base_price_thb) || 0,
      commissionRate: parseFloat(l.commission_rate) || 15,
      images: l.images || [],
      coverImage: l.cover_image,
      available: l.available,
      isFeatured: l.is_featured,
      views: l.views || 0,
      bookingsCount: l.bookings_count || 0,
      rating: parseFloat(l.rating) || 0,
      category: l.categories,
      metadata: l.metadata || {},
      createdAt: l.created_at,
      updatedAt: l.updated_at
    }));
    
    return NextResponse.json({ 
      success: true, 
      data: transformed,
      count: transformed.length
    });
    
  } catch (error) {
    console.error('[PARTNER LISTINGS GET ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    const {
      partnerId,
      categoryId,
      title,
      description,
      district,
      basePriceThb,
      images,
      metadata
    } = body;
    
    if (!partnerId || !categoryId || !title || !basePriceThb) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields' 
      }, { status: 400 });
    }
    
    // Verify partner exists and is verified
    const { data: partner } = await supabaseAdmin
      .from('profiles')
      .select('id, is_verified, custom_commission_rate')
      .eq('id', partnerId)
      .single();
    
    if (!partner) {
      return NextResponse.json({ 
        success: false, 
        error: 'Partner not found' 
      }, { status: 404 });
    }
    
    // Get system default commission rate
    const { data: settings } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'general')
      .single();
    
    const commissionRate = partner.custom_commission_rate || 
      settings?.value?.defaultCommissionRate || 15;
    
    // Create listing
    const { data: listing, error } = await supabaseAdmin
      .from('listings')
      .insert({
        owner_id: partnerId,
        category_id: categoryId,
        status: partner.is_verified ? 'PENDING' : 'INACTIVE',
        title,
        description,
        district,
        base_price_thb: basePriceThb,
        commission_rate: commissionRate,
        images: images || [],
        cover_image: images?.[0] || null,
        metadata: metadata || {},
        available: false
      })
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    console.log(`[PARTNER] New listing created: ${listing.id} by ${partnerId}`);
    
    return NextResponse.json({ 
      success: true, 
      data: {
        id: listing.id,
        title: listing.title,
        status: listing.status,
        basePriceThb: parseFloat(listing.base_price_thb),
        commissionRate: parseFloat(listing.commission_rate)
      }
    });
    
  } catch (error) {
    console.error('[PARTNER LISTINGS POST ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
