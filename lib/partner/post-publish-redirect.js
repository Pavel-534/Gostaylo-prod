/**
 * Post-publish redirect — partner calendar onboarding (Stage 188.0).
 * SSOT for wizard publish and listings-card publish flows.
 */

/**
 * @param {string | null | undefined} listingId
 * @returns {string}
 */
export function resolvePostPublishCalendarOnboardingUrl(listingId) {
  if (!listingId) return '/partner/listings'
  return `/partner/calendar?listingId=${encodeURIComponent(String(listingId))}&onboarding=true`
}
