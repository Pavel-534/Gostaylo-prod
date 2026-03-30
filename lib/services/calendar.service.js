/**
 * Gostaylo - Calendar Service
 * Single Source of Truth for calendar/availability data
 * 
 * Implements "Night-Based" booking logic (Airbnb/Booking.com style):
 * - We book NIGHTS, not days
 * - Check-out day (12:00) is available for new check-in (14:00)
 * - "Transition days" are clearly marked
 * 
 * @created 2026-03-12
 */

import { createClient } from '@supabase/supabase-js';
import { PricingService } from './pricing.service';
import { occupyingStatusesInFilter } from '@/lib/booking-occupancy-statuses';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Format date to YYYY-MM-DD string
 */
function formatDate(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Add days to a date
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get array of dates between start and end (inclusive)
 */
function getDateRange(startDate, endDate) {
  const dates = [];
  let current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    dates.push(formatDate(current));
    current = addDays(current, 1);
  }
  
  return dates;
}

/**
 * CalendarService - Unified calendar data provider
 */
export class CalendarService {
  
  /**
   * Get complete calendar data for a listing
   * 
   * @param {string} listingId - Listing ID
   * @param {number} daysAhead - Number of days to fetch (default: 180)
   * @returns {Object} Calendar data with day-by-day breakdown
   */
  static async getCalendar(listingId, daysAhead = 180) {
    const supabase = getSupabase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const rangeStart = formatDate(today);
    const rangeEnd = formatDate(addDays(today, daysAhead));
    
    // 1. Fetch listing details
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, base_price_thb, min_booking_days, max_booking_days, metadata, status')
      .eq('id', listingId)
      .single();
    
    if (listingError || !listing) {
      return { success: false, error: 'Listing not found' };
    }
    
    // 2. Fetch bookings that occupy inventory (incl. PAID_ESCROW, CHECKED_IN)
    // FIXED: Use direct fetch with cache: 'no-store' instead of Supabase-js client
    // The Supabase-js client had issues with combined date range filters that returned empty results
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    const bookingsUrl = `${supabaseUrl}/rest/v1/bookings?select=id,check_in,check_out,status,guest_name&listing_id=eq.${listingId}&status=in.(${occupyingStatusesInFilter()})&check_out=gte.${rangeStart}&check_in=lte.${rangeEnd}&order=check_in.asc`;
    
    let bookings = [];
    let bookingsError = null;
    
    try {
      const bookingsResponse = await fetch(bookingsUrl, {
        method: 'GET',
        cache: 'no-store',  // CRITICAL: Prevent Next.js from caching this request
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Accept': 'application/json'
        }
      });
      
      if (bookingsResponse.ok) {
        bookings = await bookingsResponse.json();
      } else {
        bookingsError = await bookingsResponse.text();
        console.error('[CALENDAR] REST API error:', bookingsError);
      }
    } catch (e) {
      bookingsError = e.message;
      console.error('[CALENDAR] Fetch error:', e);
    }
    
    // 3. Fetch calendar blocks (manual + iCal)
    const { data: blocks, error: blocksError } = await supabase
      .from('calendar_blocks')
      .select('id, start_date, end_date, source, reason')
      .eq('listing_id', listingId)
      .gte('end_date', rangeStart)
      .lte('start_date', rangeEnd)
      .order('start_date', { ascending: true });
    
    if (blocksError) {
      console.error('Error fetching blocks:', blocksError);
    }
    
    // 4. Fetch seasonal prices from seasonal_prices table
    const { data: seasonalPrices, error: seasonalError } = await supabase
      .from('seasonal_prices')
      .select('*')
      .eq('listing_id', listingId)
      .order('start_date', { ascending: true });
    
    if (seasonalError) {
      console.error('Error fetching seasonal prices:', seasonalError);
    }
    
    // 5. Build day-by-day calendar
    const calendar = this.buildCalendar({
      rangeStart,
      rangeEnd,
      listing,
      bookings: bookings || [],
      blocks: blocks || [],
      seasonalPrices: seasonalPrices || [],
      metadataSeasonalPricing: listing.metadata?.seasonal_pricing || []
    });
    
