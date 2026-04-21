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
import { toListingDate, addListingDays, listingDateToday } from '@/lib/listing-date';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function getDateRange(startIso, endIso) {
  const dates = [];
  let cur = startIso;
  while (cur <= endIso) {
    dates.push(cur);
    cur = addListingDays(cur, 1);
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

const EXPLICIT_TIME_RE = /[T\s]\d{2}:\d{2}/;

function hasExplicitTimePart(value) {
  return EXPLICIT_TIME_RE.test(String(value || ''));
}

function parseIsoInstant(value) {
  const ms = new Date(String(value || '')).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

/**
 * CalendarService - Unified calendar data provider
 */
export class CalendarService {
  /**
   * @param {string} listingId
   * @param {number} daysAhead
   * @param {{ excludeBookingId?: string|null, requestedGuests?: number, listingCategorySlugOverride?: string|null, occupyingStatusesCsv?: string|null }} [options]
   */
  static async getCalendar(listingId, daysAhead = 180, options = {}) {
    const excludeBookingId = options.excludeBookingId ?? null;
    const requestedGuests = Math.max(1, parseInt(options.requestedGuests ?? 1, 10) || 1);
    const listingCategorySlugOverride = options.listingCategorySlugOverride
      ? String(options.listingCategorySlugOverride).toLowerCase().trim()
      : '';
    const occupyingStatusesCsv =
      typeof options.occupyingStatusesCsv === 'string' && options.occupyingStatusesCsv.trim()
        ? options.occupyingStatusesCsv.trim()
        : occupyingStatusesInFilter();
    const supabase = getSupabase();

    const rangeStart = listingDateToday();
    const rangeEnd = addListingDays(rangeStart, daysAhead);

    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, base_price_thb, min_booking_days, max_booking_days, max_capacity, metadata, status, category_id')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return { success: false, error: 'Listing not found' };
    }

    let listingCategorySlug = '';
    if (listing.category_id) {
      const { data: catRow } = await supabase
        .from('categories')
        .select('slug')
        .eq('id', listing.category_id)
        .maybeSingle();
      listingCategorySlug = String(catRow?.slug || '').toLowerCase();
    }
    if (!listingCategorySlug && listing.metadata && typeof listing.metadata === 'object') {
      const m = listing.metadata;
      listingCategorySlug = String(m.category_slug || m.categorySlug || '').toLowerCase();
    }
    if (listingCategorySlugOverride) {
      listingCategorySlug = listingCategorySlugOverride;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const bookingsUrl = `${supabaseUrl}/rest/v1/bookings?select=id,check_in,check_out,status,guest_name,guests_count&listing_id=eq.${listingId}&status=in.(${occupyingStatusesCsv})&check_out=gte.${rangeStart}&check_in=lte.${rangeEnd}&order=check_in.asc`;

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
      requestedGuests,
      listingCategorySlug,
    });

    const maxCapacity = parseMaxCapacity(listing);

    return {
      success: true,
      data: {
        listingId,
        rangeStart,
        rangeEnd,
        maxCapacity,
        listingCategorySlug,
        basePriceThb: listing.base_price_thb,
        minStay: listing.min_booking_days || 1,
        maxStay: listing.max_booking_days || 365,
        listingActive: listing.status === 'ACTIVE',
        calendar,
        meta: {
          requestedGuests,
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
   * @param {{ excludeBookingId?: string|null, requestedGuests?: number, listingCategorySlug?: string }} params
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
    requestedGuests = 1,
    listingCategorySlug = '',
  }) {
    const dates = getDateRange(rangeStart, rangeEnd);
    const basePrice = parseFloat(listing.base_price_thb) || 0;
    const minStay = listing.min_booking_days || 1;
    const maxCapacity = parseMaxCapacity(listing);
    const rawRequested = Math.max(1, parseInt(requestedGuests, 10) || 1);
    const isVehicleCategory = String(listingCategorySlug || '').toLowerCase() === 'vehicles';
    // Single-unit (villa, whole yacht): inventory is 0/1 units per night. Party size is enforced at booking (max_guests), not via remaining_spots vs guests.
    // Транспорт (vehicles): одна единица на даты — занятость бинарная; число пассажиров не «съедает» места порциями (иначе 1 гость в другой заявке блокирует 2 места в inquiry).
    const g = maxCapacity <= 1 || isVehicleCategory ? 1 : rawRequested;

    const guestsPerNight = new Map();
    const bookingCheckouts = new Set();
    const bookingCheckins = new Set();

    for (const booking of bookings) {
      if (excludeBookingId && String(booking.id) === String(excludeBookingId)) {
        continue;
      }
      const cin = toListingDate(booking.check_in);
      const cout = toListingDate(booking.check_out);
      if (!cin || !cout) continue;
      const gc = parseGuestsCount(booking);

      bookingCheckins.add(cin);
      bookingCheckouts.add(cout);

      let night = cin;
      while (night < cout) {
        if (isVehicleCategory) {
          guestsPerNight.set(night, 1);
        } else {
          guestsPerNight.set(night, (guestsPerNight.get(night) || 0) + gc);
        }
        night = addListingDays(night, 1);
      }
    }

    const blockedUnitsPerNight = new Map();
    const nowMs = Date.now();
    for (const block of blocks) {
      if (block.expires_at && new Date(block.expires_at).getTime() <= nowMs) {
        continue;
      }
      const s = toListingDate(block.start_date);
      const e = toListingDate(block.end_date);
      if (!s || !e) continue;
      const units = parseUnitsBlocked(block);

      let cur = s;
      while (cur <= e) {
        blockedUnitsPerNight.set(cur, (blockedUnitsPerNight.get(cur) || 0) + units);
        cur = addListingDays(cur, 1);
      }
    }

    const calendar = [];
    const today = listingDateToday();

    for (const dateStr of dates) {
      const rawBookedLoad = guestsPerNight.get(dateStr) || 0;
      const bookedGuests = isVehicleCategory
        ? (rawBookedLoad > 0 ? maxCapacity : 0)
        : rawBookedLoad;
      const blockedUnits = blockedUnitsPerNight.get(dateStr) || 0;
      const remainingSpots = Math.max(0, maxCapacity - bookedGuests - blockedUnits);

      const isCheckoutDay = bookingCheckouts.has(dateStr);
      const isPast = dateStr < today;

      const { dailyPrice, seasonLabel } = this.calculateDailyPrice(
        basePrice,
        dateStr,
        seasonalPrices,
        metadataSeasonalPricing
      );

      let status = 'AVAILABLE';
      let canCheckIn = remainingSpots >= g;
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
      } else if (remainingSpots < g) {
        status = 'BLOCKED';
        canCheckIn = false;
        canCheckOut = true;
        blockInfo = {
          type: 'insufficient_for_party',
          booked_guests: bookedGuests,
          blocked_units: blockedUnits,
          remaining_spots: remainingSpots,
          max_capacity: maxCapacity,
          requested_guests: rawRequested,
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

      // Checkout morning frees the unit for a new stay that night — only if party fits in remaining inventory
      if (isCheckoutDay && remainingSpots >= g && !isPast) {
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
   * @param {{ guestsCount?: number, excludeBookingId?: string|null, listingCategorySlugOverride?: string|null, occupyingStatusesCsv?: string|null }} [options]
   */
  static async checkAvailability(listingId, checkIn, checkOut, options = {}) {
    const guestsCount = Math.max(
      1,
      parseInt(options.guestsCount ?? options.guests_count ?? 1, 10) || 1
    );
    const excludeBookingId = options.excludeBookingId ?? options.exclude_booking_id ?? null;
    const hasTimeRange = hasExplicitTimePart(checkIn) || hasExplicitTimePart(checkOut);

    const checkInStr = toListingDate(checkIn);
    const checkOutStr = toListingDate(checkOut);
    if (!checkInStr || !checkOutStr) {
      return {
        success: false,
        error: 'INVALID_DATE_RANGE',
        available: false,
        conflicts: [{ reason: 'INVALID_DATE_RANGE' }],
        code: 'INVALID_DATE_RANGE',
      };
    }

    const result = await this.getCalendar(listingId, 365, {
      excludeBookingId,
      requestedGuests: guestsCount,
      listingCategorySlugOverride: options.listingCategorySlugOverride,
      occupyingStatusesCsv: options.occupyingStatusesCsv,
    });

    if (!result.success) {
      return result;
    }

    const catSlug = String(result.data.listingCategorySlug || '').toLowerCase();
    const isVehicleCategory = catSlug === 'vehicles';
    const isVehicleIntervalMode = isVehicleCategory && hasTimeRange;

    if (!isVehicleIntervalMode && checkInStr >= checkOutStr) {
      return {
        success: false,
        error: 'INVALID_DATE_RANGE',
        available: false,
        conflicts: [{ reason: 'INVALID_DATE_RANGE' }],
        code: 'INVALID_DATE_RANGE',
      };
    }

    const calendar = result.data.calendar;
    const calendarMap = new Map(calendar.map((d) => [d.date, d]));

    if (isVehicleIntervalMode) {
      const startMs = parseIsoInstant(checkIn);
      const endMs = parseIsoInstant(checkOut);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
        return {
          success: false,
          error: 'INVALID_DATE_RANGE',
          available: false,
          conflicts: [{ reason: 'INVALID_DATE_RANGE' }],
          code: 'INVALID_DATE_RANGE',
        };
      }

      const overlap = await this.findVehicleIntervalConflicts(
        listingId,
        new Date(startMs).toISOString(),
        new Date(endMs).toISOString(),
        {
          excludeBookingId,
          occupyingStatusesCsv: options.occupyingStatusesCsv || occupyingStatusesInFilter(),
        }
      );

      if (!overlap.success) {
        return {
          success: false,
          error: overlap.error || 'AVAILABILITY_CHECK_FAILED',
          available: false,
          conflicts: [{ reason: overlap.error || 'AVAILABILITY_CHECK_FAILED' }],
        };
      }

      const spanDates = [];
      if (checkInStr === checkOutStr) {
        spanDates.push(checkInStr);
      } else {
        let d = checkInStr;
        while (d < checkOutStr) {
          spanDates.push(d);
          d = addListingDays(d, 1);
        }
      }

      let totalPrice = 0;
      for (const d of spanDates) {
        totalPrice += Number(calendarMap.get(d)?.price || 0);
      }

      return {
        success: true,
        available: overlap.conflicts.length === 0,
        conflicts: overlap.conflicts,
        guests_count: guestsCount,
        min_remaining_spots: overlap.conflicts.length ? 0 : result.data.maxCapacity,
        max_capacity: result.data.maxCapacity,
        pricing: {
          nights: spanDates.length,
          totalPrice,
          averagePerNight: spanDates.length > 0 ? Math.round(totalPrice / spanDates.length) : 0,
        },
      };
    }

    const conflicts = [];
    let totalPrice = 0;
    let nights = 0;
    let minRemainingSpots = Infinity;

    let night = checkInStr;
    while (night < checkOutStr) {
      const dayInfo = calendarMap.get(night);

      if (!dayInfo) {
        conflicts.push({ date: night, reason: 'Date not in range' });
      } else {
        const rem = dayInfo.remaining_spots ?? 0;
        minRemainingSpots = Math.min(minRemainingSpots, rem);

        const maxCap = result.data.maxCapacity;
        const needRem = maxCap <= 1 || catSlug === 'vehicles' ? 1 : guestsCount;
        if (rem < needRem) {
          conflicts.push({
            date: night,
            reason: 'INSUFFICIENT_CAPACITY',
            remaining_spots: rem,
            required_guests: needRem,
            booked_guests: dayInfo.booked_guests,
            blocked_units: dayInfo.blocked_units,
            max_capacity: dayInfo.max_capacity,
          });
        } else {
          totalPrice += dayInfo.price;
          nights++;
        }
      }

      night = addListingDays(night, 1);
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

  static async findVehicleIntervalConflicts(listingId, checkInIso, checkOutIso, options = {}) {
    const excludeBookingId = options.excludeBookingId ?? null;
    const occupyingStatusesCsv =
      typeof options.occupyingStatusesCsv === 'string' && options.occupyingStatusesCsv.trim()
        ? options.occupyingStatusesCsv.trim()
        : occupyingStatusesInFilter();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return { success: false, error: 'Missing Supabase env' };
    }

    const params = new URLSearchParams({
      select: 'id,check_in,check_out,status,guests_count',
      listing_id: `eq.${listingId}`,
      status: `in.(${occupyingStatusesCsv})`,
      check_in: `lt.${checkOutIso}`,
      check_out: `gt.${checkInIso}`,
      order: 'check_in.asc',
    });

    const url = `${supabaseUrl}/rest/v1/bookings?${params.toString()}`;
    try {
      const resp = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: 'application/json',
        },
      });
      if (!resp.ok) {
        return { success: false, error: await resp.text() };
      }
      const rawRows = await resp.json();
      const rows = Array.isArray(rawRows) ? rawRows : [];
      const filtered = rows.filter(
        (row) => !excludeBookingId || String(row.id) !== String(excludeBookingId)
      );
      const conflicts = filtered.map((row) => ({
        reason: 'INSUFFICIENT_CAPACITY',
        booking_id: row.id,
        status: row.status,
        check_in: row.check_in,
        check_out: row.check_out,
      }));
      return { success: true, conflicts };
    } catch (e) {
      return { success: false, error: e?.message || 'Vehicle overlap check failed' };
    }
  }

  /**
   * Ensure a manual block of `unitsBlocked` per night fits in remaining inventory (each night inclusive).
   */
  static async validateManualBlockFits(listingId, startDate, endDate, unitsBlocked) {
    const ub = Math.max(1, parseInt(unitsBlocked, 10) || 1);
    const todayStr = listingDateToday();
    const endStr = toListingDate(endDate);
    if (!endStr) {
      return { success: false, error: 'Invalid endDate' };
    }
    let diff = 0;
    let cursor = todayStr;
    while (cursor < endStr) {
      diff++;
      cursor = addListingDays(cursor, 1);
    }
    const ahead = Math.max(365, Math.min(2500, diff + 21));

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
    const startNorm = toListingDate(startDate);
    const endNorm = toListingDate(endDate);
    if (!startNorm || !endNorm) {
      return { success: false, error: 'Invalid block dates' };
    }
    const dates = getDateRange(startNorm, endNorm);
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
