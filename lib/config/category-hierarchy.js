/**
 * Stage 68.0 — hierarchy helpers (`categories.parent_id`) + wizard_profile inheritance (child → walk up to parent).
 * Pure functions; safe on server and client.
 */

import { normalizeCategoryWizardProfileColumn } from '@/lib/config/category-wizard-profile-db'

/** @param {Record<string, unknown>} c */
export function categoryParentIdRaw(c) {
  if (!c) return null
  const p = c.parentId ?? c.parent_id
  if (p == null || p === '') return null
  const s = String(p).trim()
  return s || null
}

/** @param {Record<string, unknown>} c */
export function hasCategoryParent(c) {
  return categoryParentIdRaw(c) != null
}

/**
 * @param {Array<Record<string, unknown>>} categories
 * @returns {Map<string, Array<Record<string, unknown>>>} parent UUID → active children (sorted by order)
 */
export function buildChildrenByParentId(categories) {
  const map = new Map()
  for (const c of categories || []) {
    const pid = categoryParentIdRaw(c)
    if (!pid) continue
    if (!map.has(pid)) map.set(pid, [])
    map.get(pid).push(c)
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
  }
  return map
}

/**
 * @param {Array<Record<string, unknown>>} categories
 * @param {string} slug
 */
export function getCategoryBySlug(categories, slug) {
  const s = String(slug || '').toLowerCase().trim()
  if (!s) return null
  return (categories || []).find((c) => String(c?.slug || '').toLowerCase() === s) || null
}

/**
 * First non-empty canonical `wizard_profile` walking category → parent chain (SSOT inheritance).
 * @param {string} slug
 * @param {Array<Record<string, unknown>>} categories
 * @returns {string | null} lowercase canonical profile or null
 */
export function effectiveCategoryWizardProfileRaw(slug, categories) {
  const byId = new Map()
  for (const c of categories || []) {
    if (c?.id) byId.set(String(c.id), c)
  }
  let cur = getCategoryBySlug(categories, slug)
  const seen = new Set()
  while (cur && cur.id && !seen.has(String(cur.id))) {
    seen.add(String(cur.id))
    const raw = cur.wizardProfile ?? cur.wizard_profile
    if (normalizeCategoryWizardProfileColumn(raw)) {
      return String(raw).toLowerCase().trim()
    }
    const pid = categoryParentIdRaw(cur)
    if (!pid) break
    cur = byId.get(String(pid)) || null
  }
  return null
}

/**
 * Active categories ordered for pickers: each root (by `order`), then its children; then remaining rows (orphans).
 * @param {Array<Record<string, unknown>>} categories
 * @returns {Array<{ cat: Record<string, unknown>, depth: number }>}
 */
export function orderedCategoriesForSearchUi(categories) {
  const list = [...(categories || [])].filter((c) => {
    if (!c?.slug) return false
    if (c.isActive === false) return false
    if (c.is_active === false) return false
    return true
  })
  const byParent = buildChildrenByParentId(list)
  const roots = list.filter((c) => !hasCategoryParent(c)).sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
  const used = new Set()
  const out = []
  for (const r of roots) {
    out.push({ cat: r, depth: 0 })
    used.add(String(r.id))
    for (const k of byParent.get(String(r.id)) || []) {
      out.push({ cat: k, depth: 1 })
      used.add(String(k.id))
    }
  }
  const rest = list
    .filter((c) => !used.has(String(c.id)))
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
  for (const c of rest) {
    out.push({ cat: c, depth: hasCategoryParent(c) ? 1 : 0 })
  }
  return out
}

/**
 * Active direct children of a category id (for quick chips).
 * @param {string} parentId
 * @param {Array<Record<string, unknown>>} categories
 */
export function getActiveChildCategoriesByParentId(parentId, categories) {
  const pid = String(parentId || '').trim()
  if (!pid) return []
  return (buildChildrenByParentId(categories).get(pid) || []).filter((c) => {
    if (c.isActive === false) return false
    if (c.is_active === false) return false
    return true
  })
}
