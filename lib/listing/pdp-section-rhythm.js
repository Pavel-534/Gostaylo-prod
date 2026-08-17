/**
 * Guest PDP section rhythm (Stage 201.85).
 *
 * SSOT for listing detail (`/listings/[id]`): one hairline rule between semantic
 * blocks, equal vertical padding on both sides of each rule. Prefer
 * `ListingPdpSectionStack` + `ListingPdpSection` over ad-hoc `<Separator />`,
 * `space-y-*` + borders, or nested `my-8` separators.
 *
 * Do not stack section rules with list-item borders (amenities rows) or with
 * an internal hero split (title → specs) — those use INTERNAL_* only.
 */

/** Hairline between major PDP sections (matches slate-100 product chrome). */
export const LISTING_PDP_SECTION_RULE_CLASS = 'border-slate-100'

/**
 * Stack: dividers only between children (not above the first).
 * Children must be real sections — omit null/empty wrappers so rules stay honest.
 */
export const LISTING_PDP_SECTION_STACK_CLASS = `divide-y ${LISTING_PDP_SECTION_RULE_CLASS}`

/** Equal pad above/below content inside each stack child (~32px). */
export const LISTING_PDP_SECTION_PAD_CLASS = 'py-8'

/** Convenience: pad class for a section child of the stack. */
export const LISTING_PDP_SECTION_CLASS = LISTING_PDP_SECTION_PAD_CLASS

/**
 * Split inside one section (e.g. title/location → specs). Same visual weight as
 * stack rules: 32px above the line + 32px below before content.
 */
export const LISTING_PDP_INTERNAL_SPLIT_CLASS = `mt-8 border-t ${LISTING_PDP_SECTION_RULE_CLASS} pt-8`

/**
 * Async rails (similar / recently viewed) that mount only when data exists —
 * top rule + pad so they match stack rhythm without empty divide siblings.
 */
export const LISTING_PDP_RAIL_SECTION_CLASS = `border-t ${LISTING_PDP_SECTION_RULE_CLASS} pt-8`

/** Section H2 used across PDP story blocks. */
export const LISTING_PDP_SECTION_TITLE_CLASS = 'text-2xl font-medium tracking-tight'
