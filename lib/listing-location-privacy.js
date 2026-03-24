/**
 * Единые правила: круг ~500 м (приблизительно) vs точный маркер.
 * Слаги из БД: property, villa, nanny → privacy; transport, yacht, tour (+ варианты) → exact.
 * Legacy categoryId строки '1'..'4' поддерживаются для совместимости.
 */

/**
 * @param {{ categorySlug?: string | null, categoryId?: string | null }} params
 * @returns {'privacy' | 'exact'}
 */
export function getListingLocationDisplayMode({ categorySlug, categoryId } = {}) {
  const s = String(categorySlug || '').toLowerCase()

  if (/(yacht|vehicle|vehicles|transport|tour|tours|boat|car|food|dining)/.test(s)) {
    return 'exact'
  }
  if (/(nanny|babysitter|property|villa|apartment|house|real)/.test(s)) {
    return 'privacy'
  }

  if (categoryId != null && String(categoryId).trim() !== '') {
    const id = String(categoryId).toLowerCase()
    if (['2', '3', '4'].includes(id)) return 'exact'
    if (['1', 'nanny', 'property'].includes(id)) return 'privacy'
  }

  return 'privacy'
}

/** Для обратного геокодинга в MapPicker (укороченный район vs полнее) */
export function isPrivacyLocationMode(params) {
  return getListingLocationDisplayMode(params) === 'privacy'
}
