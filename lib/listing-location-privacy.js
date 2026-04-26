/**
 * Единые правила: круг ~500 м (приблизительно) vs точный маркер.
 * Stage 53.0 — slug и legacy `categoryId` через `lib/config/category-behavior.js`.
 */

import {
  getMapLocationDisplayModeFromRegistry,
  getMapLocationDisplayModeFromLegacyCategoryId,
} from '@/lib/config/category-behavior'

/**
 * @param {{ categorySlug?: string | null, categoryId?: string | null }} params
 * @returns {'privacy' | 'exact'}
 */
export function getListingLocationDisplayMode({ categorySlug, categoryId } = {}) {
  if (categorySlug != null && String(categorySlug).trim() !== '') {
    return getMapLocationDisplayModeFromRegistry(categorySlug)
  }

  if (categoryId != null && String(categoryId).trim() !== '') {
    return getMapLocationDisplayModeFromLegacyCategoryId(categoryId)
  }

  return 'privacy'
}

/** Для обратного геокодинга в MapPicker (укороченный район vs полнее) */
export function isPrivacyLocationMode(params) {
  return getListingLocationDisplayMode(params) === 'privacy'
}
