/**
 * Listing wizard step deep-link slugs (Stage 188.0 Iteration 4).
 * URL: /partner/listings/[id]?step=photos
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
  preview: 5,
})

/**
 * @param {string | null | undefined} stepParam
 * @returns {number | null} 1–5 or null
 */
export function resolveListingWizardStepFromParam(stepParam) {
  if (!stepParam) return null
  const key = String(stepParam).trim().toLowerCase()
  const step = LISTING_WIZARD_STEP_SLUG_MAP[key]
  if (!step || step < 1 || step > 5) return null
  return step
}

/**
 * @param {number} step
 * @returns {string}
 */
export function listingWizardStepToSlug(step) {
  switch (step) {
    case 1:
      return 'general'
    case 2:
      return 'location'
    case 3:
      return 'photos'
    case 4:
      return 'pricing'
    case 5:
      return 'preview'
    default:
      return 'general'
  }
}
