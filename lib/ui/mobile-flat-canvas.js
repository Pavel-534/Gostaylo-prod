/**
 * Stage 200.52 — mobile flat canvas SSOT (nesting depth ≤ 1 on &lt;sm).
 * Used by listing wizard + partner calendar blocks shown on wizard step 1.
 * Desktop (sm+) keeps card chrome.
 */

/** Outer page shell Card (wizard). */
export const WIZARD_MOBILE_FLAT_SHELL_CARD_CLASS =
  'max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none sm:rounded-2xl sm:border sm:border-slate-200/90 sm:bg-white sm:shadow-sm'

export const WIZARD_MOBILE_FLAT_SHELL_CONTENT_CLASS =
  'min-w-0 overflow-x-hidden max-sm:p-0 sm:p-8'

/** Numbered / titled step sections. */
export const WIZARD_MOBILE_FLAT_SECTION_CLASS =
  'space-y-4 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none sm:rounded-2xl sm:border sm:border-slate-200 sm:bg-white sm:p-5 sm:shadow-sm'

/** Optional inset groups. */
export const WIZARD_MOBILE_FLAT_INSET_CLASS =
  'space-y-3 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:p-0 sm:rounded-xl sm:border sm:border-slate-200 sm:bg-slate-50/60 sm:p-4'

/** Generic Card wrappers (specs, calendar blocks, seasonal). */
export const WIZARD_MOBILE_FLAT_CARD_CLASS =
  'max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none sm:rounded-2xl sm:border sm:border-slate-200/80 sm:bg-white sm:shadow-sm'

/** Brand-accent Card (calendar sync outer). */
export const WIZARD_MOBILE_FLAT_BRAND_CARD_CLASS =
  'overflow-hidden scroll-mt-28 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none sm:rounded-2xl sm:border sm:border-brand/20 sm:bg-white sm:shadow-sm'

/** Nested panel inside a Card (export URL box, import forms). */
export const WIZARD_MOBILE_FLAT_NESTED_PANEL_CLASS =
  'space-y-3 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:p-0 sm:rounded-xl sm:border sm:p-4'

/** CardHeader: kill default `p-6` / divider chrome on mobile. */
export const WIZARD_MOBILE_FLAT_CARD_HEADER_CLASS =
  'max-sm:border-0 max-sm:bg-transparent max-sm:p-0 sm:p-6'

/** CardContent: kill default `p-6 pt-0` on mobile. */
export const WIZARD_MOBILE_FLAT_CARD_CONTENT_CLASS = 'max-sm:p-0 sm:p-6 sm:pt-0'

/** Empty / dashed placeholder — typography only on mobile. */
export const WIZARD_MOBILE_FLAT_EMPTY_CLASS =
  'text-center max-sm:border-0 max-sm:py-6 sm:rounded-lg sm:border-2 sm:border-dashed sm:border-slate-200 sm:py-12'
