/**
 * GoStayLo — Calendar query layer (Stage 70.5)
 * Reads, grid build, availability checks. Pricing helpers: `calendar-pricing.service.js`.
 */

import { occupyingStatusesInFilter } from '@/lib/booking-occupancy-statuses';
import { toListingDate, addListingDays, listingDateToday } from '@/lib/listing-date';
import { normalizeVehicleIntervalBounds } from '@/lib/services/vehicle-conflict-utils';
import { promoIsActiveAt } from '@/lib/promo/promo-engine';
import { resolveListingTimeZoneFromMetadata } from '@/lib/geo/listing-timezone-ssot';
import { isTransportListingCategory } from '@/lib/listing-category-slug';
import {
  getSupabase,
  getDateRange,
  parseMaxCapacity,
  parseGuestsCount,
  parseUnitsBlocked,
} from '@/lib/services/calendar/calendar-shared';
import {
  calculateDailyPrice,
  resolveMarketingPromoForDay,
  mapMarketingPromoToPartnerCell,
} from '@/lib/services/calendar/calendar-pricing.service';

/**
 * Calendar query / availability SSOT (split from legacy monolith).
 */
export class CalendarQueryLayer {
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

    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select(
        'id, owner_id, base_price_thb, min_booking_days, max_booking_days, max_capacity, metadata, status, category_id',
      )
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return { success: false, error: 'Listing not found' };
    }

    const listingTimeZone = resolveListingTimeZoneFromMetadata(listing.metadata);
    const rangeStart = listingDateToday(listingTimeZone);
    const rangeEnd = addListingDays(rangeStart, daysAhead);

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
      .select('id, start_date, end_date, source, reason, type, units_blocked, expires_at')
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

    const calendar = CalendarQueryLayer.buildCalendar({
      rangeStart,
      rangeEnd,
      listing,
      listingTimeZone,
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
        listingTimeZone,
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
    listingTimeZone,
    bookings,
    blocks,
    seasonalPrices,
    metadataSeasonalPricing,
    excludeBookingId = null,
    requestedGuests = 1,
    listingCategorySlug = '',
    marketingPromos = [],
    partnerUi = false,
  }) {
    const dates = getDateRange(rangeStart, rangeEnd);
    const basePrice = parseFloat(listing.base_price_thb) || 0;
    const minStay = listing.min_booking_days || 1;
    const maxCapacity = parseMaxCapacity(listing);
    const rawRequested = Math.max(1, parseInt(requestedGuests, 10) || 1);
    const isVehicleCategory = isTransportListingCategory(listingCategorySlug);
    // Single-unit (villa, whole yacht): inventory is 0/1 units per night. Party size is enforced at booking (max_guests), not via remaining_spots vs guests.
    // Транспорт (vehicles): одна единица на даты — занятость бинарная; число пассажиров не «съедает» места порциями (иначе 1 гость в другой заявке блокирует 2 места в inquiry).
    const g = maxCapacity <= 1 || isVehicleCategory ? 1 : rawRequested;

    const guestsPerNight = new Map();
    const bookingCheckouts = new Set();
    const bookingCheckins = new Set();
    /** @type {Map<string, any[]>|null} */
    const bookingsByNight = partnerUi ? new Map() : null;
    /** @type {Map<string, any[]>|null} */
    const blocksByNight = partnerUi ? new Map() : null;

    for (const booking of bookings) {
      if (excludeBookingId && String(booking.id) === String(excludeBookingId)) {
        continue;
      }
      const cin = toListingDate(booking.check_in, listingTimeZone);
      const cout = toListingDate(booking.check_out, listingTimeZone);
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
        if (bookingsByNight) {
          if (!bookingsByNight.has(night)) bookingsByNight.set(night, []);
          bookingsByNight.get(night).push(booking);
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
      const s = toListingDate(block.start_date, listingTimeZone);
      const e = toListingDate(block.end_date, listingTimeZone);
      if (!s || !e) continue;
      const units = parseUnitsBlocked(block);

      let cur = s;
      while (cur <= e) {
        blockedUnitsPerNight.set(cur, (blockedUnitsPerNight.get(cur) || 0) + units);
        if (blocksByNight) {
          if (!blocksByNight.has(cur)) blocksByNight.set(cur, []);
          blocksByNight.get(cur).push(block);
        }
        cur = addListingDays(cur, 1);
      }
    }

    const calendar = [];
    const today = listingDateToday(listingTimeZone);

    for (const dateStr of dates) {
      const rawBookedLoad = guestsPerNight.get(dateStr) || 0;
      const bookedGuests = isVehicleCategory
        ? (rawBookedLoad > 0 ? maxCapacity : 0)
        : rawBookedLoad;
      const blockedUnits = blockedUnitsPerNight.get(dateStr) || 0;
      const remainingSpots = Math.max(0, maxCapacity - bookedGuests - blockedUnits);

      const isCheckoutDay = bookingCheckouts.has(dateStr);
      const isPast = dateStr < today;

      const { dailyPrice, seasonLabel } = calculateDailyPrice(
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
        marketing_promo:
          status === 'AVAILABLE'
            ? resolveMarketingPromoForDay({
                promos: marketingPromos,
                listingId: listing.id,
                listingOwnerId: listing.owner_id || listing.ownerId || null,
                date: dateStr,
                baseSeasonPrice: dailyPrice,
              })
            : null,
        partner_bookings: bookingsByNight ? bookingsByNight.get(dateStr) || [] : undefined,
        partner_blocks: blocksByNight ? blocksByNight.get(dateStr) || [] : undefined,
      });
    }

    return calendar;
  }

  /**
   * Partner Master Calendar / arbitrary window — same `buildCalendar` SSOT as `getCalendar`,
   * with explicit YYYY-MM-DD bounds (calendar keys in listing TZ) and partner cell metadata.
   *
   * @param {string} listingId
   * @param {string} rangeStart YYYY-MM-DD
   * @param {string} rangeEnd YYYY-MM-DD
   * @param {{ requestedGuests?: number, excludeBookingId?: string|null, marketingPromoRows?: any[]|null, occupyingStatusesCsv?: string|null }} [options]
   */
  static async getCalendarForDateRange(listingId, rangeStart, rangeEnd, options = {}) {
    const requestedGuests = Math.max(1, parseInt(options.requestedGuests ?? 1, 10) || 1);
    const excludeBookingId = options.excludeBookingId ?? null;
    const marketingPromoRows = Array.isArray(options.marketingPromoRows)
      ? options.marketingPromoRows
      : null;
    const occupyingStatusesCsv =
      typeof options.occupyingStatusesCsv === 'string' && options.occupyingStatusesCsv.trim()
        ? options.occupyingStatusesCsv.trim()
        : occupyingStatusesInFilter();

    const rs = toListingDate(rangeStart);
    const re = toListingDate(rangeEnd);
    if (!rs || !re || rs > re) {
      return { success: false, error: 'INVALID_DATE_RANGE', code: 'INVALID_DATE_RANGE' };
    }
    let span = 0;
    let cur = rs;
    while (cur <= re) {
      span += 1;
      if (span > 400) {
        return { success: false, error: 'RANGE_TOO_LARGE', code: 'RANGE_TOO_LARGE', maxDays: 400 };
      }
      cur = addListingDays(cur, 1);
    }

    const supabase = getSupabase();
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select(
        'id, owner_id, title, district, cover_image, base_price_thb, min_booking_days, max_booking_days, max_capacity, metadata, status, category_id',
      )
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return { success: false, error: 'Listing not found' };
    }

    const listingTimeZone = resolveListingTimeZoneFromMetadata(listing.metadata);

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
    const listingCategorySlugOverride = options.listingCategorySlugOverride
      ? String(options.listingCategorySlugOverride).toLowerCase().trim()
      : '';
    if (listingCategorySlugOverride) {
      listingCategorySlug = listingCategorySlugOverride;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const bookingsUrl = `${supabaseUrl}/rest/v1/bookings?select=id,listing_id,check_in,check_out,status,guest_name,guests_count,price_thb,source&listing_id=eq.${listingId}&status=in.(${occupyingStatusesCsv})&check_out=gte.${rs}&check_in=lte.${re}&order=check_in.asc`;

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
      .select('id, start_date, end_date, source, reason, type, units_blocked, expires_at')
      .eq('listing_id', listingId)
      .gte('end_date', rs)
      .lte('start_date', re)
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

    let promos = marketingPromoRows;
    if (promos == null) {
      const { data: promosData } = await supabase
        .from('promo_codes')
        .select(
          'code,promo_type,value,is_active,valid_until,max_uses,current_uses,created_by_type,partner_id,allowed_listing_ids,is_flash_sale',
        )
        .eq('is_active', true);
      const nowMs = Date.now();
      promos = (promosData || []).filter((row) => promoIsActiveAt(row, nowMs).ok);
    }

    const calendar = CalendarQueryLayer.buildCalendar({
      rangeStart: rs,
      rangeEnd: re,
      listing,
      listingTimeZone,
      bookings: bookings || [],
      blocks: blocks || [],
      seasonalPrices: seasonalPrices || [],
      metadataSeasonalPricing: listing.metadata?.seasonal_pricing || [],
      excludeBookingId,
      requestedGuests,
      listingCategorySlug,
      marketingPromos: promos || [],
      partnerUi: true,
    });

    return {
      success: true,
      data: {
        listingId,
        rangeStart: rs,
        rangeEnd: re,
        listingTimeZone,
        listingCategorySlug,
        calendar,
        bookings: bookings || [],
        blocks: blocks || [],
        listing,
      },
    };
  }

  /**
   * Maps `buildCalendar` rows (+ partner night metadata) to legacy partner calendar cell DTO.
   * Night occupancy follows [check_in, check_out); checkout morning stays AVAILABLE with `isCheckOut`.
   */
  static mapBuildCalendarToPartnerAvailability({ calendar, listingTimeZone, bookings }) {
    const availability = {};
    const bookingList = Array.isArray(bookings) ? bookings : [];
    for (const day of calendar || []) {
      const date = day.date;
      const pb = Array.isArray(day.partner_bookings) && day.partner_bookings.length ? day.partner_bookings : [];
      const pblocks = Array.isArray(day.partner_blocks) && day.partner_blocks.length ? day.partner_blocks : [];

      if (pb.length > 0) {
        const booking = pb[0];
        const cin = toListingDate(booking.check_in, listingTimeZone);
        const hasOtherCheckOut = bookingList.some(
          (b) =>
            String(b.id) !== String(booking.id) && toListingDate(b.check_out, listingTimeZone) === date,
        );
        availability[date] = {
          status: 'BOOKED',
          bookingId: booking.id,
          guestName: booking.guest_name,
          bookingStatus: booking.status,
          source: booking.source != null ? booking.source : 'PLATFORM',
          isCheckIn: Boolean(cin && date === cin),
          isCheckOut: false,
          isTransition: Boolean(cin && date === cin && hasOtherCheckOut),
          priceThb: parseFloat(booking.price_thb) || 0,
        };
        continue;
      }

      if (pblocks.length > 0) {
        const block = pblocks[0];
        availability[date] = {
          status: 'BLOCKED',
          blockId: block.id,
          reason: block.reason,
          blockType: block.type,
        };
        continue;
      }

      if (day.status === 'AVAILABLE' && day.is_transition) {
        const checkoutBooking = bookingList.find(
          (b) => toListingDate(b.check_out, listingTimeZone) === date,
        );
        availability[date] = {
          status: 'AVAILABLE',
          priceThb: day.price,
          minStay: day.min_stay,
          seasonType: null,
          label: day.season,
          marketingPromo: mapMarketingPromoToPartnerCell(day.marketing_promo),
          isTransition: false,
          isCheckOut: true,
          previousGuestName: checkoutBooking?.guest_name || null,
        };
        continue;
      }

      if (day.status === 'PAST') {
        availability[date] = {
          status: 'AVAILABLE',
          priceThb: day.price,
          minStay: day.min_stay,
          seasonType: null,
          label: day.season,
          marketingPromo: null,
          isPast: true,
        };
        continue;
      }

      if (day.status === 'BLOCKED') {
        availability[date] = {
          status: 'BLOCKED',
          reason:
            day.block_info?.type === 'insufficient_for_party'
              ? 'INSUFFICIENT_CAPACITY'
              : day.block_info?.type || 'FULL',
          blockType: 'INVENTORY',
        };
        continue;
      }

      availability[date] = {
        status: 'AVAILABLE',
        priceThb: day.price,
        minStay: day.min_stay,
        seasonType: null,
        label: day.season,
        marketingPromo: mapMarketingPromoToPartnerCell(day.marketing_promo),
        isTransition: day.is_transition === true,
        isCheckOut: false,
      };
    }
    return availability;
  }

  /** One listing row for `GET /api/v2/partner/calendar` grid (listing shell from route + SSOT cells). */
  static mapPartnerCalendarGridRow(listingUiRow, calInner) {
    if (!calInner) return null;
    const availability = CalendarQueryLayer.mapBuildCalendarToPartnerAvailability({
      calendar: calInner.calendar,
      listingTimeZone: calInner.listingTimeZone,
      bookings: calInner.bookings,
    });
    return {
      listing: listingUiRow,
      availability,
      bookingsCount: (calInner.bookings || []).length,
      blocksCount: (calInner.blocks || []).length,
    };
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

    const result = await CalendarQueryLayer.getCalendar(listingId, 365, {
      excludeBookingId,
      requestedGuests: guestsCount,
      listingCategorySlugOverride: options.listingCategorySlugOverride,
      occupyingStatusesCsv: options.occupyingStatusesCsv,
    });

    if (!result.success) {
      return result;
    }

    const listingTimeZone = String(result.data.listingTimeZone || '').trim() || undefined;
    const checkInStr = toListingDate(checkIn, listingTimeZone);
    const checkOutStr = toListingDate(checkOut, listingTimeZone);
    if (!checkInStr || !checkOutStr) {
      return {
        success: false,
        error: 'INVALID_DATE_RANGE',
        available: false,
        conflicts: [{ reason: 'INVALID_DATE_RANGE' }],
        code: 'INVALID_DATE_RANGE',
      };
    }

    const catSlug = String(result.data.listingCategorySlug || '').toLowerCase();
    const isVehicleCategory = isTransportListingCategory(catSlug);
    const isVehicleIntervalMode = isVehicleCategory;

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
      const intervalBounds = normalizeVehicleIntervalBounds(checkIn, checkOut);
      if (!intervalBounds.success) {
        return {
          success: false,
          error: 'INVALID_DATE_RANGE',
          available: false,
          conflicts: [{ reason: 'INVALID_DATE_RANGE' }],
          code: 'INVALID_DATE_RANGE',
        };
      }

      const overlap = await CalendarQueryLayer.findVehicleIntervalConflicts(
        listingId,
        intervalBounds.startIso,
        intervalBounds.endIso,
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
      if (intervalBounds.startDateKey === intervalBounds.endDateKey) {
        spanDates.push(intervalBounds.startDateKey);
      } else {
        let d = intervalBounds.startDateKey;
        while (d < intervalBounds.endDateKey) {
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
        min_remaining_spots: overlap.conflicts.length ? 0 : 1,
        max_capacity: 1,
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
        const needRem = maxCap <= 1 || isTransportListingCategory(catSlug) ? 1 : guestsCount;
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

    const result = await CalendarQueryLayer.getCalendar(listingId, ahead);
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

export default CalendarQueryLayer;
