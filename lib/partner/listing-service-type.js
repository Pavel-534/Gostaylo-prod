/**
 * Stage 26.0 — Wizard "тип услуги" (stay / transport / service / tour) ↔ категории каталога.
 * Stage 52.0 — канон из `lib/config/category-behavior.js`.
 */

import { inferListingServiceTypeFromRegistry } from '@/lib/config/category-behavior'

/** @typedef {'stay' | 'transport' | 'service' | 'tour'} ListingServiceType */

/**
 * @param {unknown} slug — listing_categories.slug
 * @returns {ListingServiceType}
 */
export function inferListingServiceTypeFromCategorySlug(slug) {
  return inferListingServiceTypeFromRegistry(slug)
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
    const out = { ...base, timezone: tz }
    for (const k of [
      'bedrooms',
      'bathrooms',
      'max_guests',
      'area',
      'property_type',
      'rent_entire_unit',
      'fuel_policy',
      'transmission',
      'fuel_type',
      'engine_cc',
      'vehicle_year',
      'seats',
      'passengers',
      'engine',
    ]) {
      delete out[k]
    }
    return out
  }
  return {
    ...base,
    timezone: tz,
    property_type: base.property_type || 'Villa',
    max_guests: base.max_guests != null ? base.max_guests : 2,
    bedrooms: base.bedrooms ?? 0,
    bathrooms: base.bathrooms ?? 0,
    area: base.area ?? 0,
  }
}
