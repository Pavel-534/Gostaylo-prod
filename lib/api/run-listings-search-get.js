/**
 * Shared GET handler for listing search (used by /api/v2/search and /api/v2/listings/search).
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { rateLimitCheck } from '@/lib/rate-limit';
import { toListingDate } from '@/lib/listing-date';
import { toPublicImageUrl, mapPublicImageUrls } from '@/lib/public-image-url';
import { normalizeListingCategorySlugForSearch } from '@/lib/listing-category-slug';
import { resolveListingCategoryIdsForSearchScope } from '@/lib/api/category-search-scope';
import {
  buildMetadataFiltersFromSearchParams,
  listingMatchesMetadataFilters,
  metadataFiltersActive,
} from '@/lib/search/listing-metadata-filter';
import {
  fetchSemanticListingMatches,
  mergeSemanticHitsIntoListingOrder,
  SEMANTIC_MIN_SIMILARITY,
} from '@/lib/search/semantic-listings';
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service';
import { getCommissionRate } from '@/lib/commission/get-commission-rate-server.js';
import {
  getGuestDisplayPerNight,
  normalizeGuestServiceFeePercent,
} from '@/lib/pricing/guest-display-price.js';
import { isExcludedFromPublicCatalog } from '@/lib/e2e/test-listing-cleanup';
import { ReputationService } from '@/lib/services/reputation.service';
import {
  fetchActivePromoRowsForCatalog,
  computeCatalogPromoBadgeForListing,
  computeCatalogFlashUrgencyForListing,
  computeCatalogFlashSocialProofForListing,
  fetchBookingsCreatedTodayCountsByPromoCodes,
  searchNightsBetween,
} from '@/lib/promo/catalog-promo-badges';
import {
  buildTextSearchOr,
  matchesAllWords,
  parseMapBounds,
  listingLatLngRaw,
  pointInBounds,
  firstFloatParam,
  firstIntParam,
  parseBooleanSearchParam,
  parseAmenitiesFromSearchParams,
  sqlMetadataFiltersActive,
  getCacheKey,
  normalizeRadiusBoundingBox,
} from '@/lib/api/search/params';
import {
  parseSpatialRadiusFromSearchParams,
  spatialRadiusActive,
  fetchListingDistancesWithinRadius,
  buildHaversineDistanceMapForListings,
  filterListingsToSpatialDistanceMap,
} from '@/lib/api/search/spatial-filter';
import { buildListingsQuery, LISTINGS_SELECT } from '@/lib/api/search/query-builder';
import { LISTINGS_SELECT_LITE, pickLiteListingMetadata } from '@/lib/api/search/listing-search-payload';
import { listingQualifiesForTrustVerifiedMiniBadge } from '@/lib/listing-card-spec-profile';
import { insertCatalogVerifiedMajoritySnapshot } from '@/lib/services/telemetry/catalog-verified-snapshot';
import { filterListingsByAvailability } from '@/lib/api/search/availability';
import {
  fetchContactLeakStrikesByOwnerIds,
  resolveContactLeakSearchPenaltySettings,
} from '@/lib/contact-safety/partner-search-penalty';
import {
  parseCatalogSort,
  applyCatalogSort,
  catalogSortUsesDistance,
} from '@/lib/recommendations/ranking-policy';
import {
  computePriceHistogramBins,
  listingMatchesSearchPriceRange,
} from '@/lib/search/effective-unit-price-for-search';
import { LISTINGS_PRICE_SLIDER_MAX_THB } from '@/lib/search/listings-page-url';
import { fetchPublicCoordinateViewerContext, coordinateRevealLevelForListing } from '@/lib/geo/public-coordinate-viewer-context';
import { serializePublicCoordinates } from '@/lib/geo/listing-public-coordinates';
import { getSessionPayload } from '@/lib/services/session-service';
import { recordSearchPerformanceMetrics } from '@/lib/api/search/search-performance-metrics';
export { applySmartWhereFilter } from '@/lib/api/search/location-filter';

const cache = { data: null, timestamp: 0, TTL: 60 * 1000 };


/**
 * @param {Request} request
 * @param {{ skipRateLimit?: boolean }} [options] — для SSR (sitemap/ItemList), без учёта в лимите search
 */
