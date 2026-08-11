/** h-9 (36px) + 2px progress track — compact step indicator (Stage 171.10, desktop scroll). */
export const WIZARD_COMPACT_STEP_INDICATOR_HEIGHT = '2.375rem'

/**
 * Flush under partner breadcrumb toolbar (outside scrollport).
 * Mobile toolbar ≈2.5rem (py-2); desktop row ≈3rem (py-3) — see WORKSPACE_*_TOOLBAR in layout.
 */
export const WIZARD_COMPACT_STEP_BAR_POSITION_CLASS =
  'fixed left-0 right-0 top-[calc(var(--app-header-height,64px)+2.5rem)] z-50 w-full lg:left-64 lg:top-[calc(var(--app-header-height,64px)+3rem)]'

/**
 * Fixed mobile chrome content height (slim header min-h-11 + step dots row).
 * Stage 200.94 — was 5rem; active-dot ring + py made content clip under progress.
 */
export const WIZARD_MOBILE_CHROME_HEIGHT = '5.75rem'

/** Gap between fixed chrome and first scroll content (Stage 200.94). */
export const WIZARD_MOBILE_CHROME_CONTENT_GAP = '0.75rem'

/**
 * Fixed bottom action bar content height (py-3 + min-h-11 CTAs).
 * Stage 200.94 — was 4.5rem; last form fields clipped under sticky nav.
 */
export const WIZARD_MOBILE_ACTION_BAR_HEIGHT = '5rem'

/** Extra scroll padding above the action bar. */
export const WIZARD_MOBILE_ACTION_BAR_CONTENT_GAP = '0.75rem'

/** Tailwind utilities derived from heights above (SSOT). */
export const WIZARD_MOBILE_CHROME_PT_CLASS =
  'max-sm:pt-[calc(5.75rem+0.75rem)]'
export const WIZARD_MOBILE_CONTENT_PB_CLASS =
  'max-sm:pb-[calc(5rem+0.75rem+env(safe-area-inset-bottom,0px))]'

/** Fixed mobile wizard chrome — directly below AppHeader. */
export const WIZARD_MOBILE_CHROME_POSITION_CLASS =
  'fixed left-0 right-0 top-[var(--app-header-height,64px)] z-50 w-full border-b border-slate-200/80 bg-white shadow-sm'

/** Fixed mobile bottom action bar. */
export const WIZARD_MOBILE_ACTION_BAR_POSITION_CLASS =
  'fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/80 backdrop-blur-md sm:hidden'

/** Strip leading bullet from wizardStepMarker for dot-row label. */
export function formatWizardStepMarkerLabel(stepMarker) {
  return String(stepMarker || '').replace(/^•\s*/, '').trim()
}
