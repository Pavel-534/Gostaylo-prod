/**
 * Shared GET handler for listing search (used by /api/v2/search and /api/v2/listings/search).
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { CalendarService } from '@/lib/services/calendar.service';
import { rateLimitCheck } from '@/lib/rate-limit';
import { getDistrictsForCity } from '@/lib/locations/city-district-map';
import { toPublicImageUrl, mapPublicImageUrls } from '@/lib/public-image-url';
import { normalizeListingCategorySlugForSearch } from '@/lib/listing-category-slug';
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
import { resolveListingGuestCapacity } from '@/lib/listing-guest-capacity';
import { isMarkedE2eTestData } from '@/lib/e2e/test-data-tag';
import { ReputationService } from '@/lib/services/reputation.service';
import {
  REPUTATION_SEARCH_POSITION_BOOST_BY_TIER,
  REPUTATION_SEARCH_TIER_MULTIPLIER,
  REPUTATION_SEARCH_FEATURED_WEIGHT,
  computeSlaSearchBoost,
} from '@/lib/config/reputation-ranking';
import {
  fetchActivePromoRowsForCatalog,
  computeCatalogPromoBadgeForListing,
  computeCatalogFlashUrgencyForListing,
  computeCatalogFlashSocialProofForListing,
  fetchBookingsCreatedTodayCountsByPromoCodes,
  searchNightsBetween,
} from '@/lib/promo/catalog-promo-badges';

const LISTINGS_SELECT = `
        *,
        rating,
        reviews_count,
        categories (id, name, slug, icon),
        owner:profiles!owner_id (id, first_name, last_name, is_verified)
      `;

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildTextSearchOr(q) {
  if (!q || q.trim().length < 2) return null;
  const words = q.trim().split(/\s+/).filter(w => w.length >= 2);
  if (words.length === 0) return null;
  const parts = [];
  for (const w of words) {
    const esc = w.replace(/'/g, "''");
    parts.push(`title.ilike.%${esc}%`, `description.ilike.%${esc}%`, `district.ilike.%${esc}%`);
  }
  return parts.join(',');
}

function matchesAllWords(listing, words) {
  const text = `${listing.title || ''} ${listing.description || ''} ${listing.district || ''}`.toLowerCase();
  return words.every(w => text.includes(w.toLowerCase()));
}

function districtEqForOrClause(district) {
  const d = String(district);
  if (/^[a-zA-Z0-9_-]+$/.test(d)) {
    return `district.eq.${d}`;
  }
  return `district.eq."${d.replace(/"/g, '\\"')}"`;
}

function applySmartWhereFilter(query, whereValue) {
  if (!whereValue || whereValue === 'all') return query;
  const cityJson = JSON.stringify({ city: whereValue });
  const districts = getDistrictsForCity(whereValue);
  if (districts?.length) {
    const parts = [`metadata.cs.${cityJson}`, ...districts.map(districtEqForOrClause)];
    return query.or(parts.join(','));
  }
  return query.or(`metadata.cs.${cityJson},district.ilike.%${whereValue}%`);
}

const cache = { data: null, timestamp: 0, TTL: 60 * 1000 };
const categorySlugCache = new Map();
const CATEGORY_CACHE_TTL_MS = 10 * 60 * 1000;

function parseMapBounds(sp) {
  const south = parseFloat(sp.get('south'));
  const north = parseFloat(sp.get('north'));
  const west = parseFloat(sp.get('west'));
  const east = parseFloat(sp.get('east'));
  if (![south, north, west, east].every((n) => Number.isFinite(n))) return null;
  if (south >= north) return null;
  if (west >= east) return null;
  return { south, north, west, east };
}

function listingLatLngRaw(listing) {
  const lat = parseFloat(listing.latitude ?? listing.metadata?.latitude ?? listing.metadata?.lat);
  const lng = parseFloat(listing.longitude ?? listing.metadata?.longitude ?? listing.metadata?.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

function pointInBounds(lat, lng, b) {
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
}

function firstFloatParam(sp, ...keys) {
  for (const k of keys) {
    const v = sp.get(k);
    if (v != null && v !== '') {
      const n = parseFloat(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function sortListingsByReputationRanking(listings, trustByOwner) {
  const n = listings.length
  const boost = REPUTATION_SEARCH_POSITION_BOOST_BY_TIER
  const mult = REPUTATION_SEARCH_TIER_MULTIPLIER
  const fw = REPUTATION_SEARCH_FEATURED_WEIGHT
  const scored = listings.map((l, i) => {
    const t = trustByOwner.get(String(l.owner_id))
    const tier = (t?.tier && String(t.tier).toUpperCase()) || 'NEW'
    const b = boost[tier] ?? boost.DEFAULT ?? 0
    const m = mult[tier] ?? mult.DEFAULT ?? 1
    const featured = l.is_featured ? fw : 0
    const sla = computeSlaSearchBoost(t?.avgInitialResponseMinutes30d, t?.initialResponseSampleCount30d ?? 0)
    const base = (n - i) * m + b + sla
    const score = featured + base
    return { l, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.map((x) => x.l)
}

function getCacheKey(filters) {
  if (filters.checkIn || filters.checkOut || filters.lat != null || filters.lon != null) return null;
  if (filters.mapBounds) return null;
  if (metadataFiltersActive(filters.metadataFilters)) return null;
  const where = filters.where || filters.location || filters.city || 'all';
  const sem = filters.semantic ? 'sem1' : 'sem0';
  return `${filters.category || 'all'}_${filters.limit}_${where}_${filters.q || ''}_${filters.minPrice || ''}_${filters.maxPrice || ''}_${sem}`;
}

function normalizeRadiusBoundingBox(lat, lon, radiusKm) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radiusKm) || radiusKm <= 0) return null;
  const deltaLat = radiusKm / 111.32;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const lonDiv = Math.max(0.01, Math.abs(cosLat));
  const deltaLon = radiusKm / (111.32 * lonDiv);
  return {
    south: lat - deltaLat,
    north: lat + deltaLat,
    west: lon - deltaLon,
    east: lon + deltaLon,
  };
}

async function resolveCategoryIdBySlug(slug) {
  if (!slug || !supabaseAdmin) return null;
  const now = Date.now();
  const cached = categorySlugCache.get(slug);
  if (cached && now - cached.ts < CATEGORY_CACHE_TTL_MS) {
    return cached.id;
  }
  try {
    const { data: cat, error: catError } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('slug', slug)
      .single();
    if (!catError && cat?.id) {
      categorySlugCache.set(slug, { id: cat.id, ts: now });
      return cat.id;
    }
  } catch (e) {
    console.warn('[SEARCH API] Categories filter error:', e?.message);
  }
  return null;
}

/**
 * @param {Request} request
 * @param {{ skipRateLimit?: boolean }} [options] — для SSR (sitemap/ItemList), без учёта в лимите search
 */
