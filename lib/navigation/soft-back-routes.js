/**
 * Soft-back route resolvers (Stage 201.12–201.14).
 * Behavior stays in hooks/use-soft-back.js — these only decide show + fallbackHref.
 */

/**
 * @param {string | null | undefined} pathname
 * @returns {string}
 */
export function normalizeSoftBackPath(pathname) {
  return String(pathname || '').replace(/\/+$/, '') || '/'
}

/**
 * Marketing / static secondary (MarketingAppShell).
 * @param {string | null | undefined} pathname
 * @returns {string}
 */
export function resolveMarketingSoftBackFallback(pathname) {
  const path = normalizeSoftBackPath(pathname)
  if (path === '/help/escrow-protection' || path.startsWith('/help/escrow-protection/')) {
    return '/help'
  }
  return '/'
}

/**
 * Guest storefront nested screens (StorefrontAppShell → AppHeader).
 * Tab roots + checkout — soft-back off. PDP / settings / favorites — on (header SSOT).
 * @param {string | null | undefined} pathname
 * @returns {{ showSoftBack: boolean, softBackFallback: string }}
 */
export function resolveStorefrontSoftBack(pathname) {
  const path = normalizeSoftBackPath(pathname)

  // Listing PDP `/listings/:id` (not catalog `/listings`)
  if (/^\/listings\/[^/]+/.test(path)) {
    return { showSoftBack: true, softBackFallback: '/listings' }
  }

  if (
    path === '/profile/wallet' ||
    path.startsWith('/profile/wallet/') ||
    path === '/profile/referral' ||
    path.startsWith('/profile/referral/') ||
    path === '/profile/status' ||
    path.startsWith('/profile/status/')
  ) {
    return { showSoftBack: true, softBackFallback: '/profile' }
  }

  if (
    path === '/settings' ||
    path.startsWith('/settings/') ||
    path === '/renter/settings' ||
    path.startsWith('/renter/settings/')
  ) {
    return { showSoftBack: true, softBackFallback: '/profile' }
  }

  if (path === '/renter/favorites' || path.startsWith('/renter/favorites/')) {
    return { showSoftBack: true, softBackFallback: '/profile' }
  }

  if (
    path === '/my-bookings' ||
    path.startsWith('/my-bookings/') ||
    path === '/renter/bookings' ||
    path.startsWith('/renter/bookings/')
  ) {
    return { showSoftBack: true, softBackFallback: '/' }
  }

  if (path === '/renter/reviews/new' || path.startsWith('/renter/reviews/')) {
    return { showSoftBack: true, softBackFallback: '/my-bookings' }
  }

  if (path.startsWith('/u/') || path.startsWith('/go/')) {
    return { showSoftBack: true, softBackFallback: '/listings' }
  }

  return { showSoftBack: false, softBackFallback: '/' }
}

/** Partner More / secondary — not primary tabs, not listing wizard/edit. */
const PARTNER_MORE_SOFT_BACK_PREFIXES = [
  '/partner/finances',
  '/partner/settings',
  '/partner/payout-profiles',
  '/partner/reviews',
  '/partner/promo',
]

/**
 * Partner workspace secondary (partner layout → AppHeader).
 * @param {string | null | undefined} pathname
 * @returns {{ showSoftBack: boolean, softBackFallback: string }}
 */
export function resolvePartnerSoftBack(pathname) {
  const path = normalizeSoftBackPath(pathname)

  // Wizard / listing edit — own chrome
  if (/^\/partner\/listings\/(new|[^/]+)$/.test(path) || path.startsWith('/partner/listings/new/')) {
    return { showSoftBack: false, softBackFallback: '/partner/dashboard' }
  }

  // Nested under bookings (guest review) — not a primary tab root
  if (/\/partner\/bookings\/[^/]+\/guest-review/.test(path)) {
    return { showSoftBack: true, softBackFallback: '/partner/bookings' }
  }

  // Primary tabs — no leading back
  if (
    path === '/partner' ||
    path === '/partner/dashboard' ||
    path.startsWith('/partner/dashboard/') ||
    path === '/partner/listings' ||
    path === '/partner/calendar' ||
    path.startsWith('/partner/calendar/') ||
    path === '/partner/bookings' ||
    path.startsWith('/partner/bookings/')
  ) {
    return { showSoftBack: false, softBackFallback: '/partner/dashboard' }
  }

  for (const prefix of PARTNER_MORE_SOFT_BACK_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return { showSoftBack: true, softBackFallback: '/partner/dashboard' }
    }
  }

  return { showSoftBack: false, softBackFallback: '/partner/dashboard' }
}
