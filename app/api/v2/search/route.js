/**
 * Gostaylo - Search API (v2) - Smart Search
 * GET /api/v2/search - Search listings with availability, geo, full-text
 * 
 * Query Parameters:
 * - q: Full-text search (flexible order, words in any order)
 * - location: District filter
 * - city: City filter (hierarchy: city -> district)
 * - lat, lon, radiusKm: Geo-search by radius (Haversine)
 * - category, checkIn, checkOut, guests, minPrice, maxPrice, limit, featured
 * 
 * @updated 2026-03-19
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { CalendarService } from '@/lib/services/calendar.service';
import { rateLimitCheck } from '@/lib/rate-limit';
import { getDistrictsForCity } from '@/lib/locations/city-district-map';
import { toStorageProxyUrl } from '@/lib/supabase-proxy-urls';

// Haversine distance in km
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Build Supabase OR filter: any word in title, description, or district
// Escape % for ilike
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

// Filter listings to require ALL words present (flexible order)
function matchesAllWords(listing, words) {
  const text = `${listing.title || ''} ${listing.description || ''} ${listing.district || ''}`.toLowerCase();
  return words.every(w => text.includes(w.toLowerCase()));
}

/** PostgREST .or() фрагмент district.eq.<value> (значения со пробелами — в кавычках) */
function districtEqForOrClause(district) {
  const d = String(district);
  if (/^[a-zA-Z0-9_-]+$/.test(d)) {
    return `district.eq.${d}`;
  }
  return `district.eq."${d.replace(/"/g, '\\"')}"`;
}

/**
 * Фильтр «Куда»: город = все районы этого города + metadata.city, а не только ILIKE по названию города.
 */
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

function getCacheKey(filters) {
  if (filters.checkIn || filters.checkOut || filters.lat != null || filters.lon != null) return null;
  const where = filters.where || filters.location || filters.city || 'all';
  return `${filters.category || 'all'}_${filters.limit}_${where}_${filters.q || ''}`;
}