export async function runListingsSearchGet(request, options = {}) {
  /** Default lite catalog payload (routes pass explicit `isLite: true`; omit or `false` for full row shape). */
  const isLite = options.isLite !== false;

  if (!options.skipRateLimit) {
    const { searchParams: sp0 } = new URL(request.url);
    const spatialCatalog =
      parseMapBounds(sp0) != null ||
      spatialRadiusActive(parseSpatialRadiusFromSearchParams(sp0));
    let sessionUserId = null;
    if (spatialCatalog) {
      try {
        const session = await getSessionPayload();
        sessionUserId = session?.userId || session?.sub || null;
      } catch {
        sessionUserId = null;
      }
    }
    const rl = await rateLimitCheck(
      request,
      spatialCatalog ? (sessionUserId ? 'spatial_catalog_user' : 'spatial_catalog') : 'search',
      sessionUserId || undefined,
    );
    if (rl) {
      return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers });
    }
    if (sp0.get('semantic') === '1' && (sp0.get('q') || '').trim().length >= 2) {
      const srl = await rateLimitCheck(request, 'semantic_search');
      if (srl) {
        return NextResponse.json(srl.body, { status: srl.status, headers: srl.headers });
      }
    }
  }

  try {
    const requestStarted = Date.now();
    const { searchParams } = new URL(request.url);
    const rawCheckIn = searchParams.get('checkIn');
    const rawCheckOut = searchParams.get('checkOut');
    const normalizedCheckIn = toListingDate(rawCheckIn);
    const normalizedCheckOut = toListingDate(rawCheckOut);
    const hasValidDateRange = Boolean(
      normalizedCheckIn &&
        normalizedCheckOut &&
        normalizedCheckIn < normalizedCheckOut
    );
    const checkIn = hasValidDateRange ? normalizedCheckIn : null;
    const checkOut = hasValidDateRange ? normalizedCheckOut : null;

    console.info('[SEARCH API] Date filter normalization', {
      rawCheckIn,
      rawCheckOut,
      normalizedCheckIn,
      normalizedCheckOut,
      hasValidDateRange,
    });

    const minPrice = firstFloatParam(searchParams, 'min_price', 'minPrice');
    const maxPrice = firstFloatParam(searchParams, 'max_price', 'maxPrice');
    const metadataFilters = buildMetadataFiltersFromSearchParams(searchParams);
    const semanticOn = searchParams.get('semantic') === '1';
    const spatialRadius = parseSpatialRadiusFromSearchParams(searchParams);

    const filters = {
      q: searchParams.get('q'),
      semantic: semanticOn,
      where: searchParams.get('where'),
      location: searchParams.get('location'),
      city: searchParams.get('city'),
      lat: spatialRadius?.lat ?? null,
      lon: spatialRadius?.lon ?? null,
      radiusKm: spatialRadius?.radiusKm ?? 50,
      category: normalizeListingCategorySlugForSearch(searchParams.get('category')),
      checkIn,
      checkOut,
      checkInTime: searchParams.get('checkInTime'),
      checkOutTime: searchParams.get('checkOutTime'),
      guests: parseInt(searchParams.get('guests'), 10) || null,
      instantBookingOnly: parseBooleanSearchParam(searchParams, 'instant_booking', 'instantBooking') === true,
      bedroomsMin: firstIntParam(searchParams, 'bedrooms', 'bedrooms_min'),
      bathroomsMin: firstIntParam(searchParams, 'bathrooms', 'bathrooms_min'),
      amenities: parseAmenitiesFromSearchParams(searchParams),
      minPrice,
      maxPrice,
      limit: parseInt(searchParams.get('limit'), 10) || 50,
      featured: searchParams.get('featured') !== 'false',
      mapBounds: parseMapBounds(searchParams),
      metadataFilters,
      softAvailability: searchParams.get('softAvailability') !== '0',
      isLite,
    };

    const listingsSelect = isLite ? LISTINGS_SELECT_LITE : LISTINGS_SELECT;

    const cacheKey = getCacheKey(filters);
    const now = Date.now();

    if (cacheKey && cache.data && cache.key === cacheKey && (now - cache.timestamp) < cache.TTL) {
      recordSearchPerformanceMetrics({
        durationMs: Date.now() - requestStarted,
        spatial: false,
        cached: true,
      });
      return NextResponse.json(
        {
          success: true,
          data: cache.data,
          cached: true,
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=60',
            'X-Cache': 'HIT',
          },
        }
      );
    }

    const semanticPromise =
      filters.semantic && filters.q && String(filters.q).trim().length >= 2
        ? fetchSemanticListingMatches(String(filters.q).trim(), {
            matchCount: 100,
            filterStatus: 'ACTIVE',
            logToAiUsage: true,
          })
        : Promise.resolve([]);

    const categoryIds =
      filters.category && filters.category !== 'all'
        ? await resolveListingCategoryIdsForSearchScope(filters.category)
        : null;

    const geoCenter = spatialRadiusActive(spatialRadius);
    const catalogSort = parseCatalogSort(searchParams);
    const spatialSortUsed = catalogSortUsesDistance(catalogSort, geoCenter);
    const bbox = filters.mapBounds;
    const centerBbox = geoCenter ? normalizeRadiusBoundingBox(filters.lat, filters.lon, filters.radiusKm) : null;
    const metaHeavy = metadataFiltersActive(filters.metadataFilters) || sqlMetadataFiltersActive(filters);

    /** @type {import('@/lib/api/search/spatial-filter').SpatialRadiusHit | null} */
    let spatialHit = null;
    if (geoCenter) {
      spatialHit = await fetchListingDistancesWithinRadius(filters.lat, filters.lon, filters.radiusKm);
    }
    const spatialListingIds = spatialHit?.orderedIds ?? null;
    const usedPostgisRadius = spatialHit?.engine === 'postgis';
    /** @type {Map<string, number>} */
    let distanceKmById = spatialHit?.distanceKmById ?? new Map();

    // Fetch with headroom: post-query filters (E2E/test tags, availability, metadata) can shrink small pages too aggressively.
    const fetchLimit =
      geoCenter || bbox || metaHeavy
        ? Math.min(Math.max(filters.limit, 100) * 5, 500)
        : Math.min(Math.max(filters.limit * 5, 50), 500);

    const textOrClause = buildTextSearchOr(filters.q);

    let { data: rawListings, error } = await buildListingsQuery({
      supabaseAdmin,
      filters,
      fetchLimit,
      textOrClause,
      categoryIds,
      bbox,
      centerBbox,
      spatialListingIds: geoCenter ? spatialListingIds : null,
      includeTextSearchOr: true,
      listingsSelect,
    });

    if (error) {
      console.error('[SEARCH API] Query error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    let textSearchRelaxed = false;
    const qTrim = String(filters.q || '').trim();
    if ((rawListings?.length ?? 0) === 0 && qTrim.length >= 2 && textOrClause) {
      const resRelaxed = await buildListingsQuery({
        supabaseAdmin,
        filters,
        fetchLimit,
        textOrClause,
        categoryIds,
        bbox,
        centerBbox,
        spatialListingIds: geoCenter ? spatialListingIds : null,
        includeTextSearchOr: false,
        listingsSelect,
      });
      error = resRelaxed.error;
      if (error) {
        console.error('[SEARCH API] Relaxed query error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      rawListings = resRelaxed.data;
      textSearchRelaxed = true;
    }

    let listings = (rawListings || []).filter((row) => !isExcludedFromPublicCatalog(row));

    if (geoCenter && spatialRadius) {
      if (spatialHit) {
        listings = filterListingsToSpatialDistanceMap(listings, distanceKmById);
      } else {
        const haversineHit = buildHaversineDistanceMapForListings(listings, spatialRadius);
        listings = haversineHit.listings;
        distanceKmById = haversineHit.distanceKmById;
      }
    }

    if (filters.q) {
      const words = filters.q.trim().split(/\s+/).filter(w => w.length >= 2);
      if (words.length > 1) {
        const beforeMw = listings.length;
        const filteredMw = listings.filter((l) => matchesAllWords(l, words));
        if (filteredMw.length === 0 && beforeMw > 0) {
          /* keep broader DB set — cross-language query vs listing text */
        } else {
          listings = filteredMw;
        }
      }
    }

    const semanticHits = await semanticPromise;

    if (semanticHits.length > 0) {
      listings = mergeSemanticHitsIntoListingOrder(listings, semanticHits, SEMANTIC_MIN_SIMILARITY);
    }

    let semanticFallbackInjected = false;
    if (listings.length === 0 && filters.semantic && semanticHits.length > 0 && supabaseAdmin) {
      const orderedIds = semanticHits.map((h) => String(h.id)).filter(Boolean).slice(0, 40);
      let injQ = supabaseAdmin
        .from('listings')
        .select(listingsSelect)
        .eq('status', 'ACTIVE')
        .in('id', orderedIds);
      if (categoryIds?.length) {
        injQ =
          categoryIds.length === 1 ? injQ.eq('category_id', categoryIds[0]) : injQ.in('category_id', categoryIds);
      }
      const { data: injectedRows, error: injErr } = await injQ;
      if (!injErr && injectedRows?.length) {
        const byId = new Map(injectedRows.map((l) => [String(l.id), l]));
        listings = orderedIds.map((id) => byId.get(id)).filter(Boolean);
        semanticFallbackInjected = listings.length > 0;
      } else if (injErr) {
        console.error('[SEARCH API] Semantic id injection failed', injErr.message);
      }
    }

    if (bbox) {
      listings = listings.filter((l) => {
        const ll = listingLatLngRaw(l);
        if (!ll) return false;
        return pointInBounds(ll.lat, ll.lng, bbox);
      });
    }

    if (metadataFiltersActive(filters.metadataFilters)) {
      listings = listings.filter((l) => listingMatchesMetadataFilters(l, filters.metadataFilters));
    }

    let availableListings = [];
    let filteredOutByAvailability = 0;
    let filteredOutByAvailabilityErrors = 0;
    let filteredOutByCapacity = 0;
    let hasDateFilter = false;
    const hasBboxFilter = !!bbox;
    const hasMetadataFilter = metadataFiltersActive(filters.metadataFilters) || sqlMetadataFiltersActive(filters);
    ({
      availableListings,
      filteredOutByAvailability,
      filteredOutByAvailabilityErrors,
      filteredOutByCapacity,
      hasDateFilter,
    } = await filterListingsByAvailability(listings, filters, {
      allowSoftMismatch: filters.softAvailability,
    }));
    console.info('[SEARCH API] Availability batch filter', {
      checkIn: filters.checkIn,
      checkOut: filters.checkOut,
      guests: filters.guests,
      candidates: listings.length,
    });
    console.info('[SEARCH API] Availability batch result', {
      availableListings: availableListings.length,
      filteredOutByAvailability,
      filteredOutByAvailabilityErrors,
      hasDateFilter,
    });

    /** При датах min/max цены считаются по календарной средней (как на карточке), не по SQL base_price_thb. */
    let listingsForRanking = availableListings;
    if (
      hasDateFilter &&
      (filters.minPrice != null || filters.maxPrice != null)
    ) {
      listingsForRanking = availableListings.filter((l) =>
        listingMatchesSearchPriceRange(l, filters.minPrice, filters.maxPrice),
      );
    }

    const commissionSnapshot = await getCommissionRate();
    const defaultListingCommission =
      Number.isFinite(commissionSnapshot?.hostCommissionPercent) &&
      commissionSnapshot.hostCommissionPercent >= 0
        ? commissionSnapshot.hostCommissionPercent
        : await resolveDefaultCommissionPercent();
    const catalogGuestFeePercent = normalizeGuestServiceFeePercent(
      commissionSnapshot?.guestServiceFeePercent,
    );

    const ownerIdsForTrust = [...new Set(listingsForRanking.map((l) => l.owner_id).filter(Boolean))]
    let trustByOwner = new Map()
    let strikesByOwner = new Map()
    let searchPenalty = { enabled: false, penaltyScore: 0, strikeThreshold: 5 }
    try {
      trustByOwner = await ReputationService.getPartnersTrustPublicBatch(ownerIdsForTrust)
    } catch (e) {
      console.error('[SEARCH API] partner trust batch failed', e?.message || e)
    }
    try {
      ;[strikesByOwner, searchPenalty] = await Promise.all([
        fetchContactLeakStrikesByOwnerIds(ownerIdsForTrust),
        resolveContactLeakSearchPenaltySettings(),
      ])
    } catch (e) {
      console.error('[SEARCH API] contact-leak search penalty failed', e?.message || e)
    }

    const rankedListings = applyCatalogSort(listingsForRanking, catalogSort, {
      distanceKmById,
      trustByOwner,
      strikesByOwner,
      searchPenalty,
    }).slice(0, Math.max(1, filters.limit));

    const coordViewerContext = await fetchPublicCoordinateViewerContext();

    const catalogSearchNights = searchNightsBetween(filters.checkIn, filters.checkOut)
    let promoRowsForCatalog = []
    try {
      promoRowsForCatalog = await fetchActivePromoRowsForCatalog(supabaseAdmin)
    } catch (e) {
      console.error('[SEARCH API] catalog promo rows failed', e?.message || e)
    }

    const flashCodesForToday = (promoRowsForCatalog || [])
      .filter((p) => p.is_flash_sale)
      .map((p) => String(p.code || '').trim().toUpperCase())
      .filter(Boolean)
    let flashTodayCounts = new Map()
    try {
      flashTodayCounts = await fetchBookingsCreatedTodayCountsByPromoCodes(supabaseAdmin, flashCodesForToday)
    } catch (e) {
      console.error('[SEARCH API] flash social counts failed', e?.message || e)
    }

    const transformed = rankedListings.map((l) => {
      const imagesMapped = mapPublicImageUrls(l.images || [])
      const imagesOut = isLite ? imagesMapped.slice(0, 3) : imagesMapped
      const metaRaw = l.metadata || {}
      const metadataOut = isLite ? pickLiteListingMetadata(metaRaw) : metaRaw
      const coordReveal = coordinateRevealLevelForListing(l, coordViewerContext)
      const publicCoords = serializePublicCoordinates(l, coordReveal)
      return {
      id: l.id,
      ownerId: l.owner_id,
      categoryId: l.category_id,
      categorySlug: l.categories?.slug ?? null,
      category: l.categories,
      status: l.status,
      title: l.title,
      ...(isLite ? {} : { description: l.description }),
      district: l.district,
      city: metaRaw?.city || null,
      latitude: publicCoords.latitude,
      longitude: publicCoords.longitude,
      isApproximate: publicCoords.isApproximate,
      locationPrivacyMode: publicCoords.locationPrivacyMode,
      ...(geoCenter && distanceKmById.has(String(l.id))
        ? { distance_from_center_km: distanceKmById.get(String(l.id)) }
        : {}),
      instantBooking: l.instant_booking === true,
      basePriceThb: parseFloat(l.base_price_thb),
      guestServiceFeePercent: catalogGuestFeePercent,
      guestDisplayPriceThb: getGuestDisplayPerNight({
        base_price_thb: l.base_price_thb,
        basePriceThb: parseFloat(l.base_price_thb),
        pricing: l._pricing || null,
        guestServiceFeePercent: catalogGuestFeePercent,
      }),
      commissionRate: (() => {
        const n = parseFloat(l.commission_rate);
        return Number.isFinite(n) && n >= 0 ? n : defaultListingCommission;
      })(),
      images: imagesOut,
      coverImage: l.cover_image ? toPublicImageUrl(l.cover_image) : null,
      metadata: metadataOut,
      maxCapacity: (() => {
        const n = parseInt(l.max_capacity, 10)
        return Number.isFinite(n) && n > 0 ? n : null
      })(),
      bedrooms: Number.isFinite(Number(l.bedrooms_count))
        ? Number(l.bedrooms_count)
        : (metaRaw?.bedrooms || 0),
      bathrooms: Number.isFinite(Number(l.bathrooms_count))
        ? Number(l.bathrooms_count)
        : (metaRaw?.bathrooms || 0),
      area: metaRaw?.area || 0,
      available: l.available,
      isFeatured: l.is_featured,
      views: l.views || 0,
      bookingsCount: l.bookings_count || 0,
      rating: parseFloat(l.rating) || 0,
      avgRating: parseFloat(l.avg_rating ?? l.rating) || 0,
      average_rating: parseFloat(l.avg_rating ?? l.rating) || 0,
      reviewsCount: l.reviews_count || 0,
      createdAt: l.created_at,
      owner: l.owner,
      ownerVerified: l.owner?.is_verified === true,
      partnerTrust: l.owner_id ? trustByOwner.get(String(l.owner_id)) || null : null,
      pricing: l._pricing || null,
      is_availability_mismatch: l._isAvailabilityMismatch === true,
      is_promo_applied: Boolean(l._pricing?.is_promo_applied || l._pricing?.isPromoApplied),
      catalog_promo_badge: computeCatalogPromoBadgeForListing(l, promoRowsForCatalog, catalogSearchNights),
      catalog_flash_urgency: computeCatalogFlashUrgencyForListing(l, promoRowsForCatalog),
      catalog_flash_social_proof: computeCatalogFlashSocialProofForListing(
        l,
        promoRowsForCatalog,
        flashTodayCounts,
      ),
    };
    })

    try {
      const total = transformed.length;
      if (total > 0) {
        let verifiedCount = 0;
        for (const row of transformed) {
          if (listingQualifiesForTrustVerifiedMiniBadge(row)) verifiedCount++;
        }
        const share = verifiedCount / total;
        if (share > 0.5) {
          const whereParts = [
            filters.where ?? '',
            filters.location ?? '',
            filters.city ?? '',
          ]
            .map((x) => (x ? String(x).trim() : ''))
            .filter(Boolean)
          const whereHint = whereParts[0]
            ? String(whereParts[0]).slice(0, 48)
            : null;
          const payload = {
            verifiedShareApprox: Number(share.toFixed(4)),
            verifiedCount,
            resultCount: total,
            category: filters.category ?? 'all',
            whereHint,
            mapBoundsFiltered: !!filters.mapBounds,
            semanticBlend: !!(filters.semantic && semanticHits.length > 0),
            payloadProfile: isLite ? 'lite' : 'full',
          };
          console.info('[SEARCH TELEMETRY] catalog_verified_majority_anon', payload);
          await insertCatalogVerifiedMajoritySnapshot(payload);
        }
      }
    } catch {
      /* optional telemetry — never break search response */
    }

    const PRICE_HISTOGRAM_BIN_COUNT = 14;
    const priceHistogramBins = computePriceHistogramBins(transformed, {
      binCount: PRICE_HISTOGRAM_BIN_COUNT,
      maxThb: LISTINGS_PRICE_SLIDER_MAX_THB,
    });

    const responseData = {
      listings: transformed,
      filters: {
        applied: Object.fromEntries(
          Object.entries(filters).filter(
            ([key, v]) => key !== 'isLite' && v !== null && v !== undefined && v !== '',
          ),
        ),
        hasDateFilter,
      },
      meta: {
        total: listings.length,
        available: transformed.length,
        filteredOutByAvailability,
        filteredOutByAvailabilityErrors,
        filteredOutByCapacity,
        availabilityFiltered: hasDateFilter,
        mapBoundsFiltered: hasBboxFilter,
        spatialRadiusFiltered: geoCenter,
        spatialRadiusEngine: geoCenter ? (usedPostgisRadius ? 'postgis' : 'haversine') : null,
        spatialSortUsed: geoCenter ? spatialSortUsed : false,
        catalogSort,
        centerLat: geoCenter ? filters.lat : null,
        centerLng: geoCenter ? filters.lon : null,
        metadataFiltered: hasMetadataFilter,
        semanticBlended: filters.semantic && semanticHits.length > 0,
        semanticMinSimilarity: filters.semantic ? SEMANTIC_MIN_SIMILARITY : null,
        textSearchRelaxed,
        semanticFallbackInjected,
        stage: 'smart-v3',
        reputationRankingApplied: catalogSort === 'recommended',
        payloadProfile: isLite ? 'lite' : 'full',
        priceHistogram: {
          bins: priceHistogramBins,
          binCount: PRICE_HISTOGRAM_BIN_COUNT,
          maxThb: LISTINGS_PRICE_SLIDER_MAX_THB,
          unitSource: hasDateFilter ? 'calendar_avg_per_period' : 'base_listing',
        },
      },
    };

    try {
      const approxBytes = Buffer.byteLength(JSON.stringify(responseData), 'utf8')
      console.info('[SEARCH API] catalog JSON UTF-8 size (compare deploys: lite vs historical full)', {
        payloadProfile: responseData.meta.payloadProfile,
        approxBytes,
        approxKb: (approxBytes / 1024).toFixed(2),
        listingCount: transformed.length,
      })
    } catch {
      /* ignore size telemetry */
    }

    if (cacheKey) {
      cache.data = responseData;
      cache.key = cacheKey;
      cache.timestamp = now;
    }

    recordSearchPerformanceMetrics({
      durationMs: Date.now() - requestStarted,
      spatial: Boolean(geoCenter || bbox),
      cached: false,
    });

    return NextResponse.json(
      {
        success: true,
        data: responseData,
        cached: false,
      },
      {
        headers: {
          'Cache-Control':
            hasDateFilter || hasBboxFilter || hasMetadataFilter
              ? 'no-cache, no-store, must-revalidate'
              : 'public, max-age=60',
          'X-Cache': 'MISS',
        },
      }
    );
  } catch (error) {
    console.error('[SEARCH API v3] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
