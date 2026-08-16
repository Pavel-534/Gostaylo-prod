/**
 * GoStayLo - Single Listing API for Partner
 * GET /api/v2/partner/listings/[id]
 * 
 * Returns a single listing by ID for the owner
 * Works for drafts (INACTIVE + is_draft) too
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { toPublicImageUrl, mapPublicImageUrls } from '@/lib/public-image-url';
import { requirePartnerSession } from '@/lib/services/session-service';
import { revalidateListingPaths } from '@/lib/revalidation';
import { scheduleListingEmbeddingRefresh } from '@/lib/ai/embeddings';
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service';
import { isListingBaseCurrency, normalizeCurrencyCode } from '@/lib/finance/currency-codes';
import { normalizeCancellationPolicy } from '@/lib/cancellation-refund-rules';
import { validateListingPublishQuality, validateListingSoftPublishQuality } from '@/lib/partner/listing-quality-gates.js';
import { resolveListingCategorySlug } from '@/lib/services/booking/query.service.js';
import { listingBasePriceSchema } from '@/lib/validations/listing';
import { applyListingGeoSnapshotToUpdateData } from '@/lib/partner/apply-listing-geo-snapshot';
import { scheduleLocationSuggestionCapture } from '@/lib/services/location-suggestion-capture.service';
import { applyListingMaxCapacitySyncToRow } from '@/lib/listing-guest-capacity.js';
import {
  buildListingPriceWriteFields,
  mapListingPriceFieldsForApi,
  readPartnerFormAssetAmount,
} from '@/lib/listing/listing-base-price-canon.js';
import { mapSeasonalRowForPartnerUi } from '@/lib/listing/listing-seasonal-price-canon.js';
import { applyListingBaseCurrencyInvariant } from '@/lib/listing/apply-listing-base-currency-invariant.js';
import { assertListingFinancialEditAllowed, checkListingFinancialLock } from '@/lib/listing/listing-financial-lock.js';
import { assertListingGeoCodes } from '@/lib/geo/assert-listing-geo-codes.js';
import { assertInstantBookingCalendarPolicy } from '@/lib/ical/instant-booking-ical-policy.js';
import {
  buildSoftDeleteMetadataFields,
  buildSoftDeleteSyncSettingsPatch,
  isListingSoftDeleted,
} from '@/lib/listing/listing-soft-delete.js'
import {
  buildRestoredSyncSettingsPatch,
  clearSoftDeleteMetadata,
} from '@/lib/listing/listing-soft-delete-restore.js';

export const dynamic = 'force-dynamic';

async function getPartnerFromSession() {
  return requirePartnerSession();
}

export async function GET(request, context) {
  const params = await Promise.resolve(context.params);
  const listingId = params.id;
  
  console.log('[PARTNER-LISTING] GET single listing:', listingId);
  
  const auth = await getPartnerFromSession();
  if (auth.error) return auth.error;
  const { userId, userRole } = auth;
  
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

  const rawComm = parseFloat(listing.commission_rate);
  const defaultListingCommission = await resolveDefaultCommissionPercent();
  const commissionRate =
    Number.isFinite(rawComm) && rawComm >= 0 ? rawComm : defaultListingCommission;

  const priceFields = mapListingPriceFieldsForApi(listing);

  let financialLock = { locked: false, activeBookingCount: 0 }
  try {
    financialLock = await checkListingFinancialLock(supabase, listingId)
  } catch (lockErr) {
    console.warn('[PARTNER-LISTING] financial lock check failed:', lockErr?.message)
  }

  const listingPayload = {
      id: listing.id,
      categoryId: listing.category_id,
      category: cat,
      title: listing.title,
      description: listing.description,
      status: listing.status,
      district: listing.district,
      countryCode: listing.country_code || null,
      country_code: listing.country_code || null,
      regionCode: listing.region_code || null,
      region_code: listing.region_code || null,
      cityCode: listing.city_code || null,
      city_code: listing.city_code || null,
      latitude: listing.latitude,
      longitude: listing.longitude,
      ...priceFields,
      commissionRate,
      minBookingDays: listing.min_booking_days ?? 1,
      maxBookingDays: listing.max_booking_days ?? 90,
      instantBooking: listing.instant_booking === true,
      cancellationPolicy: normalizeCancellationPolicy(listing.cancellation_policy),
      images: mapPublicImageUrls(listing.images || []),
      coverImage: listing.cover_image ? toPublicImageUrl(listing.cover_image) : null,
      available: listing.available,
      isFeatured: listing.is_featured,
      views: listing.views || 0,
      metadata: listing.metadata || {},
      sync_settings: listing.sync_settings || null,
      importPlatform: listing.import_platform || null,
      import_platform: listing.import_platform || null,
      ownerId: listing.owner_id,
      createdAt: listing.created_at,
      updatedAt: listing.updated_at,
      seasonalPrices: seasonalPrices.map((sp) => mapSeasonalRowForPartnerUi(sp)),
      financialLock: {
        locked: financialLock.locked === true,
        activeBookingCount: financialLock.activeBookingCount ?? 0,
        baseCurrencyLocked: financialLock.locked === true,
      },
  };

  return NextResponse.json({
    success: true,
    data: listingPayload,
    listing: listingPayload,
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
  
  const auth = await getPartnerFromSession();
  if (auth.error) return auth.error;
  const { userId, userRole } = auth;
  
  const body = await request.json();
  const requestedBaseCurrency =
    body.baseCurrency !== undefined || body.base_currency !== undefined
      ? normalizeCurrencyCode(body.baseCurrency ?? body.base_currency)
      : null;
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // First verify ownership
  const { data: existing } = await supabase
    .from('listings')
    .select('owner_id, metadata, instant_booking, sync_settings, title, description, images, latitude, longitude, district, base_price_thb, base_currency, category_id, country_code, region_code, city_code, max_capacity, bedrooms_count, categories(slug, name, wizard_profile)')
    .eq('id', listingId)
    .single();
  
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
  }
  
  if (userRole !== 'ADMIN' && existing.owner_id !== userId) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }

  try {
    await assertListingFinancialEditAllowed(supabase, listingId, {
      existing,
      body,
      partnerId: userId,
    });
  } catch (lockErr) {
    if (lockErr?.code === 'LISTING_ASSET_LOCKED_ACTIVE_BOOKINGS') {
      return NextResponse.json(
        {
          success: false,
          error: lockErr.message,
          code: lockErr.code,
          details: lockErr.details,
        },
        { status: 400 },
      );
    }
    if (lockErr?.code === 'LISTING_FINANCIAL_LOCK_CHECK_FAILED') {
      return NextResponse.json(
        { success: false, error: lockErr.message, code: lockErr.code },
        { status: 503 },
      );
    }
    throw lockErr;
  }
  
  // Prepare update data
  const updateData = {
    updated_at: new Date().toISOString()
  };
  
  if (body.title !== undefined) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
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
  if (body.instantBooking !== undefined || body.instant_booking !== undefined) {
    const raw = body.instantBooking ?? body.instant_booking;
    updateData.instant_booking = raw === true;
  }
  if (body.cancellationPolicy !== undefined || body.cancellation_policy !== undefined) {
    const raw = body.cancellationPolicy ?? body.cancellation_policy;
    updateData.cancellation_policy = normalizeCancellationPolicy(raw);
  }

  // Handle metadata merge
  if (body.metadata !== undefined) {
    updateData.metadata = {
      ...(existing.metadata || {}),
      ...body.metadata
    };
  }
  if (body.sync_settings !== undefined) {
    updateData.sync_settings = body.sync_settings;
  }

  {
    const nextInstant = Object.prototype.hasOwnProperty.call(updateData, 'instant_booking')
      ? updateData.instant_booking === true
      : existing.instant_booking === true
    const ibGate = assertInstantBookingCalendarPolicy({
      instantBooking: nextInstant,
      metadata: updateData.metadata ?? existing.metadata,
      syncSettings: updateData.sync_settings ?? existing.sync_settings,
    })
    if (!ibGate.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Instant booking without iCal requires exclusive/manual calendar confirmation.',
          code: ibGate.code,
        },
        { status: 400 },
      )
    }
  }

  const { updateData: geoPatchedData, locationCapture } = applyListingGeoSnapshotToUpdateData(
    updateData,
    body,
    existing,
  );
  Object.assign(updateData, geoPatchedData);

  const publishing =
    body.status === 'PENDING' || body.softPublish === true || body.soft_publish === true;
  const hasFiniteCoords = (lat, lng) => {
    const a = lat != null && lat !== '' ? Number(lat) : NaN;
    const b = lng != null && lng !== '' ? Number(lng) : NaN;
    return (
      Number.isFinite(a) &&
      Number.isFinite(b) &&
      a >= -90 &&
      a <= 90 &&
      b >= -180 &&
      b <= 180
    );
  };
  const bodyHasCoords = hasFiniteCoords(body.latitude, body.longitude);
  const nonEmptyGeo = (v) => v != null && String(v).trim() !== '';
  // Stage 201.64 — blank country/city on partial draft must not trip GEO_COUNTRY_REQUIRED
  const geoTouched =
    nonEmptyGeo(body.country) ||
    nonEmptyGeo(body.region) ||
    nonEmptyGeo(body.city) ||
    body.latitude !== undefined ||
    body.longitude !== undefined;
  if (publishing || geoTouched) {
    const geoAssert = await assertListingGeoCodes({
      countryCode: updateData.country_code ?? existing.country_code,
      regionCode: updateData.region_code ?? existing.region_code,
      cityCode: updateData.city_code ?? existing.city_code,
      latitude: updateData.latitude !== undefined ? updateData.latitude : existing.latitude,
      longitude: updateData.longitude !== undefined ? updateData.longitude : existing.longitude,
      requireCountry: publishing || nonEmptyGeo(body.country),
      // Stage 200.86 — null lat/lng on draft saves must not block price/currency PATCH
      requireCoords: publishing || bodyHasCoords,
    });
    if (!geoAssert.ok) {
      return NextResponse.json(
        { success: false, error: geoAssert.error, code: geoAssert.code },
        { status: 400 },
      );
    }
  }

  if (requestedBaseCurrency && !isListingBaseCurrency(requestedBaseCurrency)) {
    return NextResponse.json({ success: false, error: 'Invalid base currency' }, { status: 400 });
  }

  applyListingBaseCurrencyInvariant(updateData, {
    requestedCurrency: requestedBaseCurrency ?? existing.base_currency,
    existingCurrency: existing.base_currency,
    listingId,
  });

  const priceFieldsTouched =
    body.basePriceThb !== undefined ||
    requestedBaseCurrency != null ||
    geoTouched;

  if (priceFieldsTouched) {
    let assetAmount;
    if (body.basePriceThb !== undefined) {
      const priceParsed = listingBasePriceSchema.safeParse(body.basePriceThb);
      if (!priceParsed.success) {
        const msg = priceParsed.error.errors?.[0]?.message || 'Invalid base price';
        return NextResponse.json({ success: false, error: msg, code: 'INVALID_BASE_PRICE' }, { status: 400 });
      }
      assetAmount = priceParsed.data;
    } else {
      const fromAsset = readPartnerFormAssetAmount(existing);
      assetAmount = fromAsset != null ? fromAsset : parseFloat(existing.base_price_thb) || 0;
    }

    const mergedMeta =
      updateData.metadata !== undefined ? updateData.metadata : existing.metadata || {};

    try {
      const priceWrite = await buildListingPriceWriteFields({
        assetAmount,
        currency: updateData.base_currency || existing.base_currency || 'THB',
        existingMetadata: mergedMeta,
      });
      updateData.base_price_thb = priceWrite.base_price_thb;
      updateData.metadata = priceWrite.metadata;
    } catch (priceErr) {
      if (priceErr?.code === 'LISTING_BASE_PRICE_FX_UNAVAILABLE') {
        return NextResponse.json(
          { success: false, error: priceErr.message, code: priceErr.code },
          { status: 503 },
        );
      }
      throw priceErr;
    }
  }

  const nextStatus = body.status !== undefined ? String(body.status).toUpperCase() : null;
  const mergedMetaForGate =
    body.metadata !== undefined
      ? { ...(existing.metadata || {}), ...body.metadata }
      : existing.metadata || {};
  const isPartnerUnhide =
    nextStatus === 'ACTIVE' &&
    String(existing.status || '').toUpperCase() === 'INACTIVE' &&
    (existing.metadata?.partner_hidden === true || existing.metadata?.partner_hidden === 'true') &&
    mergedMetaForGate.partner_hidden === false;
  const isPublishAttempt =
    (nextStatus === 'PENDING' || nextStatus === 'ACTIVE') && !isPartnerUnhide;
  if (isPublishAttempt) {
    const mergedMeta = mergedMetaForGate;
    const cat = existing.categories || {};
    let categorySlug = cat.slug || '';
    if (!categorySlug && existing.category_id) {
      categorySlug = (await resolveListingCategorySlug(existing.category_id)) || '';
    }
    const qualityInput = {
      title: body.title !== undefined ? body.title : existing.title,
      description: body.description !== undefined ? body.description : existing.description,
      images: body.images !== undefined ? body.images : existing.images,
      latitude: body.latitude !== undefined ? body.latitude : existing.latitude,
      longitude: body.longitude !== undefined ? body.longitude : existing.longitude,
      district: body.district !== undefined ? body.district : existing.district,
      metadata: mergedMeta,
      categorySlug,
      categoryName: cat.name || '',
      wizardProfile: cat.wizard_profile ?? cat.wizardProfile ?? null,
      basePriceThb:
        body.basePriceThb !== undefined
          ? body.basePriceThb
          : readPartnerFormAssetAmount(existing) ?? existing.base_price_thb,
    };
    // Soft publish: PENDING only with softer gates (Stage 200.23). ACTIVE always full quality.
    const wantsSoft =
      nextStatus === 'PENDING' &&
      (body.softPublish === true ||
        mergedMeta.soft_publish === true ||
        mergedMeta.soft_publish === 'true');
    const quality = wantsSoft
      ? validateListingSoftPublishQuality(qualityInput)
      : validateListingPublishQuality(qualityInput);
    if (!quality.ok) {
      return NextResponse.json(
        {
          success: false,
          error: quality.errors[0] || 'Listing quality requirements not met',
          code: quality.codes[0] || 'LISTING_QUALITY_GATE',
          errors: quality.errors,
          codes: quality.codes,
        },
        { status: 400 },
      );
    }
    if (wantsSoft) {
      const full = validateListingPublishQuality(qualityInput);
      body.metadata = {
        ...mergedMeta,
        ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
        is_draft: false,
        soft_publish: true,
        quality_incomplete: !full.ok,
        soft_publish_at: new Date().toISOString(),
      };
    } else if (nextStatus === 'PENDING' || nextStatus === 'ACTIVE') {
      body.metadata = {
        ...mergedMeta,
        ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
        is_draft: false,
        soft_publish: false,
        quality_incomplete: false,
      };
    }
    if (body.metadata !== undefined) {
      // Keep post-priceWrite L1 asset — publish meta merge used pre-price client/existing
      // and could clobber with stale `{amount:0,currency:'USD'}` from draft-before-country (Stage 201.57).
      const priceAsset = updateData.metadata?.base_price_asset
      updateData.metadata = {
        ...(updateData.metadata || existing.metadata || {}),
        ...body.metadata,
      }
      if (priceAsset != null && typeof priceAsset === 'object') {
        updateData.metadata.base_price_asset = priceAsset
      }
    }
  }

  let categorySlug = existing.categories?.slug || '';
  if (body.categoryId !== undefined && String(body.categoryId) !== String(existing.category_id)) {
    categorySlug = (await resolveListingCategorySlug(body.categoryId)) || categorySlug;
  } else if (!categorySlug && existing.category_id) {
    categorySlug = (await resolveListingCategorySlug(existing.category_id)) || '';
  }
  applyListingMaxCapacitySyncToRow(updateData, { categorySlug, existing });

  // Stage 201.65 — draft save must never leave the row in trash (partner list filters is_deleted).
  {
    const mergedMetaNow =
      updateData.metadata !== undefined ? updateData.metadata : existing.metadata || {}
    const wantsDraftKeep =
      mergedMetaNow?.is_draft === true ||
      mergedMetaNow?.is_draft === 'true' ||
      body.metadata?.is_draft === true ||
      body.metadata?.is_draft === 'true'
    if (wantsDraftKeep) {
      const wasTrashed = isListingSoftDeleted({ metadata: mergedMetaNow })
      const cleared = clearSoftDeleteMetadata(mergedMetaNow)
      cleared.is_draft = true
      updateData.metadata = cleared
      if (wasTrashed) {
        if (body.status === undefined && updateData.status === undefined) {
          updateData.status = 'INACTIVE'
        }
        const syncSrc =
          updateData.sync_settings !== undefined ? updateData.sync_settings : existing.sync_settings
        const syncPatch = buildRestoredSyncSettingsPatch(syncSrc)
        if (syncPatch) updateData.sync_settings = syncPatch
      }
    }
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

  if (locationCapture && updated?.id) {
    scheduleLocationSuggestionCapture({
      ...locationCapture,
      suggested_by_listing_id: updated.id,
    });
  }

  if (Object.prototype.hasOwnProperty.call(updateData, 'instant_booking')) {
    const { error: profileSyncError } = await supabase
      .from('profiles')
      .update({
        instant_booking: updateData.instant_booking === true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.owner_id);
    if (profileSyncError) {
      console.warn('[PARTNER-LISTING] instant booking profile sync failed:', profileSyncError.message);
    }
  }
  
  console.log('[PARTNER-LISTING] Updated successfully');

  try {
    await revalidateListingPaths('update', listingId);
  } catch (e) {
    console.warn('[PARTNER-LISTING] revalidate:', e?.message);
  }

  if (
    body.title !== undefined ||
    body.description !== undefined ||
    body.district !== undefined ||
    body.categoryId !== undefined
  ) {
    scheduleListingEmbeddingRefresh(listingId);
  }
  
  return NextResponse.json({
    success: true,
    listing: updated
  });
}

/**
 * DELETE /api/v2/partner/listings/[id]
 * Soft delete a listing (`INACTIVE` + `metadata.is_deleted`)
 * Keeps message history, bookings, and media for a future Restore
 */