export async function GET(request) {
  const rl = rateLimitCheck(request, 'search');
  if (rl) {
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers });
  }

  try {
    const { searchParams } = new URL(request.url);
    
    const filters = {
      q: searchParams.get('q'),
      where: searchParams.get('where'), // Single param: city OR district (smart)
      location: searchParams.get('location'),
      city: searchParams.get('city'),
      lat: parseFloat(searchParams.get('lat')) || null,
      lon: parseFloat(searchParams.get('lon')) || null,
      radiusKm: parseFloat(searchParams.get('radiusKm')) || 50,
      category: searchParams.get('category'),
      checkIn: searchParams.get('checkIn'),
      checkOut: searchParams.get('checkOut'),
      guests: parseInt(searchParams.get('guests')) || null,
      minPrice: parseFloat(searchParams.get('minPrice')) || null,
      maxPrice: parseFloat(searchParams.get('maxPrice')) || null,
      limit: parseInt(searchParams.get('limit')) || 50,
      featured: searchParams.get('featured') !== 'false'
    };
    
    console.log('[SEARCH API v3] Filters:', JSON.stringify(filters));
    
    // Check cache for home page requests (no date filter)
    const cacheKey = getCacheKey(filters);
    const now = Date.now();
    
    if (cacheKey && cache.data && cache.key === cacheKey && (now - cache.timestamp) < cache.TTL) {
      console.log('[SEARCH API v3] Returning cached data');
      return NextResponse.json({
        success: true,
        data: cache.data,
        cached: true
      }, {
        headers: { 
          'Cache-Control': 'public, max-age=60',
          'X-Cache': 'HIT'
        }
      });
    }
    
    // Build base query - ONLY ACTIVE listings
    let query = supabaseAdmin
      .from('listings')
      .select(`
        *,
        rating,
        reviews_count,
        categories (id, name, slug, icon),
        owner:profiles!owner_id (id, first_name, last_name)
      `)
      .eq('status', 'ACTIVE');
    
    // Apply ordering
    if (filters.featured) {
      query = query.order('is_featured', { ascending: false });
    }
    query = query.order('created_at', { ascending: false });
    // When geo filter: fetch more to allow distance filtering
    const fetchLimit = (filters.lat != null && filters.lon != null) ? Math.min(filters.limit * 10, 500) : filters.limit;
    query = query.limit(fetchLimit);
    
    // Full-text search (flexible word order)
    const textOr = buildTextSearchOr(filters.q);
    if (textOr) {
      query = query.or(textOr);
    }
    
    // Smart "where" — город разворачивается в районы (см. city-district-map)
    if (filters.where && filters.where !== 'all') {
      query = applySmartWhereFilter(query, filters.where);
    } else {
      // Legacy: separate city/location
      if (filters.city && filters.city !== 'all') {
        query = query.contains('metadata', { city: filters.city });
      }
      if (filters.location && filters.location !== 'all') {
        query = query.ilike('district', `%${filters.location}%`);
      }
    }
    
    // Apply category filter
    if (filters.category && filters.category !== 'all') {
      try {
        const { data: cat, error: catError } = await supabaseAdmin
          .from('categories')
          .select('id')
          .eq('slug', filters.category)
          .single();
        
        if (!catError && cat) {
          query = query.eq('category_id', cat.id);
        }
      } catch (e) {
        console.warn('[SEARCH API] Categories filter error:', e?.message);
      }
    }
    
    // Apply price filters
    if (filters.minPrice) {
      query = query.gte('base_price_thb', filters.minPrice);
    }
    if (filters.maxPrice) {
      query = query.lte('base_price_thb', filters.maxPrice);
    }
    
    // Execute query
    const { data: rawListings, error } = await query;
    
    if (error) {
      console.error('[SEARCH API] Query error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    let listings = rawListings || [];
    
    // Geo filter by radius (Haversine)
    if (filters.lat != null && filters.lon != null && filters.radiusKm > 0) {
      listings = listings
        .filter(l => {
          const lat = parseFloat(l.latitude ?? l.metadata?.latitude ?? l.metadata?.lat);
          const lon = parseFloat(l.longitude ?? l.metadata?.longitude ?? l.metadata?.lng);
          if (isNaN(lat) || isNaN(lon)) return false;
          return haversineKm(filters.lat, filters.lon, lat, lon) <= filters.radiusKm;
        })
        .slice(0, filters.limit); // Trim to requested limit
    }
    
    // Multi-word text filter (all words must appear)
    if (filters.q) {
      const words = filters.q.trim().split(/\s+/).filter(w => w.length >= 2);
      if (words.length > 1) {
        listings = listings.filter(l => matchesAllWords(l, words));
      }
    }
    
    // =====================================================
    // AVAILABILITY & CAPACITY FILTERING (when dates provided)
    // =====================================================
    let availableListings = [];
    let filteredOutByAvailability = 0;
    let filteredOutByCapacity = 0;
    const hasDateFilter = !!(filters.checkIn && filters.checkOut);
    
    for (const listing of listings) {
      // --- CAPACITY FILTER ---
      if (filters.guests) {
        const maxGuests = listing.metadata?.max_guests || listing.metadata?.guests || 10;
        if (maxGuests < filters.guests) {
          filteredOutByCapacity++;
          continue;
        }
      }
      
      // --- AVAILABILITY FILTER ---
      if (hasDateFilter) {
        try {
          const availability = await CalendarService.checkAvailability(
            listing.id,
            filters.checkIn,
            filters.checkOut
          );
          
          if (!availability?.available) {
            filteredOutByAvailability++;
            continue;
          }
          
          // Add pricing info for available listings
          listing._pricing = availability?.pricing || null;
        } catch (err) {
          console.warn(`[SEARCH API] Availability check failed for ${listing.id}:`, err?.message);
          // Include listing if availability check fails (graceful degradation)
        }
      }
      
      availableListings.push(listing);
    }
    
    // Transform for frontend
    const transformed = availableListings.map(l => ({
      id: l.id,
      ownerId: l.owner_id,
      categoryId: l.category_id,
      category: l.categories,
      status: l.status,
      title: l.title,
      description: l.description,
      district: l.district,
      city: l.metadata?.city || null,
      latitude: (l.latitude ?? l.metadata?.latitude ?? l.metadata?.lat) != null ? parseFloat(l.latitude ?? l.metadata?.latitude ?? l.metadata?.lat) : null,
      longitude: (l.longitude ?? l.metadata?.longitude ?? l.metadata?.lng) != null ? parseFloat(l.longitude ?? l.metadata?.longitude ?? l.metadata?.lng) : null,
      basePriceThb: parseFloat(l.base_price_thb),
      commissionRate: parseFloat(l.commission_rate) || 15,
      images: (l.images || []).map((u) => toStorageProxyUrl(u)).filter(Boolean),
      coverImage: l.cover_image ? toStorageProxyUrl(l.cover_image) : null,
      metadata: l.metadata || {},
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
      pricing: l._pricing || null
    }));
    
    const responseData = {
      listings: transformed,
      filters: {
        applied: Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== null && v !== undefined && v !== '')
        ),
        hasDateFilter
      },
      meta: {
        total: listings.length,
        available: transformed.length,
        filteredOutByAvailability,
        filteredOutByCapacity,
        availabilityFiltered: hasDateFilter,
        stage: 'smart-v3'
      }
    };
    
    // Cache the result if it's a cacheable request
    if (cacheKey) {
      cache.data = responseData;
      cache.key = cacheKey;
      cache.timestamp = now;
      console.log('[SEARCH API v3] Data cached with key:', cacheKey);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: responseData,
      cached: false
    }, {
      headers: { 
        'Cache-Control': hasDateFilter ? 'no-cache, no-store, must-revalidate' : 'public, max-age=60',
        'X-Cache': 'MISS'
      }
    });
    
  } catch (error) {
    console.error('[SEARCH API v3] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
