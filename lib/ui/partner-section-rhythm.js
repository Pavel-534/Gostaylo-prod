/**
 * Partner cabinet visual rhythm (Stage 200.94+; tightened Stage 200.97; soft-pad 200.131).
 * SSOT classes — use via PartnerSectionDivider / listing card wrappers.
 * Complements MOBILE_FLAT_* (flat canvas) without heavy boxes on mobile.
 *
 * Hierarchy: PARTNER_SECTION_TITLE_CLASS (group) > PARTNER_FIELD_LABEL_CLASS (field).
 * Dividers only between semantic groups — never between every field.
 *
 * Divider recipe (200.97): 2px mint at ~40–55% opacity — readable in light + dark,
 * without becoming a heavy bar. Prefer opacity over thick chunks.
 *
 * Soft surface + MOBILE_FLAT_* (200.131): flat tokens use max-sm:p-0; when
 * PARTNER_HUB_LIST_CARD_SURFACE_CLASS restores a visible chip/card, add
 * PARTNER_HUB_SOFT_CARD_PAD_* so numbers/icons are not flush to the ring.
 */

/** Mint separator between semantic groups — inset, never edge-to-edge. */
export const PARTNER_SECTION_DIVIDER_CLASS =
  'mx-4 h-0.5 shrink-0 rounded-full bg-brand-mint/40 sm:mx-6 dark:bg-brand-mint/55'

/** Vertical rhythm around a divider between form groups (tight — Stage 200.97). */
export const PARTNER_SECTION_DIVIDER_WRAP_CLASS = 'py-3 sm:py-4'

/** Section / group title (not a field label). */
export const PARTNER_SECTION_TITLE_CLASS =
  'text-base font-semibold tracking-tight text-slate-900'

/** Field label under a section. */
export const PARTNER_FIELD_LABEL_CLASS = 'text-sm font-medium text-slate-800'

/**
 * Listing / booking row on partner hub lists — soft surface + left mint accent on mobile;
 * desktop keeps MOBILE_FLAT_CARD chrome. (Listings 200.94; bookings 200.103)
 */
export const PARTNER_LISTING_CARD_SURFACE_CLASS =
  'max-sm:rounded-xl max-sm:bg-slate-50/90 max-sm:shadow-none max-sm:ring-1 max-sm:ring-slate-200/60 max-sm:border-0 max-sm:border-l-[3px] max-sm:border-l-brand-mint/45'

/** Alias — same surface for hub list cards (bookings, etc.). */
export const PARTNER_HUB_LIST_CARD_SURFACE_CLASS = PARTNER_LISTING_CARD_SURFACE_CLASS

/**
 * Stage 200.131 — mobile inner pad when hub soft surface is paired with MOBILE_FLAT_*
 * (`max-sm:p-0`). Prefer `max-sm:` so Tailwind merges over flat zero-pad.
 * Use on CardContent / metric insets; for Header+Content pairs use HEADER + CONTENT.
 */
export const PARTNER_HUB_SOFT_CARD_PAD_CLASS = 'max-sm:p-3'

/** Soft-surface CardHeader companion (keeps title off the top/side ring). */
export const PARTNER_HUB_SOFT_CARD_HEADER_PAD_CLASS = 'max-sm:px-3 max-sm:pt-3 max-sm:pb-1'

/** Soft-surface CardContent companion under HEADER_PAD (or alone on content-only cards). */
export const PARTNER_HUB_SOFT_CARD_CONTENT_PAD_CLASS = 'max-sm:px-3 max-sm:pb-3 max-sm:pt-1'
