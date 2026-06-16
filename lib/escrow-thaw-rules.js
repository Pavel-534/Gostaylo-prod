/**
 * Category-based escrow thaw (PR-#2 / PR-#3).
 * Stage 152.2 — listing TZ SSOT (`listing-timezone-ssot` + `listingYmdLocalWallTimeToUtcIso`).
 * - Housing: day after check_in @ 18:00 listing local time.
 * - Transport / yachts: booking start instant in listing TZ.
 * - Services / tours: start + 2 hours.
 */

import { addListingDays, listingYmdLocalWallTimeToUtcIso, toListingDate } from '@/lib/listing-date';
import { resolveListingTimeZoneFromMetadata } from '@/lib/geo/listing-timezone-ssot';
import { getEscrowThawBucketFromRegistry } from '@/lib/config/category-behavior';

/** @typedef {'housing' | 'transport' | 'service'} EscrowThawBucket */

/**
 * @param {string | null | undefined} categorySlug — categories.slug from listing
 * @param {string | null | undefined} [wizardProfileFromDb] — categories.wizard_profile
 * @returns {EscrowThawBucket}
 */
export function getEscrowThawBucketFromCategorySlug(categorySlug, wizardProfileFromDb) {
  return getEscrowThawBucketFromRegistry(categorySlug, wizardProfileFromDb);
}

/**
 * @param {{ listingTimeZone?: string | null, listingMetadata?: object | null }} [ctx]
 * @returns {string}
 */
export function resolveEscrowThawListingTimeZone(ctx = {}) {
  const direct = String(ctx.listingTimeZone || '').trim();
  if (direct) {
    try {
      Intl.DateTimeFormat('en-US', { timeZone: direct }).format(new Date());
      return direct;
    } catch {
      /* fall through */
    }
  }
  return resolveListingTimeZoneFromMetadata(ctx.listingMetadata);
}

const YMD_ONLY = /^(\d{4}-\d{2}-\d{2})$/;

/**
 * Booking `check_in` from DB: date-only YYYY-MM-DD or full timestamptz string.
 * @param {string | null | undefined} checkInRaw
 * @param {string} [listingTimeZone]
 * @returns {string} ISO UTC
 */
export function bookingStartUtcIsoFromRaw(checkInRaw, listingTimeZone) {
  const tz = resolveEscrowThawListingTimeZone({ listingTimeZone });
  if (checkInRaw == null || checkInRaw === '') {
    return new Date().toISOString();
  }
  const s = String(checkInRaw).trim();
  if (YMD_ONLY.test(s.slice(0, 10)) && s.length <= 10) {
    return listingYmdLocalWallTimeToUtcIso(s.slice(0, 10), 0, 0, tz) || new Date().toISOString();
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    return new Date(t).toISOString();
  }
  const ymd = toListingDate(checkInRaw, tz);
  if (ymd) {
    return listingYmdLocalWallTimeToUtcIso(ymd, 0, 0, tz) || new Date().toISOString();
  }
  return new Date().toISOString();
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * @param {{
 *   checkInRaw: string | null | undefined,
 *   categorySlug?: string | null,
 *   wizardProfile?: string | null,
 *   escrowAtIso?: string,
 *   listingTimeZone?: string | null,
 *   listingMetadata?: object | null,
 * }} args
 * escrowAtIso — fallback when start cannot be parsed (legacy callers)
 * @returns {string} ISO timestamp when funds become eligible for THAWED
 */
export function computeEscrowThawAt({
  checkInRaw,
  categorySlug,
  wizardProfile,
  escrowAtIso,
  listingTimeZone,
  listingMetadata,
}) {
  const tz = resolveEscrowThawListingTimeZone({ listingTimeZone, listingMetadata });
  const bucket = getEscrowThawBucketFromCategorySlug(categorySlug, wizardProfile);
  const fallbackEscrow = escrowAtIso || new Date().toISOString();
  const checkInYmd =
    toListingDate(checkInRaw, tz) || String(checkInRaw || '').slice(0, 10);

  if (bucket === 'transport') {
    try {
      return bookingStartUtcIsoFromRaw(checkInRaw, tz);
    } catch {
      return fallbackEscrow;
    }
  }

  if (bucket === 'service') {
    const startIso = bookingStartUtcIsoFromRaw(checkInRaw, tz);
    const startMs = Date.parse(startIso);
    if (Number.isNaN(startMs)) return fallbackEscrow;
    return new Date(startMs + TWO_HOURS_MS).toISOString();
  }

  const dayAfter = addListingDays(checkInYmd, 1);
  return listingYmdLocalWallTimeToUtcIso(dayAfter, 18, 0, tz) || fallbackEscrow;
}
