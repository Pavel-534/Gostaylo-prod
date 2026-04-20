/**
 * Category-based escrow thaw (PR-#2 / PR-#3).
 * - Housing (property): day after check_in @ 18:00 (listing TZ, default Asia/Bangkok).
 * - Transport / yachts: thaw at the booking start instant (check_in timestamp or start of check-in day in listing TZ).
 * - Services / nannies / tours: start instant + 2 hours (uses full timestamps when present).
 */

import { addListingDays, getListingDateTimeZone, toListingDate } from '@/lib/listing-date';
import {
  isTransportListingCategory,
  isYachtLikeCategory,
} from '@/lib/listing-category-slug';

/** @typedef {'housing' | 'transport' | 'service'} EscrowThawBucket */

/**
 * @param {string | null | undefined} categorySlug — categories.slug from listing
 * @returns {EscrowThawBucket}
 */
export function getEscrowThawBucketFromCategorySlug(categorySlug) {
  const s = String(categorySlug || '').toLowerCase();
  if (s === 'property' || s === 'properties') return 'housing';
  if (isTransportListingCategory(categorySlug)) return 'transport';
  if (isYachtLikeCategory(categorySlug)) return 'transport';
  if (
    s === 'services' ||
    s === 'service' ||
    s === 'nanny' ||
    s === 'nannies'
  ) {
    return 'service';
  }
  if (s === 'tours' || s.includes('tour')) return 'service';
  return 'housing';
}

/**
 * Convert YYYY-MM-DD + local wall time in listing TZ to ISO UTC (Bangkok branch uses fixed +7 offset).
 * @param {string} ymd
 * @param {number} hour 0-23
 * @param {number} minute 0-59
 */
export function ymdLocalBangkokToUtcIso(ymd, hour, minute) {
  const raw = String(ymd || '').slice(0, 10);
  const [y, m, d] = raw.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return new Date().toISOString();
  }
  const tz = getListingDateTimeZone();
  if (tz === 'Asia/Bangkok') {
    const utcMs = Date.UTC(y, m - 1, d, hour - 7, minute, 0);
    return new Date(utcMs).toISOString();
  }
  const utcMs = Date.UTC(y, m - 1, d, hour, minute, 0);
  return new Date(utcMs).toISOString();
}

const YMD_ONLY = /^(\d{4}-\d{2}-\d{2})$/;

/**
 * Booking `check_in` from DB: date-only YYYY-MM-DD or full timestamptz string.
 * @param {string | null | undefined} checkInRaw
 * @returns {string} ISO UTC
 */
export function bookingStartUtcIsoFromRaw(checkInRaw) {
  if (checkInRaw == null || checkInRaw === '') {
    return new Date().toISOString();
  }
  const s = String(checkInRaw).trim();
  if (YMD_ONLY.test(s.slice(0, 10)) && s.length <= 10) {
    return ymdLocalBangkokToUtcIso(s.slice(0, 10), 0, 0);
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    return new Date(t).toISOString();
  }
  const ymd = toListingDate(checkInRaw);
  if (ymd) return ymdLocalBangkokToUtcIso(ymd, 0, 0);
  return new Date().toISOString();
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * @param {{
 *   checkInRaw: string | null | undefined,
 *   categorySlug?: string | null,
 *   escrowAtIso?: string,
 * }} args
 * escrowAtIso — fallback when start cannot be parsed (legacy callers)
 * @returns {string} ISO timestamp when funds become eligible for THAWED
 */
export function computeEscrowThawAt({ checkInRaw, categorySlug, escrowAtIso }) {
  const bucket = getEscrowThawBucketFromCategorySlug(categorySlug);
  const fallbackEscrow = escrowAtIso || new Date().toISOString();
  const checkInYmd =
    toListingDate(checkInRaw) || String(checkInRaw || '').slice(0, 10);

  if (bucket === 'transport') {
    try {
      return bookingStartUtcIsoFromRaw(checkInRaw);
    } catch {
      return fallbackEscrow;
    }
  }

  if (bucket === 'service') {
    const startIso = bookingStartUtcIsoFromRaw(checkInRaw);
    const startMs = Date.parse(startIso);
    if (Number.isNaN(startMs)) return fallbackEscrow;
    return new Date(startMs + TWO_HOURS_MS).toISOString();
  }

  const dayAfter = addListingDays(checkInYmd, 1);
  return ymdLocalBangkokToUtcIso(dayAfter, 18, 0);
}
