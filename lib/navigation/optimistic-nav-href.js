/**
 * Stage 200.13 / 200.14 — pure helpers for optimistic shell navigation (no Next imports).
 */

export const AIRENTO_NAV_PENDING_EVENT = 'airento:nav-pending'

/** Storefront mobile dock destinations. */
export const STOREFRONT_NAV_PREFETCH_PATHS = Object.freeze([
  '/',
  '/listings',
  '/messages',
  '/renter/profile',
])

/** Partner mobile dock destinations. */
export const PARTNER_NAV_PREFETCH_PATHS = Object.freeze([
  '/partner/dashboard',
  '/partner/listings',
  '/partner/calendar',
  '/partner/bookings',
])

/** Desktop public header (Stage 200.14). */
export const PUBLIC_HEADER_NAV_PREFETCH_PATHS = Object.freeze([
  '/listings',
  '/profile/referral',
  '/help',
])

/** Partner desktop/drawer sidebar (Stage 200.14). */
export const PARTNER_SIDEBAR_PREFETCH_PATHS = Object.freeze([
  '/partner/dashboard',
  '/partner/listings',
  '/partner/promo',
  '/profile/referral',
  '/partner/calendar',
  '/partner/bookings',
  '/partner/reviews',
  '/messages',
  '/partner/finances',
  '/partner/payout-profiles',
  '/partner/settings',
  '/my-bookings',
])

/** Profile hub tabs (Stage 200.14). */
export const PROFILE_HUB_PREFETCH_PATHS = Object.freeze([
  '/profile/referral',
  '/profile/wallet',
  '/profile/status',
])

/** Avatar menu destinations (Stage 200.16). No `/partner/*` — middleware login redirects poison App Router prefetch cache (Stage 201.56). */
export const USER_MENU_PREFETCH_PATHS = Object.freeze([
  '/renter/profile',
  '/my-bookings',
  '/messages',
  '/profile/referral',
  '/renter/favorites',
])

/**
 * Fire-and-forget progress signal (no React pending state).
 * Prefer `useOptimisticNavHref().markPending` when chrome should paint active.
 * @param {string} href
 */
export function dispatchOptimisticNavPending(href) {
  if (typeof window === 'undefined') return
  const next = String(href || '').trim()
  if (!next || next === '#') return
  window.dispatchEvent(
    new CustomEvent(AIRENTO_NAV_PENDING_EVENT, { detail: { href: next } }),
  )
}

/**
 * @param {string | null | undefined} pendingHref
 * @param {string} href
 * @returns {boolean}
 */
export function matchesOptimisticNavHref(pendingHref, href) {
  const pending = String(pendingHref || '').trim()
  const target = String(href || '').trim()
  if (!pending || !target || target === '#') return false
  if (pending === target) return true

  // Query links (e.g. /listings?group=destinations) only match exact href.
  if (target.includes('?')) return false

  const pendingPath = pending.split('?')[0]
  const targetPath = target

  // Pending with query must not light a bare path sibling (listings vs destinations).
  if (pending.includes('?') && pendingPath === targetPath) return false

  if (targetPath === '/') return pendingPath === '/'
  if (pendingPath === targetPath) return true
  return pendingPath.startsWith(`${targetPath}/`)
}

/**
 * Bottom-dock matching: `/listings?…` still lights the Search tab (`/listings`).
 * @param {string | null | undefined} pendingHref
 * @param {string} href
 * @returns {boolean}
 */
export function matchesOptimisticNavTab(pendingHref, href) {
  const pending = String(pendingHref || '').trim()
  const target = String(href || '').trim()
  if (!pending || !target || target === '#') return false
  const pendingPath = pending.split('?')[0]
  const targetPath = target.split('?')[0]
  if (targetPath === '/') return pendingPath === '/'
  if (pendingPath === targetPath) return true
  return pendingPath.startsWith(`${targetPath}/`)
}

/**
 * Exclusive dock highlight: while pending, only the destination tab is active
 * (avoids Home+Search both green during listings → home).
 *
 * @param {{
 *   routeActive: boolean,
 *   pendingHref?: string | null,
 *   itemHref: string,
 *   activeMatches?: string[] | null,
 * }} args
 * @returns {boolean}
 */
export function isOptimisticDockTabActive({
  routeActive,
  pendingHref,
  itemHref,
  activeMatches = null,
}) {
  const pending = String(pendingHref || '').trim()
  if (pending) {
    if (matchesOptimisticNavTab(pending, itemHref)) return true
    if (Array.isArray(activeMatches) && activeMatches.length) {
      return activeMatches.some((match) => matchesOptimisticNavTab(pending, match))
    }
    return false
  }
  return Boolean(routeActive)
}
