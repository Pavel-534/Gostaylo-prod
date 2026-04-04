/**
 * GoStayLo - Calendar Service
 * Single Source of Truth for calendar/availability data
 *
 * Night-based stays + inventory (max_capacity, guests_count, units_blocked).
 *
 * @created 2026-03-12
 */

import { createClient } from '@supabase/supabase-js';
import { occupyingStatusesInFilter } from '@/lib/booking-occupancy-statuses';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function formatDate(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

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

function parseMaxCapacity(listing) {
  const n = parseInt(listing?.max_capacity, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function parseGuestsCount(booking) {
  const n = parseInt(booking?.guests_count, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function parseUnitsBlocked(block) {
  const n = parseInt(block?.units_blocked, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/**
 * CalendarService - Unified calendar data provider
 */
export class CalendarService {
  /**
   * @param {string} listingId
   * @param {number} daysAhead
   * @param {{ excludeBookingId?: string|null }} [options]
   */
  static async getCalendar(listingId, daysAhead = 180, options = {}) {
    const excludeBookingId = options.excludeBookingId ?? null;
    const supabase = getSupabase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rangeStart = formatDate(today);
    const rangeEnd = formatDate(addDays(today, daysAhead));

    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, base_price_thb, min_booking_days, max_booking_days, max_capacity, metadata, status')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return { success: false, error: 'Listing not found' };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const bookingsUrl = `${supabaseUrl}/rest/v1/bookings?select=id,check_in,check_out,status,guest_name,guests_count&listing_id=eq.${listingId}&status=in.(${occupyingStatusesInFilter()})&check_out=gte.${rangeStart}&check_in=lte.${rangeEnd}&order=check_in.asc`;

    let bookings = [];
    try {
      const bookingsResponse = await fetch(bookingsUrl, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: 'application/json',
        },
      });

      if (bookingsResponse.ok) {
        bookings = await bookingsResponse.json();
      } else {
        console.error('[CALENDAR] REST API error:', await bookingsResponse.text());
      }
    } catch (e) {
      console.error('[CALENDAR] Fetch error:', e);
    }

    const { data: blocks, error: blocksError } = await supabase
      .from('calendar_blocks')
      .select('id, start_date, end_date, source, reason, units_blocked, expires_at')
      .eq('listing_id', listingId)
      .gte('end_date', rangeStart)
      .lte('start_date', rangeEnd)
      .order('start_date', { ascending: true });

    if (blocksError) {
      console.error('Error fetching blocks:', blocksError);
    }

    const { data: seasonalPrices, error: seasonalError } = await supabase
      .from('seasonal_prices')
      .select('*')
      .eq('listing_id', listingId)
      .order('start_date', { ascending: true });

    if (seasonalError) {
      console.error('Error fetching seasonal prices:', seasonalError);
    }

    const calendar = this.buildCalendar({
      rangeStart,
      rangeEnd,
      listing,
      bookings: bookings || [],
      blocks: blocks || [],
      seasonalPrices: seasonalPrices || [],
      metadataSeasonalPricing: listing.metadata?.seasonal_pricing || [],
      excludeBookingId,
    });

    const maxCapacity = parseMaxCapacity(listing);

    return {
      success: true,
      data: {
        listingId,
        rangeStart,
        rangeEnd,
        maxCapacity,
        basePriceThb: listing.base_price_thb,
        minStay: listing.min_booking_days || 1,
        maxStay: listing.max_booking_days || 365,
        listingActive: listing.status === 'ACTIVE',
        calendar,
        meta: {
          totalDays: calendar.length,
          blockedDays: calendar.filter((d) => d.status === 'BLOCKED').length,
          availableDays: calendar.filter((d) => d.status === 'AVAILABLE').length,
          transitionDays: calendar.filter((d) => d.is_transition).length,
          sources: {
            bookings: (bookings || []).length,
            manualBlocks: (blocks || []).filter((b) => b.source === 'manual').length,
            icalBlocks: (blocks || []).filter((b) => b.source !== 'manual').length,
          },
        },
      },
    };
  }

  /**
   * @param {{ excludeBookingId?: string|null }} params
   */
  static buildCalendar({
    rangeStart,
    rangeEnd,
    listing,
    bookings,
    blocks,
    seasonalPrices,
    metadataSeasonalPricing,
    excludeBookingId = null,
  }) {
    const dates = getDateRange(rangeStart, rangeEnd);
    const basePrice = parseFloat(listing.base_price_thb) || 0;
    const minStay = listing.min_booking_days || 1;
    const maxCapacity = parseMaxCapacity(listing);

    const guestsPerNight = new Map();
    const bookingCheckouts = new Set();
    const bookingCheckins = new Set();

    for (const booking of bookings) {
      if (excludeBookingId && String(booking.id) === String(excludeBookingId)) {
        continue;
      }
      const checkIn = new Date(booking.check_in);
      const checkOut = new Date(booking.check_out);
      const gc = parseGuestsCount(booking);

      bookingCheckins.add(formatDate(checkIn));
      bookingCheckouts.add(formatDate(checkOut));

      let current = new Date(checkIn);
      while (current < checkOut) {
        const dateStr = formatDate(current);
        guestsPerNight.set(dateStr, (guestsPerNight.get(dateStr) || 0) + gc);
        current = addDays(current, 1);
      }
    }

    const blockedUnitsPerNight = new Map();
    const nowMs = Date.now();
    for (const block of blocks) {
      if (block.expires_at && new Date(block.expires_at).getTime() <= nowMs) {
        continue;
      }
      const startDate = new Date(block.start_date);
      const endDate = new Date(block.end_date);
      const units = parseUnitsBlocked(block);

      let current = new Date(startDate);
      while (current <= endDate) {
        const dateStr = formatDate(current);
        blockedUnitsPerNight.set(dateStr, (blockedUnitsPerNight.get(dateStr) || 0) + units);
        current = addDays(current, 1);
      }
    }

    const calendar = [];
    const today = formatDate(new Date());

    for (const dateStr of dates) {
      const bookedGuests = guestsPerNight.get(dateStr) || 0;
      const blockedUnits = blockedUnitsPerNight.get(dateStr) || 0;
      const remainingSpots = Math.max(0, maxCapacity - bookedGuests - blockedUnits);

      const isCheckoutDay = bookingCheckouts.has(dateStr);
      const isCheckinDay = bookingCheckins.has(dateStr);
      const isPast = dateStr < today;

      const { dailyPrice, seasonLabel } = this.calculateDailyPrice(
        basePrice,
        dateStr,
        seasonalPrices,
        metadataSeasonalPricing
      );

      let status = 'AVAILABLE';
      let canCheckIn = remainingSpots >= 1;
      let canCheckOut = true;
      let isTransition = false;
      let blockInfo = null;

      if (isPast) {
        status = 'PAST';
        canCheckIn = false;
        canCheckOut = false;
      } else if (remainingSpots <= 0) {
        status = 'BLOCKED';
        canCheckIn = false;
        canCheckOut = true;
        blockInfo = {
          type: 'inventory',
          booked_guests: bookedGuests,
          blocked_units: blockedUnits,
          remaining_spots: remainingSpots,
          max_capacity: maxCapacity,
        };
      } else {
        blockInfo = {
          type: 'inventory',
          booked_guests: bookedGuests,
          blocked_units: blockedUnits,
          remaining_spots: remainingSpots,
          max_capacity: maxCapacity,
        };
      }

      if (isCheckoutDay && remainingSpots > 0 && !isPast) {
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
        remaining_spots: remainingSpots,
        booked_guests: bookedGuests,
        blocked_units: blockedUnits,
        max_capacity: maxCapacity,
        block_info: blockInfo,
      });
    }

    return calendar;
  }

  static calculateDailyPrice(basePrice, dateStr, seasonalPrices, metadataSeasonalPricing) {
    let dailyPrice = basePrice;
    let seasonLabel = 'Base';

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

  static getSeasonLabel(seasonType) {
    const labels = {
      LOW: 'Низкий сезон',
      NORMAL: 'Обычный',
      HIGH: 'Высокий сезон',
      PEAK: 'Пик сезона',
    };
    return labels[seasonType] || 'Base';
  }

  /**
   * Inventory-aware availability for nights [checkIn, checkOut).
   *
   * @param {string} listingId
   * @param {string} checkIn - YYYY-MM-DD
   * @param {string} checkOut - YYYY-MM-DD
   * @param {{ guestsCount?: number, excludeBookingId?: string|null }} [options]
   */
  static async checkAvailability(listingId, checkIn, checkOut, options = {}) {
    const guestsCount = Math.max(
      1,
      parseInt(options.guestsCount ?? options.guests_count ?? 1, 10) || 1
    );
    const excludeBookingId = options.excludeBookingId ?? options.exclude_booking_id ?? null;

    const result = await this.getCalendar(listingId, 365, { excludeBookingId });

    if (!result.success) {
      return result;
    }

    const calendar = result.data.calendar;
    const calendarMap = new Map(calendar.map((d) => [d.date, d]));

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const conflicts = [];
    let totalPrice = 0;
    let nights = 0;
    let minRemainingSpots = Infinity;

    let current = new Date(checkInDate);
    while (current < checkOutDate) {
      const dateStr = formatDate(current);
      const dayInfo = calendarMap.get(dateStr);

      if (!dayInfo) {
        conflicts.push({ date: dateStr, reason: 'Date not in range' });
      } else {
        const rem = dayInfo.remaining_spots ?? 0;
        minRemainingSpots = Math.min(minRemainingSpots, rem);
        if (rem < guestsCount) {
          conflicts.push({
            date: dateStr,
            reason: 'INSUFFICIENT_CAPACITY',
            remaining_spots: rem,
            required_guests: guestsCount,
            booked_guests: dayInfo.booked_guests,
            blocked_units: dayInfo.blocked_units,
            max_capacity: dayInfo.max_capacity,
          });
        } else {
          totalPrice += dayInfo.price;
          nights++;
        }
      }

      current = addDays(current, 1);
    }

    if (minRemainingSpots === Infinity) {
      minRemainingSpots = 0;
    }

    return {
      success: true,
      available: conflicts.length === 0,
      conflicts,
      guests_count: guestsCount,
      min_remaining_spots: minRemainingSpots,
      max_capacity: result.data.maxCapacity,
      pricing: {
        nights,
        totalPrice,
        averagePerNight: nights > 0 ? Math.round(totalPrice / nights) : 0,
      },
    };
  }

  /**
   * Ensure a manual block of `unitsBlocked` per night fits in remaining inventory (each night inclusive).
   */
  static async validateManualBlockFits(listingId, startDate, endDate, unitsBlocked) {
    const ub = Math.max(1, parseInt(unitsBlocked, 10) || 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endD = new Date(`${endDate}T12:00:00Z`);
    if (Number.isNaN(endD.getTime())) {
      return { success: false, error: 'Invalid endDate' };
    }
    const diffDays = Math.ceil((endD - today) / 86400000);
    const ahead = Math.max(365, Math.min(2500, diffDays + 21));

    const result = await this.getCalendar(listingId, ahead);
    if (!result.success) {
      return result;
    }

    const { rangeStart, rangeEnd, maxCapacity } = result.data;
    if (ub > maxCapacity) {
      return {
        success: false,
        error: 'UNITS_EXCEED_CAPACITY',
        max_capacity: maxCapacity,
      };
    }

    const calendarMap = new Map(result.data.calendar.map((d) => [d.date, d]));
    const dates = getDateRange(startDate, endDate);
    const conflicts = [];

    for (const dateStr of dates) {
      if (dateStr < rangeStart) {
        continue;
      }
      if (dateStr > rangeEnd) {
        return {
          success: false,
          error: 'BLOCK_RANGE_BEYOND_CALENDAR_WINDOW',
          rangeEnd,
        };
      }
      const day = calendarMap.get(dateStr);
      if (!day) {
        conflicts.push({ date: dateStr, reason: 'DAY_NOT_IN_CALENDAR' });
        continue;
      }
      const rem = day.remaining_spots ?? 0;
      if (rem < ub) {
        conflicts.push({
          date: dateStr,
          reason: 'INSUFFICIENT_CAPACITY_FOR_BLOCK',
          remaining_spots: rem,
          units_blocked_requested: ub,
          booked_guests: day.booked_guests,
          blocked_units: day.blocked_units,
          max_capacity: day.max_capacity,
        });
      }
    }

    if (conflicts.length > 0) {
      return { success: false, error: 'INSUFFICIENT_CAPACITY_FOR_BLOCK', conflicts };
    }
    return { success: true };
  }
}

export default CalendarService;
