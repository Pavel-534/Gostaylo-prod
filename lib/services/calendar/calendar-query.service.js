/**
 * GoStayLo — Calendar query facade
 * Delegates to specialized query modules while preserving legacy API.
 */

import { toListingDate, addListingDays, listingDateToday } from '@/lib/listing-date';
import { getDateRange } from '@/lib/services/calendar/calendar-shared';
import {
  getCalendar as getCalendarBlocksFacade,
  getCalendarForDateRange as getCalendarForDateRangeBlocksFacade,
  getCalendarBlocks,
  getOccupyingBookings,
  buildCalendar,
  mapBuildCalendarToPartnerAvailability,
  mapPartnerCalendarGridRow,
} from '@/lib/services/calendar/calendar-query-blocks';
import {
  checkAvailability,
  findVehicleIntervalConflicts,
  checkBatchAvailability,
} from '@/lib/services/calendar/calendar-query-availability';

/**
 * Calendar query / availability SSOT (split from legacy monolith).
 */
export class CalendarQueryLayer {
  static async getCalendar(listingId, daysAhead = 180, options = {}) {
    return getCalendarBlocksFacade(listingId, daysAhead, options);
  }

  /**
   * @param {{ excludeBookingId?: string|null, requestedGuests?: number, listingCategorySlug?: string }} params
   */
  static buildCalendar(params) {
    return buildCalendar(params);
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
    return getCalendarForDateRangeBlocksFacade(listingId, rangeStart, rangeEnd, options);
  }

  /**
   * Maps `buildCalendar` rows (+ partner night metadata) to legacy partner calendar cell DTO.
   * Night occupancy follows [check_in, check_out); checkout morning stays AVAILABLE with `isCheckOut`.
   */
  static mapBuildCalendarToPartnerAvailability({ calendar, listingTimeZone, bookings }) {
    return mapBuildCalendarToPartnerAvailability({ calendar, listingTimeZone, bookings });
  }

  /** One listing row for `GET /api/v2/partner/calendar` grid (listing shell from route + SSOT cells). */
  static mapPartnerCalendarGridRow(listingUiRow, calInner) {
    return mapPartnerCalendarGridRow(listingUiRow, calInner);
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
    return checkAvailability(listingId, checkIn, checkOut, options);
  }

  static async findVehicleIntervalConflicts(listingId, checkInIso, checkOutIso, options = {}) {
    return findVehicleIntervalConflicts(listingId, checkInIso, checkOutIso, options);
  }

  static async checkBatchAvailability(listingIds = [], checkIn, checkOut, options = {}) {
    return checkBatchAvailability(listingIds, checkIn, checkOut, options);
  }

  static async getCalendarBlocks(params) {
    return getCalendarBlocks(params);
  }

  static async getOccupyingBookings(params) {
    return getOccupyingBookings(params);
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

    const result = await getCalendarBlocksFacade(listingId, ahead);
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
