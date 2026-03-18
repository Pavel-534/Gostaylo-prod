/**
 * Gostaylo - Search API (v2) - STAGE 3: Smart Home Page
 * GET /api/v2/search - Search listings with availability filter
 * 
 * Query Parameters:
 * - q: Search query (text)
 * - location: District/area filter
 * - category: Category slug filter (default: null = all categories)
 * - checkIn: Check-in date (YYYY-MM-DD) - for availability filtering
 * - checkOut: Check-out date (YYYY-MM-DD) - for availability filtering
 * - guests: Number of guests (for capacity filtering)
 * - minPrice: Minimum price filter
 * - maxPrice: Maximum price filter
 * - limit: Results limit (default: 50, home page uses 12)
 * - featured: Show featured first (default: true)
 * 
 * STAGE 3 Features:
 * - Category filtering with default support
 * - In-memory caching for home page (12 top listings)
 * - Cache TTL: 60 seconds
 * 
 * @updated 2026-03-12
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { CalendarService } from '@/lib/services/calendar.service';

// Simple in-memory cache for home page listings
const cache = {
  data: null,
  timestamp: 0,
  TTL: 60 * 1000 // 60 seconds
};

function getCacheKey(filters) {
  // Only cache when no date filters (home page default view)
  if (filters.checkIn || filters.checkOut) return null;
  return `${filters.category || 'all'}_${filters.limit}_${filters.location || 'all'}`;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse all search parameters
    const filters = {
      q: searchParams.get('q'),
      location: searchParams.get('location'),
      category: searchParams.get('category'), // null = all categories
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
    query = query.limit(filters.limit);
    
    // Apply text search
    if (filters.q) {
      query = query.or(`title.ilike.%${filters.q}%,description.ilike.%${filters.q}%,district.ilike.%${filters.q}%`);
    }
    
    // Apply location/district filter
    if (filters.location && filters.location !== 'all') {
      query = query.ilike('district', `%${filters.location}%`);
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
    
    const listings = rawListings || [];
    
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
      basePriceThb: parseFloat(l.base_price_thb),
      commissionRate: parseFloat(l.commission_rate) || 15,
      images: l.images || [],
      coverImage: l.cover_image,
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
