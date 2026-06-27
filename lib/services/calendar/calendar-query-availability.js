import { occupyingStatusesInFilter } from '@/lib/booking/status-sets.js';
import { toListingDate, addListingDays } from '@/lib/listing-date';
import { normalizeVehicleIntervalBounds } from '@/lib/services/vehicle-conflict-utils';
import { isTransportListingCategory } from '@/lib/listing-category-slug';
import { getCalendar } from '@/lib/services/calendar/calendar-query-blocks';

export async function checkAvailability(listingId, checkIn, checkOut, options = {}) {
  const guestsCount = Math.max(1, parseInt(options.guestsCount ?? options.guests_count ?? 1, 10) || 1);
  const excludeBookingId = options.excludeBookingId ?? options.exclude_booking_id ?? null;

  const result = await getCalendar(listingId, 365, {
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
    const intervalBounds = normalizeVehicleIntervalBounds(checkIn, checkOut, {
      listingTimeZone,
    });
    if (!intervalBounds.success) {
      return {
        success: false,
        error: 'INVALID_DATE_RANGE',
        available: false,
        conflicts: [{ reason: 'INVALID_DATE_RANGE' }],
        code: 'INVALID_DATE_RANGE',
      };
    }

    const overlap = await findVehicleIntervalConflicts(
      listingId,
      intervalBounds.startIso,
      intervalBounds.endIso,
      {
        excludeBookingId,
        occupyingStatusesCsv: options.occupyingStatusesCsv || occupyingStatusesInFilter(),
      },
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

export async function findVehicleIntervalConflicts(listingId, checkInIso, checkOutIso, options = {}) {
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
    const filtered = rows.filter((row) => !excludeBookingId || String(row.id) !== String(excludeBookingId));
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

export async function checkBatchAvailability(listingIds = [], checkIn, checkOut, options = {}) {
  const ids = Array.isArray(listingIds) ? listingIds.filter(Boolean) : [];
  const results = new Map();
  for (const listingId of ids) {
    const res = await checkAvailability(listingId, checkIn, checkOut, options);
    results.set(String(listingId), res);
  }
  return results;
}
