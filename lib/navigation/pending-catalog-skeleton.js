/**
 * Stage 201.104 / 201.110 — Home paints a catalog skeleton only for Home → Search.
 * PDP Back must not arm this while history.back() returns to `/`.
 */

export function isStorefrontHomePath(pathname) {
  const path = String(pathname || '').split('?')[0].replace(/\/+$/, '') || '/'
  return path === '/'
}

export function isPendingCatalogListHref(href) {
  const path = String(href || '').split('?')[0].replace(/\/+$/, '') || '/'
  return path === '/listings'
}

/**
 * @param {string | null | undefined} livePathname — window.location or usePathname
 * @param {string | null | undefined} pendingHref — airento:nav-pending detail
 * @returns {boolean}
 */
export function shouldPaintPendingCatalogSkeleton(livePathname, pendingHref) {
  return isStorefrontHomePath(livePathname) && isPendingCatalogListHref(pendingHref)
}
