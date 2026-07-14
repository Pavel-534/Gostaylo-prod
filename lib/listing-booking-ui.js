/**
 * Listing booking UX: category-driven exclusive vs shared-inventory UI.
 * DB slugs: property, vehicles, tours, yachts (+ optional services / nanny).
 */

import {
  normalizeListingCategorySlugForSearch,
  isTransportListingCategory,
  isYachtLikeCategory,
} from '@/lib/listing-category-slug'

/** Villas / apartments / homes — single-unit calendar semantics in UI */
export function isExclusiveInventoryCategory(categorySlug) {
  const n = normalizeListingCategorySlugForSearch(categorySlug)
  return n === 'property' || isTransportListingCategory(categorySlug)
}

/** Tours, yachts, services — show spots + private / special quote */
export function isSharedInventoryCategory(categorySlug) {
  const s = String(categorySlug || '').toLowerCase()
  if (['tours', 'yachts', 'services', 'nanny', 'service'].includes(s)) return true
  if (s.includes('tour') || s.includes('yacht') || s.includes('boat')) return true
  return false
}

/**
 * Подписи в виджете бронирования: «ночи» vs «сутки».
 * День: транспорт, яхты/лодки, туры (по суткам/дням как аренда на дату).
 */
export function getListingRentalPeriodMode(categorySlug) {
  const s = String(categorySlug || '').toLowerCase()
  if (isTransportListingCategory(categorySlug)) return 'day'
  if (isYachtLikeCategory(categorySlug)) return 'day'
  if (s === 'tours' || s.includes('tour')) return 'day'
  return 'night'
}

/**
 * Whole-vessel charter: yacht-like category + metadata.rent_entire_unit → same UX as villa (exclusive).
 */
export function isWholeVesselListing(categorySlug, metadata = {}) {
  if (!metadata || !metadata.rent_entire_unit) return false
  return isYachtLikeCategory(categorySlug)
}

/**
 * @param {string | null | undefined} categorySlug
 * @param {number} [maxCapacity]
 * @param {Record<string, unknown>} [metadata] listing.metadata
 * @returns {'exclusive' | 'shared'}
 */
export function getListingBookingUiMode(categorySlug, maxCapacity = 1, metadata = {}) {
  if (isWholeVesselListing(categorySlug, metadata)) return 'exclusive'
  if (isSharedInventoryCategory(categorySlug)) return 'shared'
  if (isExclusiveInventoryCategory(categorySlug)) return 'exclusive'
  const cap = Math.max(1, parseInt(maxCapacity, 10) || 1)
  return cap > 1 ? 'shared' : 'exclusive'
}

/**
 * Calendar / atomic booking: one occupying reservation blocks the whole listing
 * (villa, car, whole-yacht charter) — not per-guest “spots” like tours.
 * SSOT for JS calendar; SQL parity in create_booking_atomic_v1 (Stage 187.8).
 *
 * @param {string | null | undefined} categorySlug
 * @param {Record<string, unknown>} [metadata]
 */
export function isWholeUnitCalendarInventory(categorySlug, metadata = {}) {
  if (isWholeVesselListing(categorySlug, metadata)) return true
  if (isSharedInventoryCategory(categorySlug)) return false
  if (isExclusiveInventoryCategory(categorySlug)) return true
  return false
}
