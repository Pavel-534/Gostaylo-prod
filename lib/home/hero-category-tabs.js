/**
 * Stage 179.1 — SSOT for hero + mobile search sheet category quick chips.
 * Same roots as HomeHeroLuxe pill tabs (property, vehicles, yachts, tours fallback).
 */

import { hasCategoryParent } from '@/lib/config/category-hierarchy'

const PREFERRED_HERO_ROOT_SLUGS = ['property', 'vehicles', 'yachts', 'tours']

/**
 * @param {Array<Record<string, unknown>>} categories
 * @returns {Array<Record<string, unknown>>}
 */
export function selectHeroCategoryTabs(categories) {
  const roots = [...(categories || [])]
    .filter((c) => c && c.slug && !hasCategoryParent(c))
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))

  const picked = PREFERRED_HERO_ROOT_SLUGS.map((slug) => roots.find((c) => c.slug === slug)).filter(
    Boolean,
  )
  if (picked.length >= 3) return picked
  return roots.slice(0, 4)
}
