/**
 * Stage 201.74 — catalog → PDP return URL (query + semantic + filters).
 * Soft-back from listing PDP restores this href instead of bare `/listings`.
 */

const STORAGE_KEY = 'airento:catalog-return-href-v1'

/**
 * @param {string | null | undefined} href
 * @returns {boolean}
 */
export function isCatalogListingsHref(href) {
  const raw = String(href || '').trim()
  if (!raw) return false
  try {
    const u = new URL(raw, 'https://airento.local')
    const path = (u.pathname || '/').replace(/\/+$/, '') || '/'
    return path === '/listings'
  } catch {
    return false
  }
}

/**
 * @param {string | null | undefined} href
 * @returns {boolean}
 */
export function isListingPdpHref(href) {
  const raw = String(href || '').trim()
  if (!raw) return false
  try {
    const u = new URL(raw, 'https://airento.local')
    const path = (u.pathname || '/').replace(/\/+$/, '') || '/'
    return /^\/listings\/[^/]+/.test(path)
  } catch {
    return false
  }
}

/**
 * @param {string | null | undefined} href
 * @returns {string | null}
 */
export function normalizeCatalogReturnHref(href) {
  const raw = String(href || '').trim()
  if (!raw || !isCatalogListingsHref(raw)) return null
  try {
    const u = new URL(raw, 'https://airento.local')
    const path = (u.pathname || '/').replace(/\/+$/, '') || '/'
    return `${path}${u.search || ''}${u.hash || ''}`
  } catch {
    return null
  }
}

export function clearCatalogReturnHref() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* private mode / quota */
  }
}

/**
 * Remember current (or explicit) catalog URL before leaving to PDP.
 * @param {string | null | undefined} [href]
 */
export function rememberCatalogReturnHref(href) {
  if (typeof window === 'undefined') return
  const live =
    href != null
      ? String(href)
      : `${window.location.pathname || ''}${window.location.search || ''}${window.location.hash || ''}`
  const next = normalizeCatalogReturnHref(live)
  if (!next) return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* private mode / quota */
  }
}

/**
 * Call immediately before navigating to a listing PDP.
 * Saves catalog query when leaving `/listings`; clears stale return otherwise.
 */
export function captureCatalogReturnBeforePdp() {
  if (typeof window === 'undefined') return
  const path = String(window.location.pathname || '').replace(/\/+$/, '') || '/'
  if (path === '/listings') {
    rememberCatalogReturnHref()
    return
  }
  clearCatalogReturnHref()
}

/**
 * @returns {string | null}
 */
export function peekCatalogReturnHref() {
  if (typeof window === 'undefined') return null
  try {
    return normalizeCatalogReturnHref(window.sessionStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

/**
 * Soft-back fallback for listing PDP: last catalog URL or bare `/listings`.
 * @param {string | null | undefined} [defaultHref='/listings']
 * @returns {string}
 */
export function resolveListingPdpSoftBackHref(defaultHref = '/listings') {
  return peekCatalogReturnHref() || String(defaultHref || '/listings').trim() || '/listings'
}
