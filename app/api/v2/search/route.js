/**
 * Gostaylo - Search API (v2) - STAGE 2: Smart Filtering
 * GET /api/v2/search - Search listings with availability filter
 * 
 * Query Parameters:
 * - q: Search query (text)
 * - location: District/area filter
 * - category: Category slug filter
 * - checkIn: Check-in date (YYYY-MM-DD) - for availability filtering
 * - checkOut: Check-out date (YYYY-MM-DD) - for availability filtering
 * - guests: Number of guests (for capacity filtering)
 * - minPrice: Minimum price filter
 * - maxPrice: Maximum price filter
 * - limit: Results limit (default: 50)
 * 
 * STAGE 2 Features:
 * - CalendarService integration for real availability filtering
 * - Capacity (max_guests) filtering
 * - Pricing calculation for selected dates
 * 
 * @updated 2026-03-12
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { CalendarService } from '@/lib/services/calendar.service';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse all search parameters
    const filters = {
      q: searchParams.get('q'),
      location: searchParams.get('location'),
      category: searchParams.get('category'),
      checkIn: searchParams.get('checkIn'),
      checkOut: searchParams.get('checkOut'),
      guests: parseInt(searchParams.get('guests')) || null,
      minPrice: parseFloat(searchParams.get('minPrice')) || null,
      maxPrice: parseFloat(searchParams.get('maxPrice')) || null,
      limit: parseInt(searchParams.get('limit')) || 50
    };
    
    console.log('[SEARCH API] Filters:', JSON.stringify(filters));
    
    // Build base query - ONLY ACTIVE listings
    let query = supabaseAdmin
      .from('listings')
      .select(`
        *,
        categories (id, name, slug, icon),
        owner:profiles!owner_id (id, first_name, last_name)
      `)
      .eq('status', 'ACTIVE')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(filters.limit);
    
    // Apply text search
    if (filters.q) {
      query = query.or(`title.ilike.%${filters.q}%,description.ilike.%${filters.q}%,district.ilike.%${filters.q}%`);
    }
    
    // Apply location/district filter
    if (filters.location) {
      query = query.ilike('district', `%${filters.location}%`);
    }
    
    // Apply category filter
    if (filters.category) {
      const { data: cat } = await supabaseAdmin
        .from('categories')
        .select('id')
        .eq('slug', filters.category)
        .single();
      
      if (cat) {
        query = query.eq('category_id', cat.id);
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
    const { data: listings, error } = await query;
    
    if (error) {
      console.error('[SEARCH API] Query error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    // =====================================================
    // STAGE 2: AVAILABILITY & CAPACITY FILTERING
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
          
          if (!availability.available) {
            filteredOutByAvailability++;
            console.log(`[SEARCH API] Listing ${listing.id} filtered out - unavailable for ${filters.checkIn} to ${filters.checkOut}`);
            continue;
          }
          
          // Add pricing info for available listings
          listing._pricing = availability.pricing;
        } catch (err) {
          console.error(`[SEARCH API] Error checking availability for ${listing.id}:`, err);
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
      owner: l.owner,
      // Stage 2: Pricing for selected date range
      pricing: l._pricing || null
    }));
    
    return NextResponse.json({ 
      success: true, 
      data: {
        listings: transformed,
        filters: {
          applied: Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v !== null && v !== undefined)
          ),
          hasDateFilter
        },
        meta: {
          total: listings.length,
          available: transformed.length,
          filteredOutByAvailability,
          filteredOutByCapacity,
          availabilityFiltered: hasDateFilter,
          stage: 'smart'
        }
      }
    }, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    });
    
  } catch (error) {
    console.error('[SEARCH API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
