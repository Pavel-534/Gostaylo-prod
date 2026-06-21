/**
 * ADR-101 — Public Search Chrome scroll morph thresholds (SSOT).
 */

/** @deprecated legacy FAB threshold only — compact morph uses scroll progress */
export const PUBLIC_SEARCH_CHROME_HOME_SCROLL_PX = 280

/** Mobile home FAB appears earlier than compact desktop bar. */
export const PUBLIC_SEARCH_CHROME_FAB_SCROLL_PX = 160

/** Fallback when `--app-header-height` is unavailable (matches globals.css). */
export const PUBLIC_SEARCH_CHROME_HEADER_FALLBACK_PX = 64

/** Catalog desktop: visual morph begins at this scroll progress (0–1). */
export const PUBLIC_SEARCH_CHROME_CATALOG_MORPH_START = 0.28

/** Home desktop: visual morph begins at mid-scroll of hero glass capsule. */
export const PUBLIC_SEARCH_CHROME_HOME_MORPH_START = 0.5

/** Compact bar starts this many px above final position at morphT=0. */
export const PUBLIC_SEARCH_CHROME_COMPACT_TRANSLATE_PX = 10

/** @deprecated alias */
export const PUBLIC_SEARCH_CHROME_CATALOG_COMPACT_TRANSLATE_PX = PUBLIC_SEARCH_CHROME_COMPACT_TRANSLATE_PX

/** Home hero capsule anchor for scroll progress (inside `[data-hero-search]`). */
export const PUBLIC_SEARCH_CHROME_HOME_EXPANDED_SELECTOR =
  '[data-hero-search] [data-public-search-chrome-expanded]'

/**
 * @param {number} n
 * @returns {number}
 */
export function clampPublicSearchProgress(n) {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

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
 * Scroll morph progress (SSOT home + catalog).
 * 0 = expanded anchor at rest; 1 = expanded bottom at AppHeader bottom.
 *
 * @param {number} expandedBottomPx
 * @param {number} headerBottomPx
 * @param {number} expandedHeightPx
 * @returns {number} 0..1
 */
export function computePublicSearchScrollProgress(
  expandedBottomPx,
  headerBottomPx,
  expandedHeightPx,
) {
  if (!Number.isFinite(expandedHeightPx) || expandedHeightPx <= 0) return 0
  const remaining = expandedBottomPx - headerBottomPx
  return clampPublicSearchProgress(1 - remaining / expandedHeightPx)
}

/** @deprecated use computePublicSearchScrollProgress */
export const computeCatalogScrollProgress = computePublicSearchScrollProgress

/**
 * Visual morph factor (opacity / translate): maps [morphStart, 1] → [0, 1].
 *
 * @param {number} progress
 * @param {number} morphStart
 * @returns {number} 0..1
 */
export function computePublicSearchMorphVisualT(progress, morphStart) {
  if (progress <= morphStart) return 0
  return clampPublicSearchProgress((progress - morphStart) / (1 - morphStart))
}

/** @deprecated use computePublicSearchMorphVisualT */
export const computeCatalogMorphVisualT = computePublicSearchMorphVisualT

/**
 * Interpolate `--app-search-chrome-height` during scroll morph.
 *
 * @param {number} expandedHeightPx
 * @param {number} compactHeightPx
 * @param {number} progress
 * @param {{ fromZero?: boolean }} [options] — home: lerp 0→compact; catalog: expanded→compact
 * @returns {number}
 */
export function interpolatePublicSearchChromeHeight(
  expandedHeightPx,
  compactHeightPx,
  progress,
  options = {},
) {
  const p = clampPublicSearchProgress(progress)
  const comp = Number.isFinite(compactHeightPx) ? compactHeightPx : 0
  if (options.fromZero) return comp * p
  const exp = Number.isFinite(expandedHeightPx) ? expandedHeightPx : 0
  return exp + (comp - exp) * p
}

/** @deprecated use interpolatePublicSearchChromeHeight */
export const interpolateCatalogChromeHeight = interpolatePublicSearchChromeHeight

/** @deprecated */
export function getPublicSearchChromeCatalogIoRootMargin(headerPx = readAppHeaderHeightPx()) {
  const h = Number.isFinite(headerPx) && headerPx > 0 ? headerPx : PUBLIC_SEARCH_CHROME_HEADER_FALLBACK_PX
  return `-${h}px 0px 0px 0px`
}

/** @deprecated */
export const PUBLIC_SEARCH_CHROME_CATALOG_IO_ROOT_MARGIN = '-64px 0px 0px 0px'

/** @deprecated */
export const PUBLIC_SEARCH_CHROME_CATALOG_IO_THRESHOLD = 0
