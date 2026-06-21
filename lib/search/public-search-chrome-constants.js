/**
 * ADR-101 — Public Search Chrome scroll thresholds (SSOT).
 */

/** Home: compact bar after scrolling past hero (~280px). */
export const PUBLIC_SEARCH_CHROME_HOME_SCROLL_PX = 280

/** Mobile home FAB appears earlier than compact desktop bar. */
export const PUBLIC_SEARCH_CHROME_FAB_SCROLL_PX = 160

/** Fallback when `--app-header-height` is unavailable (matches globals.css). */
export const PUBLIC_SEARCH_CHROME_HEADER_FALLBACK_PX = 64

/**
 * Read live AppHeader height from CSS var (client-only).
 * @returns {number}
 */
export function readAppHeaderHeightPx() {
  if (typeof document === 'undefined') return PUBLIC_SEARCH_CHROME_HEADER_FALLBACK_PX
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--app-header-height')
    .trim()
  const n = parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : PUBLIC_SEARCH_CHROME_HEADER_FALLBACK_PX
}

/**
 * Catalog IO rootMargin — shrink viewport top by header height so compact triggers
 * when expanded chrome bottom crosses header bottom (no blind zone).
 * @param {number} [headerPx]
 * @returns {string}
 */
export function getPublicSearchChromeCatalogIoRootMargin(headerPx = readAppHeaderHeightPx()) {
  const h = Number.isFinite(headerPx) && headerPx > 0 ? headerPx : PUBLIC_SEARCH_CHROME_HEADER_FALLBACK_PX
  return `-${h}px 0px 0px 0px`
}

/** @deprecated use getPublicSearchChromeCatalogIoRootMargin() */
export const PUBLIC_SEARCH_CHROME_CATALOG_IO_ROOT_MARGIN = '-64px 0px 0px 0px'

/** IntersectionObserver threshold — any pixel crossing the header-bottom line. */
export const PUBLIC_SEARCH_CHROME_CATALOG_IO_THRESHOLD = 0

/** Catalog desktop compact chrome — opacity cross-fade (no translate slide). */
export const PUBLIC_SEARCH_CHROME_CATALOG_COMPACT_FADE_MS = 150