export async function runListingsSearchGet(request, options = {}) {
  if (!options.skipRateLimit) {
    const rl = rateLimitCheck(request, 'search');
    if (rl) {
      return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers });
    }
    const { searchParams: sp0 } = new URL(request.url);
    if (sp0.get('semantic') === '1' && (sp0.get('q') || '').trim().length >= 2) {
      const srl = rateLimitCheck(request, 'semantic_search');
      if (srl) {
        return NextResponse.json(srl.body, { status: srl.status, headers: srl.headers });
      }
    }
  }

  try {
    const { searchParams } = new URL(request.url);

    const minPrice = firstFloatParam(searchParams, 'min_price', 'minPrice');
    const maxPrice = firstFloatParam(searchParams, 'max_price', 'maxPrice');
    const metadataFilters = buildMetadataFiltersFromSearchParams(searchParams);
    const semanticOn = searchParams.get('semantic') === '1';

    const filters = {
      q: searchParams.get('q'),
      semantic: semanticOn,
      where: searchParams.get('where'),
      location: searchParams.get('location'),
      city: searchParams.get('city'),
      lat: parseFloat(searchParams.get('lat')) || null,
      lon: parseFloat(searchParams.get('lon')) || null,
      radiusKm: parseFloat(searchParams.get('radiusKm')) || 50,
      category: normalizeListingCategorySlugForSearch(searchParams.get('category')),
      checkIn: searchParams.get('checkIn'),
      checkOut: searchParams.get('checkOut'),
      checkInTime: searchParams.get('checkInTime'),
      checkOutTime: searchParams.get('checkOutTime'),
      guests: parseInt(searchParams.get('guests'), 10) || null,
      minPrice,
      maxPrice,
      limit: parseInt(searchParams.get('limit'), 10) || 50,
      featured: searchParams.get('featured') !== 'false',
      mapBounds: parseMapBounds(searchParams),
      metadataFilters,
    };

    console.log('[SEARCH API v3] Filters:', JSON.stringify(filters));

    const cacheKey = getCacheKey(filters);
    const now = Date.now();

    if (cacheKey && cache.data && cache.key === cacheKey && (now - cache.timestamp) < cache.TTL) {
      console.log('[SEARCH API v3] Returning cached data');
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

    const categoryId =
      filters.category && filters.category !== 'all'
        ? await resolveCategoryIdBySlug(filters.category)
        : null;

    const geoCenter = filters.lat != null && filters.lon != null;
    const bbox = filters.mapBounds;
    const centerBbox = geoCenter ? normalizeRadiusBoundingBox(filters.lat, filters.lon, filters.radiusKm) : null;
    const metaHeavy = metadataFiltersActive(filters.metadataFilters);
    const fetchLimit =
      geoCenter || bbox || metaHeavy ? Math.min(Math.max(filters.limit, 100) * 5, 500) : filters.limit;

    const textOrClause = buildTextSearchOr(filters.q);

    /** Одна и та же выборка: с текстовым OR или без (fallback при пустой выдаче). */
    function buildListingsQuery(includeTextSearchOr) {
      let q = supabaseAdmin
        .from('listings')
        .select(LISTINGS_SELECT)
        .eq('status', 'ACTIVE');

      if (filters.featured) {
        q = q.order('is_featured', { ascending: false });
      }
      q = q.order('created_at', { ascending: false });
      q = q.limit(fetchLimit);

      if (includeTextSearchOr && textOrClause) {
        q = q.or(textOrClause);
      }

      if (filters.where && filters.where !== 'all') {
        q = applySmartWhereFilter(q, filters.where);
      } else {
        if (filters.city && filters.city !== 'all') {
          q = q.contains('metadata', { city: filters.city });
        }
        if (filters.location && filters.location !== 'all') {
          q = q.ilike('district', `%${filters.location}%`);
        }
      }

      if (categoryId) {
        q = q.eq('category_id', categoryId);
      }
      const dbBbox = bbox || centerBbox;
      if (dbBbox) {
        q = q
          .gte('latitude', dbBbox.south)
          .lte('latitude', dbBbox.north)
          .gte('longitude', dbBbox.west)
          .lte('longitude', dbBbox.east);
      }

      if (filters.minPrice) {
        q = q.gte('base_price_thb', filters.minPrice);
      }
      if (filters.maxPrice) {
        q = q.lte('base_price_thb', filters.maxPrice);
      }

      return q;
    }

    let { data: rawListings, error } = await buildListingsQuery(true);

    if (error) {
      console.error('[SEARCH API] Query error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    let textSearchRelaxed = false;
    const qTrim = String(filters.q || '').trim();
    if ((rawListings?.length ?? 0) === 0 && qTrim.length >= 2 && textOrClause) {
      console.warn(
        '[SEARCH API v3] DB returned 0 rows with text ilike OR; retrying without q (same filters otherwise). q=',
        qTrim,
      );
      const resRelaxed = await buildListingsQuery(false);
      error = resRelaxed.error;
      if (error) {
        console.error('[SEARCH API] Relaxed query error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      rawListings = resRelaxed.data;
      textSearchRelaxed = true;
      console.log('[SEARCH API v3] Relaxed query row count:', rawListings?.length ?? 0);
    }

    let listings = (rawListings || []).filter((row) => !isMarkedE2eTestData(row));

    console.log('[SEARCH API v3] After Supabase:', {
      rowCount: listings.length,
      idsSample: listings.slice(0, 15).map((l) => l.id),
      hadTextOr: !!textOrClause,
      textSearchRelaxed,
    });

    if (filters.lat != null && filters.lon != null && filters.radiusKm > 0) {
      listings = listings
        .filter(l => {
          const lat = parseFloat(l.latitude ?? l.metadata?.latitude ?? l.metadata?.lat);
          const lon = parseFloat(l.longitude ?? l.metadata?.longitude ?? l.metadata?.lng);
          if (isNaN(lat) || isNaN(lon)) return false;
          return haversineKm(filters.lat, filters.lon, lat, lon) <= filters.radiusKm;
        })
        .slice(0, filters.limit);
    }

    if (filters.q) {
      const words = filters.q.trim().split(/\s+/).filter(w => w.length >= 2);
      if (words.length > 1) {
        const beforeMw = listings.length;
        const filteredMw = listings.filter((l) => matchesAllWords(l, words));
        if (filteredMw.length === 0 && beforeMw > 0) {
          console.warn(
            '[SEARCH API v3] matchesAllWords would empty results (e.g. RU query vs EN text); keeping broader DB set',
          );
        } else {
          listings = filteredMw;
        }
        console.log('[SEARCH API v3] matchesAllWords filter:', { before: beforeMw, after: listings.length, words });
      }
    }

    const semanticHits = await semanticPromise;
    console.log('[SEARCH API v3] Semantic hits (from fetchSemanticListingMatches, already ≥ minSimilarity):', {
      count: semanticHits.length,
      idSim: semanticHits.slice(0, 40).map((h) => ({ id: h.id, similarity: h.similarity })),
    });

    const listingsBeforeMerge = listings.length;
    if (semanticHits.length > 0) {
      listings = mergeSemanticHitsIntoListingOrder(listings, semanticHits, SEMANTIC_MIN_SIMILARITY);
    }
    console.log('[SEARCH API v3] After mergeSemanticHitsIntoListingOrder:', {
      before: listingsBeforeMerge,
      after: listings.length,
      minSimilarity: SEMANTIC_MIN_SIMILARITY,
    });

    let semanticFallbackInjected = false;
    if (listings.length === 0 && filters.semantic && semanticHits.length > 0 && supabaseAdmin) {
      const orderedIds = semanticHits.map((h) => String(h.id)).filter(Boolean).slice(0, 40);
      let injQ = supabaseAdmin
        .from('listings')
        .select(LISTINGS_SELECT)
        .eq('status', 'ACTIVE')
        .in('id', orderedIds);
      if (categoryId) {
        injQ = injQ.eq('category_id', categoryId);
      }
      const { data: injectedRows, error: injErr } = await injQ;
      if (!injErr && injectedRows?.length) {
        const byId = new Map(injectedRows.map((l) => [String(l.id), l]));
        listings = orderedIds.map((id) => byId.get(id)).filter(Boolean);
        semanticFallbackInjected = listings.length > 0;
        console.log('[SEARCH API v3] Injected semantic-ranked listings (no text overlap)', listings.length);
      } else if (injErr) {
        console.warn('[SEARCH API v3] Semantic id injection failed', injErr.message);
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
    let filteredOutByCapacity = 0;
    const hasDateFilter = !!(filters.checkIn && filters.checkOut);
    const hasBboxFilter = !!bbox;
    const hasMetadataFilter = metadataFiltersActive(filters.metadataFilters);

    for (const listing of listings) {
      const isVehicleListing = String(listing?.categories?.slug || '').toLowerCase() === 'vehicles';
      if (filters.guests) {
        if (!isVehicleListing) {
          const maxGuests = resolveListingGuestCapacity(listing);
          if (maxGuests < filters.guests) {
            filteredOutByCapacity++;
            continue;
          }
        }
      }

      if (hasDateFilter) {
        try {
          const availability = await CalendarService.checkAvailability(
            listing.id,
            filters.checkIn,
            filters.checkOut,
            {
              guestsCount: isVehicleListing ? 1 : Math.max(1, parseInt(filters.guests, 10) || 1),
              listingCategorySlugOverride: isVehicleListing ? 'vehicles' : listing.categories?.slug || null,
            }
          );

          if (!availability?.available) {
            filteredOutByAvailability++;
            continue;
          }

          listing._pricing = availability?.pricing || null;
        } catch (err) {
          console.warn(`[SEARCH API] Availability check failed for ${listing.id}:`, err?.message);
        }
      }

      availableListings.push(listing);
    }

    console.log('[SEARCH API v3] After availability/capacity loop:', {
      listingsIn: listings.length,
      availableOut: availableListings.length,
      filteredOutByAvailability,
      filteredOutByCapacity,
      hasDateFilter,
    });

    const defaultListingCommission = await resolveDefaultCommissionPercent();

    const ownerIdsForTrust = [...new Set(availableListings.map((l) => l.owner_id).filter(Boolean))]
    let trustByOwner = new Map()
    try {
      trustByOwner = await ReputationService.getPartnersTrustPublicBatch(ownerIdsForTrust)
    } catch (e) {
      console.warn('[SEARCH API v3] partner trust batch failed', e?.message)
    }

    const rankedListings = sortListingsByReputationRanking(availableListings, trustByOwner)

    const catalogSearchNights = searchNightsBetween(filters.checkIn, filters.checkOut)
    let promoRowsForCatalog = []
    try {
      promoRowsForCatalog = await fetchActivePromoRowsForCatalog(supabaseAdmin)
    } catch (e) {
      console.warn('[SEARCH API v3] catalog promo rows failed', e?.message)
    }

    const flashCodesForToday = (promoRowsForCatalog || [])
      .filter((p) => p.is_flash_sale)
      .map((p) => String(p.code || '').trim().toUpperCase())
      .filter(Boolean)
    let flashTodayCounts = new Map()
    try {
      flashTodayCounts = await fetchBookingsCreatedTodayCountsByPromoCodes(supabaseAdmin, flashCodesForToday)
    } catch (e) {
      console.warn('[SEARCH API v3] flash social counts failed', e?.message)
    }

    const transformed = rankedListings.map(l => ({
      id: l.id,
      ownerId: l.owner_id,
      categoryId: l.category_id,
      categorySlug: l.categories?.slug ?? null,
      category: l.categories,
      status: l.status,
      title: l.title,
      description: l.description,
      district: l.district,
      city: l.metadata?.city || null,
      latitude:
        (l.latitude ?? l.metadata?.latitude ?? l.metadata?.lat) != null
          ? parseFloat(l.latitude ?? l.metadata?.latitude ?? l.metadata?.lat)
          : null,
      longitude:
        (l.longitude ?? l.metadata?.longitude ?? l.metadata?.lng) != null
          ? parseFloat(l.longitude ?? l.metadata?.longitude ?? l.metadata?.lng)
          : null,
      basePriceThb: parseFloat(l.base_price_thb),
      commissionRate: (() => {
        const n = parseFloat(l.commission_rate);
        return Number.isFinite(n) && n >= 0 ? n : defaultListingCommission;
      })(),
      images: mapPublicImageUrls(l.images || []),
      coverImage: l.cover_image ? toPublicImageUrl(l.cover_image) : null,
      metadata: l.metadata || {},
      maxCapacity: (() => {
        const n = parseInt(l.max_capacity, 10)
        return Number.isFinite(n) && n > 0 ? n : null
      })(),
      bedrooms: l.metadata?.bedrooms || 0,
      bathrooms: l.metadata?.bathrooms || 0,
      area: l.metadata?.area || 0,
      available: l.available,
      isFeatured: l.is_featured,
      views: l.views || 0,
      bookingsCount: l.bookings_count || 0,
      rating: parseFloat(l.rating) || 0,
      reviewsCount: l.reviews_count || 0,
      createdAt: l.created_at,
      owner: l.owner,
      partnerTrust: l.owner_id ? trustByOwner.get(String(l.owner_id)) || null : null,
      pricing: l._pricing || null,
      catalog_promo_badge: computeCatalogPromoBadgeForListing(l, promoRowsForCatalog, catalogSearchNights),
      catalog_flash_urgency: computeCatalogFlashUrgencyForListing(l, promoRowsForCatalog),
      catalog_flash_social_proof: computeCatalogFlashSocialProofForListing(
        l,
        promoRowsForCatalog,
        flashTodayCounts,
      ),
    }));

    const responseData = {
      listings: transformed,
      filters: {
        applied: Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== null && v !== undefined && v !== '')
        ),
        hasDateFilter,
      },
      meta: {
        total: listings.length,
        available: transformed.length,
        filteredOutByAvailability,
        filteredOutByCapacity,
        availabilityFiltered: hasDateFilter,
        mapBoundsFiltered: hasBboxFilter,
        metadataFiltered: hasMetadataFilter,
        semanticBlended: filters.semantic && semanticHits.length > 0,
        semanticMinSimilarity: filters.semantic ? SEMANTIC_MIN_SIMILARITY : null,
        textSearchRelaxed,
        semanticFallbackInjected,
        stage: 'smart-v3',
        reputationRankingApplied: true,
      },
    };

    if (cacheKey) {
      cache.data = responseData;
      cache.key = cacheKey;
      cache.timestamp = now;
      console.log('[SEARCH API v3] Data cached with key:', cacheKey);
    }

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
