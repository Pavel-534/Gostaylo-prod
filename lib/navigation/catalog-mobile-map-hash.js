/**
 * Stage 201.78 — mobile catalog map open mode in URL **hash** (`#map`), not `?map=1`.
 *
 * Why hash: `useSearchParams` / catalog TanStack keys ignore hash, so opening the map
 * must not remount search or storm `router.replace` (that caused hang → «Ошибка загрузки»).
 * Soft-back still works: `rememberCatalogReturnHref` stores pathname+search+hash.
 */

export const CATALOG_MOBILE_MAP_HASH = 'map'

/**
 * @param {string | null | undefined} hash
 * @returns {boolean}
 */
export function isCatalogMobileMapHash(hash) {
  const raw = String(hash || '').replace(/^#/, '').trim().toLowerCase()
  return raw === CATALOG_MOBILE_MAP_HASH
}

/**
 * @returns {boolean}
 */
export function readCatalogMobileMapOpenFromLocation() {
  if (typeof window === 'undefined') return false
  return isCatalogMobileMapHash(window.location.hash)
}

/**
 * Update only the hash (no Next searchParams change → no catalog refetch).
 * @param {boolean} open
 */
export function writeCatalogMobileMapHash(open) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (open) {
    url.hash = CATALOG_MOBILE_MAP_HASH
  } else {
    url.hash = ''
  }
  const next = `${url.pathname}${url.search}${url.hash}`
  const cur = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (next === cur) return
  window.history.replaceState(window.history.state, '', next)
}
