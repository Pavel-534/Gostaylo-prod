/**
 * Gostaylo - Single Listing API (v2)
 * GET /api/v2/listings/[id] - Get listing details
 * PUT /api/v2/listings/[id] - Update listing
 * DELETE /api/v2/listings/[id] - Delete listing + cleanup storage
 */

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { supabaseAdmin } from '@/lib/supabase';
import { revalidateListingPaths } from '@/lib/revalidation';
import PricingService from '@/lib/services/pricing.service';

const STORAGE_BUCKET = 'listings';

/**
 * Delete files from Supabase Storage for a listing
 */
async function cleanupListingStorage(listingId, images) {
  if (!images || images.length === 0) return;
  
  try {
    // Extract file paths from URLs
    // URLs look like: https://xxx.supabase.co/storage/v1/object/public/listings/lst-xxx/123456.jpg
    const filePaths = images
      .filter(url => url && url.includes(`/storage/v1/object/public/${STORAGE_BUCKET}/`))
      .map(url => {
        const match = url.match(new RegExp(`/${STORAGE_BUCKET}/(.+)$`));
        return match ? match[1] : null;
      })
      .filter(Boolean);
    
    if (filePaths.length > 0) {
      console.log(`[STORAGE CLEANUP] Deleting ${filePaths.length} files for listing ${listingId}`);
      
      const { error } = await supabaseAdmin
        .storage
        .from(STORAGE_BUCKET)
        .remove(filePaths);
      
      if (error) {
        console.error('[STORAGE CLEANUP ERROR]', error);
      } else {
        console.log(`[STORAGE CLEANUP] Successfully deleted files for ${listingId}`);
      }
    }
  } catch (e) {
    console.error('[STORAGE CLEANUP ERROR]', e);
    // Don't throw - listing deletion should still proceed
  }
}

export async function GET(request, context) {
  try {
    // In Next.js 13+, params can be async - await it to be safe
    const params = await Promise.resolve(context.params)
    const { id } = params
    
    const { data: listing, error } = await supabaseAdmin
      .from('listings')
      .select(`
        *,
        categories (id, name, slug, icon),
        owner:profiles!owner_id (id, first_name, last_name, email)
      `)
      .eq('id', id)
      .single();
    
    if (error || !listing) {
      return NextResponse.json({ 
        success: false, 
        error: 'Listing not found' 
      }, { status: 404 });
    }
    
    // Increment views
    await supabaseAdmin
      .from('listings')
      .update({ views: (listing.views || 0) + 1 })
      .eq('id', id);
    
    // Server-side fallback: Calculate reviews_count if NULL
    let reviewsCount = listing.reviews_count
    if (reviewsCount === null || reviewsCount === undefined) {
      // Fetch actual count from reviews table
      const { count, error: countError } = await supabaseAdmin
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('listing_id', id)
      
      reviewsCount = countError ? 0 : (count || 0)
      console.log(`[LISTING API] Fallback reviews_count for ${id}: ${reviewsCount}`)
    }
    
    // Get seasonal prices
    const { data: seasonalPrices } = await supabaseAdmin
      .from('seasonal_prices')
      .select('*')
      .eq('listing_id', id)
      .order('start_date', { ascending: true });
    
    // Calculate commission rate dynamically via PricingService
    // This ensures UI always shows the CORRECT rate based on:
    // 1. Partner's custom_commission_rate, 2. Global platform rate, 3. 15% fallback
    const dummyPrice = 1000; // Use dummy price just to get commission rate
    const commissionCalc = await PricingService.calculateCommission(dummyPrice, listing.owner_id);
    const dynamicCommissionRate = commissionCalc.commissionRate;
    
    console.log(`[LISTING API] Commission rate for listing ${id}: ${dynamicCommissionRate}% (via PricingService)`);
    
    // Transform for frontend
    const transformed = {
      id: listing.id,
      ownerId: listing.owner_id,
      categoryId: listing.category_id,
      category: listing.categories,
      status: listing.status,
      title: listing.title,
      description: listing.description,
      district: listing.district,
      latitude: listing.latitude,
      longitude: listing.longitude,
      address: listing.address,
      basePriceThb: parseFloat(listing.base_price_thb),
      commissionRate: dynamicCommissionRate,  // Use calculated rate from PricingService
      images: listing.images || [],
      coverImage: listing.cover_image,
      metadata: listing.metadata || {},
      available: listing.available,
      isFeatured: listing.is_featured,
      minBookingDays: listing.min_booking_days,
      maxBookingDays: listing.max_booking_days,
      views: (listing.views || 0) + 1,
      bookingsCount: listing.bookings_count || 0,
      rating: parseFloat(listing.rating) || 0,
      reviewsCount: reviewsCount || 0,
      createdAt: listing.created_at,
      owner: listing.owner,
      seasonalPrices: seasonalPrices?.map(sp => ({
        id: sp.id,
        startDate: sp.start_date,
        endDate: sp.end_date,
        label: sp.label,
        seasonType: sp.season_type,
        priceDaily: parseFloat(sp.price_daily),
        priceMonthly: sp.price_monthly ? parseFloat(sp.price_monthly) : null
      })) || []
    };
    
    return NextResponse.json({ success: true, data: transformed });
    
  } catch (error) {
    console.error('[LISTING GET ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request, context) {
  try {
    const params = await Promise.resolve(context.params)
    const { id } = params
    const body = await request.json();
    
    // Build update object
    const updates = {};
    
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.district !== undefined) updates.district = body.district;
    if (body.basePriceThb !== undefined) updates.base_price_thb = body.basePriceThb;
    if (body.images !== undefined) {
      updates.images = body.images;
      updates.cover_image = body.images[0] || null;
    }
    if (body.metadata !== undefined) updates.metadata = body.metadata;
    if (body.available !== undefined) updates.available = body.available;
    if (body.status !== undefined) updates.status = body.status;
    if (body.isFeatured !== undefined) updates.is_featured = body.isFeatured;
    
    const { data: listing, error } = await supabaseAdmin
      .from('listings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    // Trigger cache revalidation (Airbnb-style smart caching)
    await revalidateListingPaths('update', id);
    
    return NextResponse.json({ 
      success: true, 
      data: {
        id: listing.id,
        title: listing.title,
        status: listing.status,
        isFeatured: listing.is_featured,
        updatedAt: listing.updated_at
      }
    });
    
  } catch (error) {
    console.error('[LISTING PUT ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  try {
    const params = await Promise.resolve(context.params)
    const { id } = params
    
    // 1. First, get listing to retrieve image URLs for cleanup
    const { data: listing, error: fetchError } = await supabaseAdmin
      .from('listings')
      .select('id, images, cover_image')
      .eq('id', id)
      .single();
    
    if (fetchError) {
      console.error('[LISTING DELETE] Listing not found:', id);
      return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
    }
    
    // 2. Clean up storage files (async, don't block deletion)
    const allImages = [...(listing.images || [])];
    if (listing.cover_image && !allImages.includes(listing.cover_image)) {
      allImages.push(listing.cover_image);
    }
    
    // Run cleanup in background (don't await to speed up response)
    cleanupListingStorage(id, allImages);
    
    // 3. Delete the listing from database
    const { error } = await supabaseAdmin
      .from('listings')
      .delete()
      .eq('id', id);
    
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    // Trigger cache revalidation (Airbnb-style smart caching)
    await revalidateListingPaths('delete', id);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Listing deleted',
      storageCleanup: allImages.length > 0 ? 'initiated' : 'no_files'
    });
    
  } catch (error) {
    console.error('[LISTING DELETE ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
