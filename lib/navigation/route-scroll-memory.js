/**
 * Stage 200.17 / 201.18–201.22 — session scroll memory for soft back-nav.
 *
 * SSOT for list pages: map the route in `routeScrollKeyFromLocation` +
 * `isScrollMemoryRouteKey`, persist with `persistLiveRouteScroll` (Link click
 * or before router.push), Back via `useSoftBack`. Root host restores.
 * Recipe: docs/TECHNICAL_MANIFESTO.md §5.1b, docs/CONSTITUTION.md §5.
 */

import { rememberCatalogReturnHref } from './catalog-return-href.js'

const STORAGE_KEY = 'airento:route-scroll-v1'
const PENDING_STORAGE_KEY = 'airento:route-scroll-pending-v1'

/** Soft-back / programmatic back — set before router.back/push (Stage 201.18). */
let pendingRouteScrollRestore = false

function writePendingRestore(value) {
  pendingRouteScrollRestore = Boolean(value)
  if (typeof window === 'undefined') return
  try {
    if (pendingRouteScrollRestore) window.sessionStorage.setItem(PENDING_STORAGE_KEY, '1')
    else window.sessionStorage.removeItem(PENDING_STORAGE_KEY)
  } catch {
    /* private mode / quota */
  }
}

export function markPendingRouteScrollRestore() {
  writePendingRestore(true)
}

export function consumePendingRouteScrollRestore() {
  const value = peekPendingRouteScrollRestore()
  writePendingRestore(false)
  return value
}

export function peekPendingRouteScrollRestore() {
  if (pendingRouteScrollRestore) return true
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(PENDING_STORAGE_KEY) === '1'
  } catch {
    return false
  }
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
  if (raw === '/listings') {
    return listingsCatalogScrollKey(String(search || '').replace(/^\?/, ''))
  }
  if (raw === '/my-bookings' || raw.startsWith('/my-bookings/')) return 'my-bookings:'
  if (raw === '/renter/bookings' || raw.startsWith('/renter/bookings/')) return 'my-bookings:'
  return null
}

/** Live window location — SSOT key at click / restore time (not stale React search). */
export function liveRouteScrollKey() {
  if (typeof window === 'undefined') return null
  const path = String(window.location.pathname || '')
  const search = String(window.location.search || '').replace(/^\?/, '')
  return routeScrollKeyFromLocation(path, search)
}

/**
 * Window Y that survives iOS / nested scrollingElement (Stage 201.111).
 * `window.scrollY || …` so a real 0 falls through to documentElement.
 * @returns {number}
 */
export function readWindowScrollY() {
  if (typeof window === 'undefined') return 0
  const se = document.scrollingElement || document.documentElement
  return Math.max(
    0,
    Math.round(
      Number(window.scrollY) ||
        Number(window.pageYOffset) ||
        Number(se?.scrollTop) ||
        Number(document.body?.scrollTop) ||
        0,
    ),
  )
}

/**
 * Persist current list scroll before leaving (Link click or router.push).
 * @param {{ y?: number, anchorHref?: string, anchorTop?: number } | null} [extra]
 */
export function persistLiveRouteScroll(extra = null) {
  if (typeof window === 'undefined') return
  const key = liveRouteScrollKey()
  if (!key) return
  // Stage 201.74 — keep catalog query (semantic/filters) for PDP soft-back.
  if (String(window.location.pathname || '').replace(/\/+$/, '') === '/listings') {
    rememberCatalogReturnHref()
  }
  const y = Math.max(readWindowScrollY(), Math.max(0, Math.round(Number(extra?.y) || 0)))
  const href = extra?.anchorHref ? String(extra.anchorHref).trim() : ''
  if (href) {
    let top = extra.anchorTop
    if (!Number.isFinite(Number(top))) {
      const el = findScrollAnchorElement(href, top)
      if (el) top = Math.round(el.getBoundingClientRect().top)
    }
    saveRouteScroll(key, {
      y,
      anchorHref: href,
      ...(Number.isFinite(Number(top)) ? { anchorTop: Math.round(Number(top)) } : {}),
    })
    return
  }
  if (y > 0) saveRouteScroll(key, y)
}

/**
 * @param {string} anchorHref
 * @returns {string}
 */
export function normalizeScrollAnchorPath(anchorHref) {
  try {
    const u = new URL(String(anchorHref || ''), 'https://airento.local')
    const path = (u.pathname || '/').replace(/\/+$/, '') || '/'
    return `${path}${u.search || ''}${u.hash || ''}`
  } catch {
    return String(anchorHref || '').trim()
  }
}

/**
 * @param {string} [anchorHref]
 * @param {number | null | undefined} [anchorTop]
 * @returns {Element | null}
 */
export function findScrollAnchorElement(anchorHref, anchorTop = null) {
  if (typeof document === 'undefined') return null
  const want = normalizeScrollAnchorPath(anchorHref)
  if (!want) return null
  const links = document.querySelectorAll('a[href]')
  const hasTop = Number.isFinite(Number(anchorTop))
  let bestNode = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const node of links) {
    const href = node.getAttribute('href')
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue
    if (normalizeScrollAnchorPath(href) !== want) continue
    if (!hasTop) return node
    const distance = Math.abs(node.getBoundingClientRect().top - Number(anchorTop))
    if (distance < bestDistance) {
      bestDistance = distance
      bestNode = node
    }
  }
  return bestNode
}

