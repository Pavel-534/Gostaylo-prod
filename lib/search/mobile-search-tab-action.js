/**
 * Stage 178.8 — mobile bottom tab «Поиск» SSOT.
 * Home `/` → navigateToCatalog with current filters (listener in PlatformHomeContent).
 * Catalog `/listings` → scroll top + open CatalogMobileSearchSheet (listener in listings-catalog-client).
 */

export const MOBILE_SEARCH_TAB_ACTION_EVENT = 'gostaylo:mobile-search-tab'

/** @param {CustomEvent<{ source?: string }>} event */
export function isMobileSearchTabActionEvent(event) {
  return event?.type === MOBILE_SEARCH_TAB_ACTION_EVENT
}

/**
 * Dispatch when user taps bottom-nav Search on home or catalog (pages register listeners).
 * @param {{ source?: string }} [detail]
 */
export function dispatchMobileSearchTabAction(detail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(MOBILE_SEARCH_TAB_ACTION_EVENT, {
      detail,
    }),
  )
}

/**
 * @param {() => void} handler
 * @returns {() => void} unsubscribe
 */
export function subscribeMobileSearchTabAction(handler) {
  if (typeof window === 'undefined') return () => {}
  const listener = () => handler()
  window.addEventListener(MOBILE_SEARCH_TAB_ACTION_EVENT, listener)
  return () => window.removeEventListener(MOBILE_SEARCH_TAB_ACTION_EVENT, listener)
}

/**
 * @param {string | null | undefined} pathname
 * @returns {boolean}
 */
export function isMobileSearchTabInterceptPath(pathname) {
  const normalized = String(pathname || '').replace(/\/+$/, '') || '/'
  return normalized === '/' || normalized === '/listings'
}
