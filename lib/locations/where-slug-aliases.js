/**
 * Stage 157 — popular chip / UI slug → canonical where value for resolveWhereTarget.
 * SSOT for popular-destinations.js values and legacy guest input.
 *
 * @deprecated Stage 158.3 for suggest matching — slug aliases seeded in `geo_synonyms`.
 * `resolveWhereSlugAlias()` remains SSOT for catalog chips and `resolveWhereTarget`.
 */

/** @type {Readonly<Record<string, string>>} */
export const WHERE_SLUG_ALIASES = Object.freeze({
  phuket: 'phuket-city',
  krabi: 'krabi-city',
  /** Bali island — region-level filter (all cities in ID-BA). */
  bali: 'ID-BA',
  pattaya: 'pattaya',
  kazan: 'kazan',
  moscow: 'moscow',
  spb: 'spb',
  sochi: 'sochi',
  bangkok: 'bangkok',
  samui: 'samui',
  dubai: 'dubai',
  istanbul: 'istanbul',
  antalya: 'antalya',
  bodrum: 'bodrum',
  'abu-dhabi': 'abu-dhabi',
  ubud: 'ubud',
})

/**
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function resolveWhereSlugAlias(value) {
  const key = String(value || '').trim().toLowerCase()
  if (!key || key === 'all') return null
  return WHERE_SLUG_ALIASES[key] ?? null
}
