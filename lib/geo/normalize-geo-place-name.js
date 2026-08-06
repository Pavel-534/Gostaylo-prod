/**
 * Stage 200.45 — normalize geo place labels to reduce provisional duplicates.
 */

/**
 * Display form: trim + collapse spaces + capitalize words (locale-aware).
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function normalizeGeoPlaceName(name) {
  const trimmed = String(name || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!trimmed) return ''
  return trimmed.replace(/(^|[\s\-/'(.])(\p{L})/gu, (full, prefix, ch) => {
    return prefix + ch.toLocaleUpperCase('ru-RU')
  })
}

/**
 * Comparison key for duplicate detection (case/diacritics/ё insensitive).
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function normalizeGeoPlaceKey(name) {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ё/g, 'е')
}
