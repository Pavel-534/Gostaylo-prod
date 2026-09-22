/**
 * Stage 202.50 — enter middleware-guarded cabinets without App Router prefetch poison.
 *
 * Prefetching `/renter/*` or `/partner/*` while logged out (or before cookie lands)
 * caches middleware's `/auth/login` redirect in the soft-nav cache — UI can show a
 * logged-in shell while Profile still opens login (same class as Stage 201.56).
 */

/**
 * @param {{
 *   href: string,
 *   refreshUserFromServer?: (() => Promise<object|null|undefined>) | null,
 *   openLoginModal?: ((opts: { redirect?: string, mode?: string }) => void) | null,
 * }} args
 * @returns {Promise<void>}
 */
export async function navigateMiddlewareGuardedHref({
  href,
  refreshUserFromServer,
  openLoginModal,
}) {
  const target = String(href || '').trim()
  if (!target || target === '#') return

  try {
    const refreshed = await refreshUserFromServer?.()
    if (refreshed === null) {
      openLoginModal?.({ redirect: target })
      return
    }
  } catch {
    /* transient /me — still attempt hard entry */
  }

  if (typeof window !== 'undefined') {
    window.location.assign(target)
  }
}

/**
 * @param {string | null | undefined} href
 * @returns {boolean}
 */
export function isMiddlewareGuardedCabinetHref(href) {
  const path = String(href || '').split('?')[0]
  return (
    path === '/renter' ||
    path.startsWith('/renter/') ||
    path === '/partner' ||
    path.startsWith('/partner/') ||
    path === '/admin' ||
    path.startsWith('/admin/')
  )
}
