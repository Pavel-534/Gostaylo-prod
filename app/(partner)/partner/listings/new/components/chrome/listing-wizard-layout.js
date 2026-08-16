/** h-9 (36px) + 2px progress track — compact step indicator (Stage 171.10, desktop scroll). */
export const WIZARD_COMPACT_STEP_INDICATOR_HEIGHT = '2.375rem'

/**
 * Flush under AppHeader (outside scrollport).
 * Stage 201.58 — wizard no longer mounts WORKSPACE_TOOLBAR breadcrumbs; pin under header only.
 */
export const WIZARD_COMPACT_STEP_BAR_POSITION_CLASS =
  'fixed left-0 right-0 top-[var(--app-header-height,64px)] z-50 w-full lg:left-64'

/**
 * Fixed mobile chrome content height (step dots row only — Stage 201.55).
 * Soft-back → AppHeader; bell/save → FABs. Was 5.75rem with slim header.
 */
export const WIZARD_MOBILE_CHROME_HEIGHT = '2.75rem'

/** Gap between fixed chrome and first scroll content (Stage 200.94). */
export const WIZARD_MOBILE_CHROME_CONTENT_GAP = '0.75rem'

/**
 * Fixed bottom action bar content height (py-3 + min-h-11 CTAs).
 * Stage 200.97 — back to true bar height; clearance only on content (no double pad).
 */
export const WIZARD_MOBILE_ACTION_BAR_HEIGHT = '5rem'

/** Extra scroll padding above the action bar — tight “в притык” (Stage 200.97). */
export const WIZARD_MOBILE_ACTION_BAR_CONTENT_GAP = '0.5rem'

/**
 * DOM marker on WORKSPACE_SCROLL for listing wizard routes.
 * Pair with CSS in globals.css + WIZARD_WORKSPACE_SCROLL_PAD_CLASS.
 */
export const LISTING_WIZARD_SCROLL_ATTR = 'data-listing-wizard-scroll'

/**
 * Tailwind utilities derived from heights above (SSOT).
 * Note: do NOT put a comma inside env() in arbitrary values — Tailwind treats `,` as a
 * class separator and silently drops the utility (Stage 200.95 root cause).
 *
 * Stage 200.97: clearance lives on content only. Scrollport gets scroll-padding
 * (focus) but NOT padding-bottom — that double-pad left a huge void after short steps.
 */
export const WIZARD_MOBILE_CHROME_PT_CLASS =
  'max-sm:pt-[calc(2.75rem+0.75rem)]'
export const WIZARD_MOBILE_CONTENT_PB_CLASS =
  'max-sm:pb-[calc(5rem+0.5rem+env(safe-area-inset-bottom))]'

/**
 * Applied on partner WORKSPACE_SCROLL when on listing wizard — scroll-padding only
 * (Stage 200.97). Do not add padding-bottom here.
 */
export const WIZARD_WORKSPACE_SCROLL_PAD_CLASS =
  'max-sm:[scroll-padding-top:calc(2.75rem+0.75rem)] max-sm:[scroll-padding-bottom:calc(5rem+0.5rem+env(safe-area-inset-bottom))]'

/** Fixed mobile wizard chrome — directly below AppHeader. */
export const WIZARD_MOBILE_CHROME_POSITION_CLASS =
  'fixed left-0 right-0 top-[var(--app-header-height,64px)] z-50 w-full border-b border-slate-200/80 bg-white shadow-sm'

/** Fixed mobile bottom action bar. */
export const WIZARD_MOBILE_ACTION_BAR_POSITION_CLASS =
  'fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/80 backdrop-blur-md sm:hidden'

/**
 * Inner row of fixed mobile action bar (Stage 200.98).
 * Equal pt/pb (0.75rem); safe-area is additive — never use `.safe-area-pb` with `py-*`
 * (it overrides padding-bottom to 0 when inset is 0 → buttons stick to the bottom edge).
 */
export const WIZARD_MOBILE_ACTION_BAR_INNER_CLASS =
  'mx-auto flex w-full max-w-7xl min-w-0 items-center gap-2 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]'

/** Strip leading bullet from wizardStepMarker for dot-row label. */
export function formatWizardStepMarkerLabel(stepMarker) {
  return String(stepMarker || '').replace(/^•\s*/, '').trim()
}
