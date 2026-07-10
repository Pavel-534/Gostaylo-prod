/**
 * Stage 178.7 — mobile unified search sheet focus sections (home + catalog <md).
 * SSOT for contextual open: hero field tap → sheet scroll + field activation.
 */

/** @typedef {'what' | 'where' | 'dates' | 'guests' | 'keywords'} MobileSearchSheetFocusSection */

export const MOBILE_SEARCH_SHEET_FOCUS_SECTIONS = [
  'what',
  'where',
  'dates',
  'guests',
  'keywords',
]

/**
 * @param {string | null | undefined} value
 * @returns {MobileSearchSheetFocusSection | null}
 */
export function normalizeMobileSearchSheetFocusSection(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (MOBILE_SEARCH_SHEET_FOCUS_SECTIONS.includes(raw)) return raw
  return null
}
