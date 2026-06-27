/**
 * View Transitions API — catalog card image → PDP hero morph (Stage 171.22).
 */

/**
 * @param {string | number | null | undefined} listingId
 * @returns {string | undefined}
 */
export function listingHeroTransitionName(listingId) {
  const id = String(listingId || '').trim()
  if (!id) return undefined
  return `listing-hero-${id}`
}

/**
 * @returns {boolean}
 */
export function supportsListingHeroViewTransition() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return false
  return typeof document.startViewTransition === 'function'
}

/**
 * @param {string | number | null | undefined} listingId
 * @returns {import('react').CSSProperties | undefined}
 */
export function listingHeroTransitionStyle(listingId) {
  const name = listingHeroTransitionName(listingId)
  if (!name) return undefined
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
    return undefined
  }
  return { viewTransitionName: name }
}

/**
 * @param {() => void} navigate
 * @param {string | number | null | undefined} listingId
 */
export function navigateWithListingHeroTransition(navigate, listingId) {
  if (!supportsListingHeroViewTransition() || !listingId) {
    navigate()
    return
  }

  document.startViewTransition(() => {
    navigate()
  })
}
