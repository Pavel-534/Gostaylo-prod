/**
 * Shared mobile action FAB chrome (Stage 201.60).
 * PDP favorite, partner bell, wizard bell/save — same plate language.
 */

/** Fixed stack under AppHeader (right). Pair with `sm:hidden` when cabinet-only. */
export const MOBILE_ACTION_FAB_STACK_CLASS =
  'pointer-events-none fixed right-3 z-[60] flex flex-col items-center gap-2 sm:right-6'

/** Default top offset directly under AppHeader (PDP / partner cabinet). */
export const MOBILE_ACTION_FAB_TOP_UNDER_HEADER =
  'calc(var(--app-header-height, 64px) + 0.5rem)'

/**
 * Wizard: sit below fixed mobile step-dots chrome (WIZARD_MOBILE_CHROME_HEIGHT + gap).
 * Keep in sync with listing-wizard-layout.js heights.
 */
export const MOBILE_ACTION_FAB_TOP_UNDER_WIZARD_CHROME =
  'calc(var(--app-header-height, 64px) + 2.75rem + 0.5rem)'

/** Circular glass button shell (44×44 touch). */
export const MOBILE_ACTION_FAB_BUTTON_CLASS =
  'pointer-events-auto h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow-md backdrop-blur-md hover:bg-white hover:text-slate-900 touch-manipulation active:scale-[0.98]'
