/**
 * Stage 69.0 — каталог /listings: заголовок области результатов (родитель = общий, лист = специфика).
 */

import { getCategoryName, getUIText } from '@/lib/translations'
import { getCategoryDisplayName } from '@/lib/category-display-name'
import { buildChildrenByParentId } from '@/lib/config/category-hierarchy'

/**
 * @param {string} selectedSlug — normalized category slug or 'all'
 * @param {Array<Record<string, unknown>>} categories
 * @param {string} language
 * @returns {{ h1: string, sub: string | null, parentBlurb: string | null }}
 */
export function getCatalogSearchHeadlines(selectedSlug, categories, language) {
  const base = getUIText('searchResults', language)
  if (!selectedSlug || selectedSlug === 'all') {
    return { h1: base, sub: null, parentBlurb: null }
  }
  const slug = String(selectedSlug).toLowerCase()
  const row =
    (categories || []).find((c) => String(c.slug || '').toLowerCase() === slug) || null
  if (!row) {
    return { h1: base, sub: getCategoryName(slug, language) || slug, parentBlurb: null }
  }
  const pid = row.parentId ?? row.parent_id
  const byParent = buildChildrenByParentId(categories || [])
  const kids = byParent.get(String(row.id)) || []
  const leafName = getCategoryDisplayName(row, language)

  if (pid) {
    const parent = (categories || []).find((c) => String(c.id) === String(pid))
    const parentName = parent ? getCategoryDisplayName(parent, language) : ''
    const sub = parentName ? `${parentName} · ${base}` : base
    return { h1: leafName, sub, parentBlurb: null }
  }

  if (kids.length > 0) {
    const generic =
      language === 'ru'
        ? `${leafName} — все объявления`
        : `${leafName} — all listings`
    const desc = row.description
    const parentBlurb =
      typeof desc === 'string' && desc.trim() ? desc.trim().slice(0, 420) : null
    return { h1: base, sub: generic, parentBlurb }
  }

  return { h1: leafName, sub: base, parentBlurb: null }
}
