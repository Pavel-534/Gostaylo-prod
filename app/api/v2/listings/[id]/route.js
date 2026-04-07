/**
 * GoStayLo - Single Listing API (v2)
 * GET /api/v2/listings/[id] - Get listing details
 * PUT /api/v2/listings/[id] - Update listing
 * DELETE /api/v2/listings/[id] - Delete listing + cleanup storage
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidateListingPaths } from '@/lib/revalidation'
import { scheduleListingEmbeddingRefresh } from '@/lib/ai/embeddings'
import PricingService from '@/lib/services/pricing.service'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'
import { toPublicImageUrl, mapPublicImageUrls } from '@/lib/public-image-url'
import { getSessionPayload } from '@/lib/services/session-service'
import { isStaffRole } from '@/lib/services/chat/access'

export const dynamic = 'force-dynamic'

const STORAGE_BUCKETS = ['listing-images', 'listings']

/**
 * Delete files from Supabase Storage for a listing (best-effort; DB trigger also wipes prefix).
 */
async function cleanupListingStorage(listingId, images) {
  if (!images || images.length === 0) return;

  try {
    const byBucket = { 'listing-images': [], listings: [] };
    for (const url of images) {
      if (!url || typeof url !== 'string') continue;
      for (const bucket of STORAGE_BUCKETS) {
        const marker = `/storage/v1/object/public/${bucket}/`;
        if (!url.includes(marker)) continue;
        const after = url.split(marker)[1];
        const pathOnly = after?.split('?')[0]?.split('#')[0];
        if (pathOnly) byBucket[bucket].push(pathOnly);
        break;
      }
    }

    for (const bucket of STORAGE_BUCKETS) {
      const paths = [...new Set(byBucket[bucket])];
      if (paths.length === 0) continue;
      console.log(`[STORAGE CLEANUP] Deleting ${paths.length} files in ${bucket} for listing ${listingId}`);
      const { error } = await supabaseAdmin.storage.from(bucket).remove(paths);
      if (error) {
        console.error('[STORAGE CLEANUP ERROR]', bucket, error);
      }
    }
  } catch (e) {
    console.error('[STORAGE CLEANUP ERROR]', e);
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
        owner:profiles!owner_id (id, first_name, last_name, is_verified, verification_status, avatar, email, phone)
      `)
      .eq('id', id)
      .single();
    
    if (error || !listing) {
      return NextResponse.json({ 
        success: false, 
        error: 'Listing not found' 
      }, { status: 404 });
    }
    
    // Increment views (non-blocking)
    supabaseAdmin
      .from('listings')
      .update({ views: (listing.views || 0) + 1 })
      .eq('id', id)
      .then(() => {})
      .catch(() => {});
    
    // Parallelize slow dependent reads - each wrapped in try-catch for stability
    const seasonalPricesPromise = (async () => {
      try {
        const { data, error } = await supabaseAdmin
          .from('seasonal_prices')
          .select('*')
          .eq('listing_id', id)
          .order('start_date', { ascending: true })
        return error ? [] : (data || [])
      } catch (e) {
        console.warn('[LISTING] seasonal_prices error:', e?.message)
        return []
      }
    })()

    const reviewsCountPromise = (async () => {
      try {
        const rc = listing.reviews_count
        if (rc !== null && rc !== undefined) return rc
        const { count, error: countError } = await supabaseAdmin
          .from('reviews')
          .select('id', { count: 'exact', head: true })
          .eq('listing_id', id)
        return countError ? 0 : (count || 0)
      } catch (e) {
        console.warn('[LISTING] reviews count error:', e?.message)
        return 0
      }
    })()

    const commissionRatePromise = (async () => {
      try {
        const dummyPrice = 1000
        const commissionCalc = await PricingService.calculateCommission(dummyPrice, listing.owner_id)
        return commissionCalc?.commissionRate ?? (await resolveDefaultCommissionPercent())
      } catch (e) {
        console.warn('[LISTING] commission error:', e?.message)
        return await resolveDefaultCommissionPercent()
      }
    })()

    const [seasonalPrices, reviewsCount, dynamicCommissionRate] = await Promise.all([
      seasonalPricesPromise,
      reviewsCountPromise,
      commissionRatePromise
    ])

    const session = await getSessionPayload()
    const viewerId = session?.userId ? String(session.userId) : null
    const viewerRole = String(session?.role || '').toUpperCase()
    const canSeeOwnerPii =
      viewerId &&
      (viewerId === String(listing.owner_id) || isStaffRole(viewerRole))
    
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
      images: mapPublicImageUrls(listing.images || []),
      coverImage: listing.cover_image ? toPublicImageUrl(listing.cover_image) : null,
      metadata: listing.metadata || {},
      available: listing.available,
      isFeatured: listing.is_featured,
      minBookingDays: listing.min_booking_days,
      maxBookingDays: listing.max_booking_days,
      maxCapacity: (() => {
        const n = parseInt(listing.max_capacity, 10)
        return Number.isFinite(n) && n > 0 ? n : null
      })(),
      views: (listing.views || 0) + 1,
      bookingsCount: listing.bookings_count || 0,
      rating: parseFloat(listing.rating) || 0,
      reviewsCount: reviewsCount || 0,
      createdAt: listing.created_at,
      owner: listing.owner
        ? {
            id: listing.owner.id,
            first_name: listing.owner.first_name,
            last_name: listing.owner.last_name,
            is_verified: listing.owner.is_verified,
            verification_status: listing.owner.verification_status,
            avatar: listing.owner.avatar ? toPublicImageUrl(listing.owner.avatar) : null,
            ...(canSeeOwnerPii
              ? {
                  email: listing.owner.email ?? null,
                  phone: listing.owner.phone ?? null,
                }
              : {}),
          }
        : null,
      seasonalPrices: (seasonalPrices || [])?.map(sp => ({
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
    if (body.latitude !== undefined) updates.latitude = body.latitude;
    if (body.longitude !== undefined) updates.longitude = body.longitude;
    if (body.basePriceThb !== undefined) updates.base_price_thb = parseFloat(body.basePriceThb) || 0;
    if (body.images !== undefined) {
      updates.images = body.images;
      updates.cover_image = body.images[0] || null;
    }
    if (body.metadata !== undefined) updates.metadata = body.metadata;
    if (body.available !== undefined) updates.available = body.available;
    if (body.status !== undefined) updates.status = body.status;
    if (body.isFeatured !== undefined) updates.is_featured = body.isFeatured;
    if (body.categoryId !== undefined) updates.category_id = body.categoryId;
    if (body.minBookingDays !== undefined) updates.min_booking_days = parseInt(body.minBookingDays) || 1;
    if (body.maxBookingDays !== undefined) updates.max_booking_days = parseInt(body.maxBookingDays) || 90;
    
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

    const semanticKeys = ['title', 'description', 'district', 'categoryId']
    if (semanticKeys.some((k) => body[k] !== undefined)) {
      scheduleListingEmbeddingRefresh(id);
    }
    
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
