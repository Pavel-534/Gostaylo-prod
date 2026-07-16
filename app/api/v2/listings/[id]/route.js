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
import { getSessionPayload, requirePartnerSession } from '@/lib/services/session-service'
import { getPublicListingDetail } from '@/lib/listing/get-public-listing-detail.js'
import { isListingBaseCurrency, normalizeCurrencyCode } from '@/lib/finance/currency-codes'

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
    const params = await Promise.resolve(context.params)
    const { id } = params

    const session = await getSessionPayload()
    const viewerId = session?.userId ? String(session.userId) : null
    const viewerRole = String(session?.role || '').toUpperCase()

    const result = await getPublicListingDetail({
      listingId: id,
      viewerId,
      viewerRole,
      incrementViews: true,
    })

    if (!result.ok) {
      const body = {
        success: false,
        error: result.error,
      }
      if (result.code) body.code = result.code
      return NextResponse.json(body, { status: result.httpStatus })
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    console.error('[LISTING GET ERROR]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

/**
 * Partner/admin-only mutation guard for legacy public listing routes.
 * @param {string} listingId
 */
async function requireListingOwnerMutation(listingId) {
  const auth = await requirePartnerSession()
  if (auth.error) return { error: auth.error }

  const { data: listing, error } = await supabaseAdmin
    .from('listings')
    .select('id, owner_id')
    .eq('id', listingId)
    .maybeSingle()

  if (error || !listing) {
    return {
      error: NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 }),
    }
  }

  if (auth.userRole !== 'ADMIN' && String(listing.owner_id) !== String(auth.userId)) {
    return {
      error: NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 }),
    }
  }

  return { auth, listing }
}

export async function PUT(request, context) {
  try {
    const params = await Promise.resolve(context.params)
    const { id } = params

    const gate = await requireListingOwnerMutation(id)
    if (gate.error) return gate.error

    const body = await request.json();
    
    // Build update object
    const updates = {};
    
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.district !== undefined) updates.district = body.district;
    if (body.latitude !== undefined) updates.latitude = body.latitude;
    if (body.longitude !== undefined) updates.longitude = body.longitude;
    if (body.basePriceThb !== undefined) updates.base_price_thb = parseFloat(body.basePriceThb) || 0;
    if (body.baseCurrency !== undefined || body.base_currency !== undefined) {
      const incoming = body.baseCurrency ?? body.base_currency;
      const normalized = normalizeCurrencyCode(incoming);
      if (!isListingBaseCurrency(normalized)) {
        return NextResponse.json({ success: false, error: 'Invalid base currency' }, { status: 400 });
      }
      updates.base_currency = normalized;
    }
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

    const gate = await requireListingOwnerMutation(id)
    if (gate.error) return gate.error
    
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
