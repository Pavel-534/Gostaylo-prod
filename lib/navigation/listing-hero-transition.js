/**
 * View Transitions API — catalog card image → PDP hero morph (Stage 171.22).
 * Stage 200.15 — also signals optimistic progress via `airento:nav-pending`.
 */

import { dispatchOptimisticNavPending } from './optimistic-nav-href.js'
import { persistLiveRouteScroll } from './route-scroll-memory.js'

/**
 * Prefetch path without booking query (route chunk / RSC shell).
 * @param {string | number | null | undefined} listingId
 * @returns {string | null}
 */
export function listingPdpPrefetchPath(listingId) {
  const id = String(listingId || '').trim()
  if (!id) return null
  return `/listings/${encodeURIComponent(id)}`
}

/**
 * @param {import('next/navigation').AppRouterInstance | null | undefined} router
 * @param {string | number | null | undefined} listingId
 */
export function prefetchListingPdp(router, listingId) {
  const path = listingPdpPrefetchPath(listingId)
  if (!path || !router?.prefetch) return
  try {
    router.prefetch(path)
  } catch {
    /* ignore */
  }
}

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
 * @param {string | null | undefined} [href] — full detail URL (signals progress bar)
 */
export function navigateWithListingHeroTransition(navigate, listingId, href) {
  persistLiveRouteScroll(href ? { anchorHref: href } : null)
  if (href) dispatchOptimisticNavPending(href)

  if (!supportsListingHeroViewTransition() || !listingId) {
    navigate()
    return
  }

  document.startViewTransition(() => {
    navigate()
  })
}
