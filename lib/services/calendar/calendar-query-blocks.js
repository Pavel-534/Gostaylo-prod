import { occupyingStatusesInFilter } from '@/lib/booking-occupancy-statuses';
import { toListingDate, addListingDays, listingDateToday } from '@/lib/listing-date';
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
import { resolveActiveMarketingPromosForRange } from '@/lib/services/calendar/calendar-query-pricing';

export async function getOccupyingBookings({
  listingId,
  rangeStart,
  rangeEnd,
  occupyingStatusesCsv = occupyingStatusesInFilter(),
  includePartnerGridFields = false,
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const selectFields = includePartnerGridFields
    ? 'id,listing_id,check_in,check_out,status,guest_name,guests_count,price_thb,source'
    : 'id,check_in,check_out,status,guest_name,guests_count';
  const bookingsUrl = `${supabaseUrl}/rest/v1/bookings?select=${selectFields}&listing_id=eq.${listingId}&status=in.(${occupyingStatusesCsv})&check_out=gte.${rangeStart}&check_in=lte.${rangeEnd}&order=check_in.asc`;

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
      return await bookingsResponse.json();
    }
    console.error('[CALENDAR] REST API error:', await bookingsResponse.text());
    return [];
  } catch (e) {
    console.error('[CALENDAR] Fetch error:', e);
    return [];
  }
}

export async function getCalendarBlocks({ supabase, listingId, rangeStart, rangeEnd }) {
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
  return blocks || [];
}

export function buildCalendar({
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
  const g = maxCapacity <= 1 || isVehicleCategory ? 1 : rawRequested;

  const guestsPerNight = new Map();
  const bookingCheckouts = new Set();
  const bookingCheckins = new Set();
  const bookingsByNight = partnerUi ? new Map() : null;
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
    const bookedGuests = isVehicleCategory ? (rawBookedLoad > 0 ? maxCapacity : 0) : rawBookedLoad;
    const blockedUnits = blockedUnitsPerNight.get(dateStr) || 0;
    const remainingSpots = Math.max(0, maxCapacity - bookedGuests - blockedUnits);

    const isCheckoutDay = bookingCheckouts.has(dateStr);
    const isPast = dateStr < today;

    const { dailyPrice, seasonLabel } = calculateDailyPrice(
      basePrice,
      dateStr,
      seasonalPrices,
      metadataSeasonalPricing,
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

export async function getCalendar(listingId, daysAhead = 180, options = {}) {
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

  const bookings = await getOccupyingBookings({
    listingId,
    rangeStart,
    rangeEnd,
    occupyingStatusesCsv,
    includePartnerGridFields: false,
  });
  const blocks = await getCalendarBlocks({
    supabase,
    listingId,
    rangeStart,
    rangeEnd,
  });
  const { data: seasonalPrices, error: seasonalError } = await supabase
    .from('seasonal_prices')
    .select('*')
    .eq('listing_id', listingId)
    .order('start_date', { ascending: true });
  if (seasonalError) {
    console.error('Error fetching seasonal prices:', seasonalError);
  }

  const calendar = buildCalendar({
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

export async function getCalendarForDateRange(listingId, rangeStart, rangeEnd, options = {}) {
  const requestedGuests = Math.max(1, parseInt(options.requestedGuests ?? 1, 10) || 1);
  const excludeBookingId = options.excludeBookingId ?? null;
  const marketingPromoRows = Array.isArray(options.marketingPromoRows) ? options.marketingPromoRows : null;
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

  const bookings = await getOccupyingBookings({
    listingId,
    rangeStart: rs,
    rangeEnd: re,
    occupyingStatusesCsv,
    includePartnerGridFields: true,
  });
  const blocks = await getCalendarBlocks({
    supabase,
    listingId,
    rangeStart: rs,
    rangeEnd: re,
  });
  const { data: seasonalPrices, error: seasonalError } = await supabase
    .from('seasonal_prices')
    .select('*')
    .eq('listing_id', listingId)
    .order('start_date', { ascending: true });
  if (seasonalError) {
    console.error('Error fetching seasonal prices:', seasonalError);
  }

  const promos =
    marketingPromoRows == null
      ? await resolveActiveMarketingPromosForRange(supabase)
      : marketingPromoRows;

  const calendar = buildCalendar({
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

export function mapBuildCalendarToPartnerAvailability({ calendar, listingTimeZone, bookings }) {
  const availability = {};
  const bookingList = Array.isArray(bookings) ? bookings : [];
  for (const day of calendar || []) {
    const date = day.date;
    const pb =
      Array.isArray(day.partner_bookings) && day.partner_bookings.length ? day.partner_bookings : [];
    const pblocks = Array.isArray(day.partner_blocks) && day.partner_blocks.length ? day.partner_blocks : [];

    if (pb.length > 0) {
      const booking = pb[0];
      const cin = toListingDate(booking.check_in, listingTimeZone);
      const hasOtherCheckOut = bookingList.some(
        (b) => String(b.id) !== String(booking.id) && toListingDate(b.check_out, listingTimeZone) === date,
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
        blockType: block.type ?? (block.reason ? String(block.reason) : 'FULL'),
      };
      continue;
    }

    if (day.status === 'AVAILABLE' && day.is_transition) {
      const checkoutBooking = bookingList.find((b) => toListingDate(b.check_out, listingTimeZone) === date);
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

export function mapPartnerCalendarGridRow(listingUiRow, calInner) {
  if (!calInner) return null;
  const availability = mapBuildCalendarToPartnerAvailability({
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
