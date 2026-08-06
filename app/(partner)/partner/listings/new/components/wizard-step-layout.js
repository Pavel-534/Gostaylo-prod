/** Shared wizard step layout tokens (mobile polish). */

export const WIZARD_STEP_ROOT_CLASS = 'space-y-6'
export const WIZARD_STEP_TITLE_CLASS = 'text-xl font-semibold tracking-tight sm:text-2xl'
export const WIZARD_STEP_SUBTITLE_CLASS = 'text-slate-600'

/**
 * Stage 200.52 Phase 1 — mobile flat canvas SSOT.
 * &lt;sm: no nested card chrome (border/shadow/inset padding); sm+: keep section cards.
 * Section rhythm: typography + space-y (root already space-y-6).
 */
export const WIZARD_MOBILE_FLAT_SHELL_CARD_CLASS =
  'max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none sm:rounded-2xl sm:border sm:border-slate-200/90 sm:bg-white sm:shadow-sm'

export const WIZARD_MOBILE_FLAT_SHELL_CONTENT_CLASS =
  'min-w-0 overflow-x-hidden max-sm:p-0 sm:p-8'

/** Numbered step sections (identity, basics, …). */
export const WIZARD_MOBILE_FLAT_SECTION_CLASS =
  'space-y-4 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none sm:rounded-2xl sm:border sm:border-slate-200 sm:bg-white sm:p-5 sm:shadow-sm'

/** Optional inset groups (service type, transport specs, check-in details). */
export const WIZARD_MOBILE_FLAT_INSET_CLASS =
  'space-y-3 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:p-0 sm:rounded-xl sm:border sm:border-slate-200 sm:bg-slate-50/60 sm:p-4'

/** Specs / details wrappers that used Card on all breakpoints. */
export const WIZARD_MOBILE_FLAT_CARD_CLASS =
  'max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none sm:rounded-2xl sm:border sm:border-slate-200/80 sm:bg-white sm:p-5 sm:shadow-sm'