/** Unchanged document height ticks before we commit restore (Stage 201.111). */
export const ROUTE_SCROLL_HEIGHT_STABLE_TICKS = 5
const ROUTE_SCROLL_HEIGHT_STABLE_PX = 8

/**
 * @param {{ lastMaxScroll?: number | null, ticks?: number } | null | undefined} prev
 * @param {number} maxScroll
 * @returns {{ lastMaxScroll: number, ticks: number }}
 */
export function nextRouteScrollHeightStableState(prev, maxScroll) {
  const max = Math.max(0, Number(maxScroll) || 0)
  const last = prev?.lastMaxScroll
  const ticks = Number(prev?.ticks) || 0
  if (Number.isFinite(Number(last)) && Math.abs(max - Number(last)) <= ROUTE_SCROLL_HEIGHT_STABLE_PX) {
    return { lastMaxScroll: max, ticks: ticks + 1 }
  }
  return { lastMaxScroll: max, ticks: 1 }
}

/**
 * @param {{ ticks?: number } | null | undefined} state
 * @param {number} [minTicks]
 * @returns {boolean}
 */
export function isRouteScrollHeightStable(state, minTicks = ROUTE_SCROLL_HEIGHT_STABLE_TICKS) {
  return Number(state?.ticks) >= Math.max(1, Number(minTicks) || ROUTE_SCROLL_HEIGHT_STABLE_TICKS)
}

/**
 * @param {{ y?: number, anchorHref?: string } | null | undefined} entry
 * @param {number} maxScroll
 * @returns {boolean}
 */
export function isRouteScrollLayoutReady(entry, maxScroll) {
  const y = Math.max(0, Number(entry?.y) || 0)
  const max = Math.max(0, Number(maxScroll) || 0)
  // Anchor-only (y=0): a short remount is "tall enough" immediately — wait for heightStable.
  if (y <= 0) return false
  return max >= Math.max(0, y - 24)
}

/**
 * When to apply / wait / commit a pending restore (Stage 201.109 / 201.111).
 * Keep pinning the clicked link while Home/catalog widgets still grow.
 * Commit only after document height is stable — otherwise Contact Us / Top
 * land in the middle once For You + featured mount above the footer.
 *
 * @param {{
 *   layoutReady: boolean,
 *   heightStable?: boolean,
 *   anchorStable: boolean,
 *   budgetExceeded: boolean,
 *   hasY: boolean,
 *   hasAnchor?: boolean,
 * }} opts
 * @returns {{ wait: boolean, applyMode: 'anchor' | 'y' | null, commit: boolean }}
 */
export function resolveRouteScrollRestoreStep(opts) {
  const layoutReady = Boolean(opts?.layoutReady)
  const heightStable = Boolean(opts?.heightStable)
  const anchorStable = Boolean(opts?.anchorStable)
  const budgetExceeded = Boolean(opts?.budgetExceeded)
  const hasY = Boolean(opts?.hasY)
  const hasAnchor = Boolean(opts?.hasAnchor)

  if (budgetExceeded) {
    return {
      wait: false,
      applyMode: hasAnchor ? 'anchor' : hasY ? 'y' : null,
      commit: true,
    }
  }

  if (heightStable) {
    if (hasAnchor) {
      return { wait: false, applyMode: 'anchor', commit: true }
    }
    if (hasY) {
      return { wait: false, applyMode: 'y', commit: true }
    }
    return {
      wait: false,
      applyMode: layoutReady && anchorStable ? 'anchor' : null,
      commit: true,
    }
  }

  if (hasAnchor) {
    return { wait: true, applyMode: 'anchor', commit: false }
  }
  if (hasY) {
    return { wait: true, applyMode: 'y', commit: false }
  }
  return { wait: true, applyMode: null, commit: false }
}

/**
 * Apply saved entry; prefer anchor alignment over raw Y (Stage 201.20).
 * `mode: 'y'` skips the anchor so a footer link is not aligned on a short page.
 * @param {{ y: number, anchorHref?: string, anchorTop?: number }} entry
 * @param {{ mode?: 'anchor' | 'y' }} [opts]
 * @returns {{ ok: boolean, usedAnchor: boolean }}
 */
export function applyRouteScrollEntry(entry, opts = {}) {
  if (typeof window === 'undefined' || !entry) return { ok: false, usedAnchor: false }
  const preferY = opts.mode === 'y'
  if (!preferY && entry.anchorHref) {
    const el = findScrollAnchorElement(entry.anchorHref, entry.anchorTop)
    if (el) {
      const top = el.getBoundingClientRect().top
      const targetTop = Number.isFinite(Number(entry.anchorTop)) ? Number(entry.anchorTop) : 0
      window.scrollBy(0, top - targetTop)
      return { ok: true, usedAnchor: true }
    }
  }
  if (entry.y > 0) {
    const maxScroll = Math.max(
      0,
      (document.documentElement?.scrollHeight || 0) - window.innerHeight,
    )
    const next = Math.min(entry.y, maxScroll || entry.y)
    window.scrollTo(0, next)
    const se = document.scrollingElement || document.documentElement
    if (se && se.scrollTop !== next) se.scrollTop = next
    return { ok: true, usedAnchor: false }
  }
  return { ok: false, usedAnchor: false }
}
