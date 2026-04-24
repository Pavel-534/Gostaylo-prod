/**
 * Stage 26.0 — Wizard "тип услуги" (stay / transport / service / tour) ↔ категории каталога.
 */

import { isTransportListingCategory, isTourListingCategory, isYachtLikeCategory } from '@/lib/listing-category-slug'

/** @typedef {'stay' | 'transport' | 'service' | 'tour'} ListingServiceType */

/**
 * @param {unknown} slug — listing_categories.slug
 * @returns {ListingServiceType}
 */
export function inferListingServiceTypeFromCategorySlug(slug) {
  const s = String(slug || '').toLowerCase().trim()
  if (isTransportListingCategory(s) || isYachtLikeCategory(s)) return 'transport'
  if (isTourListingCategory(s)) return 'tour'
  if (s === 'services' || s === 'nanny' || s === 'babysitter' || s.includes('service')) return 'service'
  return 'stay'
}

/**
 * @param {unknown} slug
 * @param {ListingServiceType} serviceType
 */
export function categorySlugMatchesListingServiceType(slug, serviceType) {
  return inferListingServiceTypeFromCategorySlug(slug) === serviceType
}

/**
 * Базовые значения metadata при смене типа (TZ остаётся дефолтом региона, пока не выбрана карта).
 * @param {ListingServiceType} serviceType
 * @param {Record<string, unknown>} existingMeta
 */
export function defaultMetadataForListingServiceType(serviceType, existingMeta = {}) {
  const base = { ...(existingMeta && typeof existingMeta === 'object' ? existingMeta : {}) }
  const tz = typeof base.timezone === 'string' && base.timezone.trim() ? base.timezone.trim() : 'Asia/Bangkok'

  if (serviceType === 'transport') {
    return {
      ...base,
      timezone: tz,
      bedrooms: 0,
      bathrooms: 0,
      max_guests: 2,
      area: 0,
      property_type: '',
    }
  }
  if (serviceType === 'tour') {
    return {
      ...base,
      timezone: tz,
      group_size_min: base.group_size_min != null ? base.group_size_min : 1,
      group_size_max: base.group_size_max != null ? base.group_size_max : 10,
    }
  }
  if (serviceType === 'service') {
    return {
      ...base,
      timezone: tz,
      bedrooms: 0,
      bathrooms: 0,
      area: 0,
    }
  }
  return {
    ...base,
    timezone: tz,
    property_type: base.property_type || 'Villa',
    max_guests: base.max_guests != null ? base.max_guests : 2,
  }
}
