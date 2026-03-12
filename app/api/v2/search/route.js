/**
 * Gostaylo - Search API (v2)
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
 * Response Structure:
 * {
 *   success: true,
 *   data: {
 *     listings: [...],
 *     filters: { applied filters },
 *     meta: { total, available, filtered }
 *   }
 * }
 * 
 * @created 2026-03-12
 * @stage Stage 1 - Shell (CalendarService integration pending)
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
// TODO: Stage 2 - Uncomment when ready for availability filtering
// import { CalendarService } from '@/lib/services/calendar.service';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse all search parameters
    const filters = {
      q: searchParams.get('q'),                    // Text search
      location: searchParams.get('location'),       // District
      category: searchParams.get('category'),       // Category slug
      checkIn: searchParams.get('checkIn'),         // YYYY-MM-DD
      checkOut: searchParams.get('checkOut'),       // YYYY-MM-DD
      guests: parseInt(searchParams.get('guests')) || null,
      minPrice: parseFloat(searchParams.get('minPrice')) || null,
      maxPrice: parseFloat(searchParams.get('maxPrice')) || null,
      limit: parseInt(searchParams.get('limit')) || 50
    };
    
    console.log('[SEARCH API] Received filters:', filters);
    
    // Build base query
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
    
    // TODO: Apply guests capacity filter
    // if (filters.guests) {
    //   query = query.gte('metadata->max_guests', filters.guests);
    // }
    
    // Execute query
    const { data: listings, error } = await query;
    
    if (error) {
      console.error('[SEARCH API] Query error:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }
    
    // =====================================================
    // STAGE 2: AVAILABILITY FILTERING (Currently Shell)
    // This will filter listings based on calendar availability
    // =====================================================
    let availableListings = listings;
    let filteredOutCount = 0;
    
    if (filters.checkIn && filters.checkOut) {
      // TODO: Stage 2 - Implement CalendarService filtering
      // availableListings = [];
      // for (const listing of listings) {
      //   const availability = await CalendarService.checkAvailability(
      //     listing.id, 
      //     filters.checkIn, 
      //     filters.checkOut
      //   );
      //   if (availability.available) {
      //     availableListings.push(listing);
      //   } else {
      //     filteredOutCount++;
      //   }
      // }
      
      console.log(`[SEARCH API] Date filter requested: ${filters.checkIn} → ${filters.checkOut}`);
      console.log('[SEARCH API] Stage 1: Availability filtering NOT YET IMPLEMENTED');
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
      // Stage 2: Add pricing info when dates provided
      // pricing: filters.checkIn && filters.checkOut ? await calculatePricing(l, filters) : null
    }));
    
    return NextResponse.json({ 
      success: true, 
      data: {
        listings: transformed,
        filters: {
          applied: Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v !== null && v !== undefined)
          ),
          hasDateFilter: !!(filters.checkIn && filters.checkOut)
        },
        meta: {
          total: listings.length,
          available: transformed.length,
          filteredOut: filteredOutCount,
          // Stage 2 indicator
          availabilityFiltered: false,
          stage: 'shell'
        }
      }
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('[SEARCH API] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