    return {
      success: true,
      data: {
        listingId,
        rangeStart,
        rangeEnd,
        basePriceThb: listing.base_price_thb,
        minStay: listing.min_booking_days || 1,
        maxStay: listing.max_booking_days || 365,
        listingActive: listing.status === 'ACTIVE',
        calendar,
        meta: {
          totalDays: calendar.length,
          blockedDays: calendar.filter(d => d.status === 'BLOCKED').length,
          availableDays: calendar.filter(d => d.status === 'AVAILABLE').length,
          transitionDays: calendar.filter(d => d.is_transition).length,
          sources: {
            bookings: (bookings || []).length,
            manualBlocks: (blocks || []).filter(b => b.source === 'manual').length,
            icalBlocks: (blocks || []).filter(b => b.source !== 'manual').length
          }
        }
      }
    };
  }
  
  /**
   * Build calendar array with day-by-day status
   */
  static buildCalendar({ rangeStart, rangeEnd, listing, bookings, blocks, seasonalPrices, metadataSeasonalPricing }) {
    const dates = getDateRange(rangeStart, rangeEnd);
    const basePrice = parseFloat(listing.base_price_thb) || 0;
    const minStay = listing.min_booking_days || 1;
    
    // Create lookup maps for performance
    const bookingNights = new Map(); // date -> booking info (for nights that are occupied)
    const bookingCheckouts = new Set(); // dates that are checkout days
    const bookingCheckins = new Set(); // dates that are checkin days
    
    // Process bookings - remember: check_out day is NOT a night
    for (const booking of bookings) {
      const checkIn = new Date(booking.check_in);
      const checkOut = new Date(booking.check_out);
      
      // Mark check-in and check-out days
      bookingCheckins.add(formatDate(checkIn));
      bookingCheckouts.add(formatDate(checkOut));
      
      // Mark nights (check_in to check_out - 1)
      let current = new Date(checkIn);
      while (current < checkOut) {
        const dateStr = formatDate(current);
        bookingNights.set(dateStr, {
          bookingId: booking.id,
          guestName: booking.guest_name,
          status: booking.status
        });
        current = addDays(current, 1);
      }
    }
    
    // Create lookup for blocks (manual + iCal). Overlap with booking nights: booking wins below.
    const blockedDates = new Map();
    for (const block of blocks) {
      const startDate = new Date(block.start_date);
      const endDate = new Date(block.end_date);
      
      let current = new Date(startDate);
      while (current <= endDate) {
        const dateStr = formatDate(current);
        blockedDates.set(dateStr, {
          blockId: block.id,
          source: block.source,
          reason: block.reason
        });
        current = addDays(current, 1);
      }
    }
    
    // Build calendar array
    const calendar = [];
    const today = formatDate(new Date());
    
    for (const dateStr of dates) {
      const isBookedNight = bookingNights.has(dateStr);
      const isBlockedDate = blockedDates.has(dateStr);
      const isCheckoutDay = bookingCheckouts.has(dateStr);
      const isCheckinDay = bookingCheckins.has(dateStr);
      const isPast = dateStr < today;
      
      // Calculate price for this date
      const { dailyPrice, seasonLabel } = this.calculateDailyPrice(
        basePrice, 
        dateStr, 
        seasonalPrices, 
        metadataSeasonalPricing
      );
      
      // Determine status and availability
      let status = 'AVAILABLE';
      let canCheckIn = true;
      let canCheckOut = true;
      let isTransition = false;
      let blockInfo = null;
      
      if (isPast) {
        status = 'PAST';
        canCheckIn = false;
        canCheckOut = false;
      } else if (isBookedNight) {
        // This night is occupied
        status = 'BLOCKED';
        canCheckIn = false;
        canCheckOut = true; // Can still checkout (though unusual)
        blockInfo = {
          type: 'booking',
          ...bookingNights.get(dateStr)
        };
      } else if (isBlockedDate) {
        // Manual or iCal block
        status = 'BLOCKED';
        canCheckIn = false;
        canCheckOut = true; // Can checkout but not start new stay
        blockInfo = {
          type: blockedDates.get(dateStr).source === 'manual' ? 'manual' : 'ical',
          ...blockedDates.get(dateStr)
        };
      }
      
      // TRANSITION DAY LOGIC (Airbnb style):
      // A checkout day is available for new check-in
      if (isCheckoutDay && !isBookedNight && !isBlockedDate && !isPast) {
        status = 'AVAILABLE';
        canCheckIn = true;
        isTransition = true;
      }
      
      calendar.push({
        date: dateStr,
        status,
        price: dailyPrice,
        season: seasonLabel,
        can_check_in: canCheckIn,
        can_check_out: canCheckOut,
        is_transition: isTransition,
        min_stay: minStay,
        block_info: blockInfo
      });
    }
    
    return calendar;
  }
  
  /**
   * Calculate daily price using both seasonal_prices table and metadata
   */
  static calculateDailyPrice(basePrice, dateStr, seasonalPrices, metadataSeasonalPricing) {
    let dailyPrice = basePrice;
    let seasonLabel = 'Base';
    
    // First check seasonal_prices table (higher priority)
    if (seasonalPrices && seasonalPrices.length > 0) {
      for (const season of seasonalPrices) {
        const startDate = season.start_date;
        const endDate = season.end_date;
        
        if (dateStr >= startDate && dateStr <= endDate) {
          dailyPrice = parseFloat(season.price_daily) || basePrice;
          seasonLabel = season.label || this.getSeasonLabel(season.season_type);
          return { dailyPrice, seasonLabel };
        }
      }
    }
    
    // Fallback to metadata seasonal pricing (multiplier-based)
    if (metadataSeasonalPricing && metadataSeasonalPricing.length > 0) {
      for (const season of metadataSeasonalPricing) {
        const startDate = season.startDate;
        const endDate = season.endDate;
        
        if (dateStr >= startDate && dateStr <= endDate) {
          const multiplier = parseFloat(season.priceMultiplier) || 1.0;
          dailyPrice = Math.round(basePrice * multiplier);
          seasonLabel = season.name || 'Season';
          return { dailyPrice, seasonLabel };
        }
      }
    }
    
    return { dailyPrice, seasonLabel };
  }
  
  /**
   * Get human-readable season label
   */
  static getSeasonLabel(seasonType) {
    const labels = {
      'LOW': 'Низкий сезон',
      'NORMAL': 'Обычный',
      'HIGH': 'Высокий сезон',
      'PEAK': 'Пик сезона'
    };
    return labels[seasonType] || 'Base';
  }
  
  /**
   * Check if a specific date range is available
   * 
   * @param {string} listingId 
   * @param {string} checkIn - YYYY-MM-DD
   * @param {string} checkOut - YYYY-MM-DD
   * @returns {Object} Availability check result
   */
  static async checkAvailability(listingId, checkIn, checkOut) {
    const result = await this.getCalendar(listingId, 365);
    
    if (!result.success) {
      return result;
    }
    
    const calendar = result.data.calendar;
    const calendarMap = new Map(calendar.map(d => [d.date, d]));
    
    // Check each NIGHT in the stay (check_in to check_out - 1)
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const conflicts = [];
    let totalPrice = 0;
    let nights = 0;
    
    let current = new Date(checkInDate);
    while (current < checkOutDate) {
      const dateStr = formatDate(current);
      const dayInfo = calendarMap.get(dateStr);
      
      if (!dayInfo) {
        conflicts.push({ date: dateStr, reason: 'Date not in range' });
      } else if (!dayInfo.can_check_in && !dayInfo.is_transition) {
        conflicts.push({ 
          date: dateStr, 
          reason: dayInfo.status,
          block_info: dayInfo.block_info
        });
      } else {
        totalPrice += dayInfo.price;
        nights++;
      }
      
      current = addDays(current, 1);
    }
    
    return {
      success: true,
      available: conflicts.length === 0,
      conflicts,
      pricing: {
        nights,
        totalPrice,
        averagePerNight: nights > 0 ? Math.round(totalPrice / nights) : 0
      }
    };
  }
}

export default CalendarService;
