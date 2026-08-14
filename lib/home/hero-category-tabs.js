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

/**
 * Home hero chips: first tap selects, second tap on the same slug clears to all.
 * @param {string | null | undefined} currentCategory
 * @param {string | null | undefined} clickedSlug
 * @returns {string}
 */
export function nextHeroCategorySelection(currentCategory, clickedSlug) {
  const clicked = String(clickedSlug || '').trim()
  if (!clicked || clicked === 'all') return 'all'
  const current = String(currentCategory || 'all').trim() || 'all'
  return current === clicked ? 'all' : clicked
}
