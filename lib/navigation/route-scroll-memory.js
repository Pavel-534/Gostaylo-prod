/**
 * Stage 200.17 / 201.20 — session scroll memory for soft back-nav.
 * Entry may include anchorHref + anchorTop so restore survives image/layout shift.
 */

const STORAGE_KEY = 'airento:route-scroll-v1'

/** Soft-back / programmatic back — set before router.back/push (Stage 201.18). */
let pendingRouteScrollRestore = false

export function markPendingRouteScrollRestore() {
  pendingRouteScrollRestore = true
}

export function consumePendingRouteScrollRestore() {
  const value = pendingRouteScrollRestore
  pendingRouteScrollRestore = false
  return value
}

/**
 * @param {string} routeKey
 * @returns {boolean}
 */
export function isScrollMemoryRouteKey(routeKey) {
  const key = String(routeKey || '').trim()
  if (!key) return false
  return (
    key === '/' ||
    key === 'home' ||
    key.startsWith('listings:') ||
    key.startsWith('my-bookings:') ||
    key.startsWith('/listings') ||
    key.startsWith('/my-bookings')
  )
}

/**
 * @param {unknown} raw
 * @returns {{ y: number, anchorHref?: string, anchorTop?: number } | null}
 */
export function normalizeRouteScrollEntry(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const y = Math.max(0, Math.round(raw))
    return y > 0 ? { y } : null
  }
  if (!raw || typeof raw !== 'object') return null
  const y = Math.max(0, Math.round(Number(raw.y) || 0))
  if (y <= 0 && !raw.anchorHref) return null
  const entry = { y }
  const href = String(raw.anchorHref || '').trim()
  if (href) entry.anchorHref = href
  const top = Number(raw.anchorTop)
  if (Number.isFinite(top)) entry.anchorTop = Math.round(top)
  return entry
}

function readMap() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const map = JSON.parse(raw)
    return map && typeof map === 'object' ? map : {}
  } catch {
    return null
  }
}

function writeMap(map) {
  if (typeof window === 'undefined' || !map) return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* private mode / quota */
  }
}

/**
 * @param {string} routeKey
 * @param {number | { y?: number, anchorHref?: string, anchorTop?: number }} yOrEntry
 */
export function saveRouteScroll(routeKey, yOrEntry) {
  if (typeof window === 'undefined') return
  const key = String(routeKey || '').trim()
  if (!isScrollMemoryRouteKey(key)) return
  const map = readMap()
  if (!map) return

  const prev = normalizeRouteScrollEntry(map[key])
  const incoming =
    typeof yOrEntry === 'number'
      ? { y: Math.max(0, Math.round(yOrEntry || 0)) }
      : normalizeRouteScrollEntry(yOrEntry) || { y: 0 }

  // Do not clobber a real entry with bare 0 (Next often resets scroll before unmount).
  if ((incoming.y || 0) <= 0 && !incoming.anchorHref) {
    if (prev && (prev.y > 0 || prev.anchorHref)) return
  }

  const next = {
    y: incoming.y > 0 ? incoming.y : prev?.y || 0,
    ...(incoming.anchorHref
      ? { anchorHref: incoming.anchorHref, anchorTop: incoming.anchorTop }
      : prev?.anchorHref
        ? { anchorHref: prev.anchorHref, anchorTop: prev.anchorTop }
        : {}),
  }
  if (next.y <= 0 && !next.anchorHref) return
  map[key] = next
  writeMap(map)
}

/**
 * @param {string} routeKey
 * @returns {{ y: number, anchorHref?: string, anchorTop?: number } | null}
 */
export function peekRouteScrollEntry(routeKey) {
  if (typeof window === 'undefined') return null
  const key = String(routeKey || '').trim()
  if (!key) return null
  const map = readMap()
  if (!map) return null
  return normalizeRouteScrollEntry(map[key])
}

/**
 * Peek Y only (legacy helpers / tests).
 * @param {string} routeKey
 * @returns {number | null}
 */
export function peekRouteScroll(routeKey) {
  const entry = peekRouteScrollEntry(routeKey)
  return entry && entry.y > 0 ? entry.y : null
}

/**
 * @param {string} routeKey
 * @returns {{ y: number, anchorHref?: string, anchorTop?: number } | null}
 */
export function consumeRouteScrollEntry(routeKey) {
  if (typeof window === 'undefined') return null
  const key = String(routeKey || '').trim()
  if (!key) return null
  const map = readMap()
  if (!map) return null
  const entry = normalizeRouteScrollEntry(map[key])
  delete map[key]
  writeMap(map)
  return entry
}

/**
 * @param {string} routeKey
 * @returns {number | null}
 */
export function consumeRouteScroll(routeKey) {
  const entry = consumeRouteScrollEntry(routeKey)
  return entry && entry.y > 0 ? entry.y : null
}

/**
 * @param {string} [searchParamsKey]
 * @returns {string}
 */
export function listingsCatalogScrollKey(searchParamsKey = '') {
  return `listings:${String(searchParamsKey || '')}`
}

/** Home storefront scroll memory key (Stage 201.16). */
export function homeScrollKey() {
  return 'home'
}

/**
 * Map location → scroll memory key (Stage 201.18).
 * @param {string | null | undefined} pathname
 * @param {string} [search]
 * @returns {string | null}
 */
export function routeScrollKeyFromLocation(pathname, search = '') {
  const raw = String(pathname || '').replace(/\/+$/, '') || '/'
  if (raw === '/') return homeScrollKey()
  if (raw === '/listings') return listingsCatalogScrollKey(String(search || ''))
  if (raw === '/my-bookings' || raw.startsWith('/my-bookings/')) return 'my-bookings:'
  if (raw === '/renter/bookings' || raw.startsWith('/renter/bookings/')) return 'my-bookings:'
  return null
}

/**
 * @param {string} anchorHref
 * @returns {string}
 */
export function normalizeScrollAnchorPath(anchorHref) {
  try {
    const u = new URL(String(anchorHref || ''), 'https://airento.local')
    const path = (u.pathname || '/').replace(/\/+$/, '') || '/'
    return `${path}${u.search || ''}`
  } catch {
    return String(anchorHref || '').trim()
  }
}

/**
 * @param {string} [anchorHref]
 * @returns {Element | null}
 */
export function findScrollAnchorElement(anchorHref) {
  if (typeof document === 'undefined') return null
  const want = normalizeScrollAnchorPath(anchorHref)
  if (!want) return null
  const links = document.querySelectorAll('a[href]')
  for (const node of links) {
    const href = node.getAttribute('href')
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue
    if (normalizeScrollAnchorPath(href) === want) return node
  }
  return null
}

/**
 * Apply saved entry; prefer anchor alignment over raw Y (Stage 201.20).
 * @param {{ y: number, anchorHref?: string, anchorTop?: number }} entry
 * @returns {{ ok: boolean, usedAnchor: boolean }}
 */
export function applyRouteScrollEntry(entry) {
  if (typeof window === 'undefined' || !entry) return { ok: false, usedAnchor: false }
  if (entry.anchorHref) {
    const el = findScrollAnchorElement(entry.anchorHref)
    if (el) {
      const top = el.getBoundingClientRect().top
      const targetTop = Number.isFinite(Number(entry.anchorTop)) ? Number(entry.anchorTop) : 0
      window.scrollBy(0, top - targetTop)
      return { ok: true, usedAnchor: true }
    }
  }
  if (entry.y > 0) {
    window.scrollTo(0, entry.y)
    return { ok: true, usedAnchor: false }
  }
  return { ok: false, usedAnchor: false }
}