export async function DELETE(request, context) {
  const params = await Promise.resolve(context.params);
  const listingId = params.id;
  
  console.log('[PARTNER-LISTING] SOFT DELETE listing:', listingId);
  
  const auth = await getPartnerFromSession();
  if (auth.error) return auth.error;
  const { userId, userRole } = auth;
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // First get listing to check ownership (+ sync_settings to pause iCal)
  const { data: listing } = await supabase
    .from('listings')
    .select('owner_id, images, status, metadata, sync_settings')
    .eq('id', listingId)
    .single();
  
  if (!listing) {
    return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
  }
  
  if (userRole !== 'ADMIN' && listing.owner_id !== userId) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }
  
  // Soft delete: enum `DELETED` may be absent — use INACTIVE + metadata flag (see listing-embedding-policy.js)
  const prevMeta =
    listing.metadata && typeof listing.metadata === 'object' && !Array.isArray(listing.metadata)
      ? listing.metadata
      : {}
  const nextSync = buildSoftDeleteSyncSettingsPatch(listing.sync_settings)

  const { error } = await supabase
    .from('listings')
    .update({
      status: 'INACTIVE',
      available: false,
      metadata: {
        ...prevMeta,
        ...buildSoftDeleteMetadataFields({
          userId,
          previousStatus: listing.status,
        }),
      },
      ...(nextSync ? { sync_settings: nextSync } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId);
  
  if (error) {
    console.error('[PARTNER-LISTING] Soft delete error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  
  console.log('[PARTNER-LISTING] Soft deleted successfully');

  try {
    await revalidateListingPaths('delete', listingId);
  } catch (e) {
    console.warn('[PARTNER-LISTING] revalidate:', e?.message);
  }
  
  // Note: Images are kept in storage for potential restoration
  // They will be cleaned up by the cleanup-drafts cron if needed
  
  return NextResponse.json({ success: true, softDeleted: true });
}
