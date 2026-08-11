/**
 * Listing wizard step deep-link slugs (Stage 188.0 Iteration 4 / 200.92).
 * URL: /partner/listings/[id]?step=calendar
 * Keep in sync with LISTING_WIZARD_STEP_COUNT in wizard-constants.js (= 6).
 */

/** @type {Record<string, number>} */
export const LISTING_WIZARD_STEP_SLUG_MAP = Object.freeze({
  general: 1,
  info: 1,
  basics: 1,
  location: 2,
  photos: 3,
  gallery: 3,
  pricing: 4,
  prices: 4,
  calendar: 5,
  availability: 5,
  sync: 5,
  preview: 6,
  livepreview: 6,
})

const MAX_WIZARD_STEP = 6

/**
 * @param {string | null | undefined} stepParam
 * @returns {number | null} 1–6 or null
 */
export function resolveListingWizardStepFromParam(stepParam) {
  if (!stepParam) return null
  const key = String(stepParam).trim().toLowerCase()
  const step = LISTING_WIZARD_STEP_SLUG_MAP[key]
  if (!step || step < 1 || step > MAX_WIZARD_STEP) return null
  return step
}

/**
 * @param {number} step
 * @returns {string}
 */
export function listingWizardStepToSlug(step) {
  switch (Number(step)) {
    case 1:
      return 'general'
    case 2:
      return 'location'
    case 3:
      return 'photos'
    case 4:
      return 'pricing'
    case 5:
      return 'calendar'
    case 6:
      return 'preview'
    default:
      return 'general'
  }
}
