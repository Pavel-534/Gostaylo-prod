import { getCategoryName as getCategoryNameFromTranslations } from '@/lib/translations'

/**
 * Stage 69.0 — SSOT display name for category rows from API (`name_i18n` / `nameI18n`), then i18n files, then `name`.
 * @param {Record<string, unknown> | null | undefined} cat
 * @param {string} lang — 'ru' | 'en' | 'zh' | 'th'
 * @param {(slug: string, lang: string, fallback?: string) => string} [getCategoryName] — from `@/lib/translations`
 */
export function resolveCategoryDisplayName(cat, lang, getCategoryName) {
  if (!cat) return ''
  const i18n = cat.nameI18n ?? cat.name_i18n
  if (i18n && typeof i18n === 'object' && !Array.isArray(i18n)) {
    const lc = String(lang || 'ru').toLowerCase().slice(0, 2)
    const pick =
      i18n[lc] ||
      i18n[lang] ||
      i18n.ru ||
      i18n.en ||
      i18n.zh ||
      i18n.th
    if (typeof pick === 'string' && pick.trim()) return pick.trim()
  }
  const slug = String(cat.slug || '').toLowerCase()
  const fallback = typeof cat.name === 'string' ? cat.name : ''
  if (typeof getCategoryName === 'function' && slug) {
    const t = getCategoryName(slug, lang, fallback)
    if (t) return t
  }
  return fallback || slug
}

/**
 * Stage 69.1 — удобный SSOT-хелпер для UI/SEO: `name_i18n` → переводы по slug → `name`.
 * @param {Record<string, unknown> | null | undefined} category
 * @param {string} lang
 */
export function getCategoryDisplayName(category, lang) {
  return resolveCategoryDisplayName(category, lang, getCategoryNameFromTranslations)
}

/**
 * @param {Record<string, unknown>} listing — search row with `categories` join or `category`
 * @param {Array<Record<string, unknown>>} allCategories — flat from `/api/v2/categories`
 * @param {string} lang
 * @param {(slug: string, lang: string, fallback?: string) => string} getCategoryName
 * @returns {string} e.g. "Услуги • Няня" or single label
 */
export function buildListingCategoryLineLabel(listing, allCategories, lang, getCategoryName) {
  const row = listing?.categories || listing?.category
  const slug = String(row?.slug || listing?.categorySlug || '').toLowerCase()
  const id = row?.id || listing?.category_id || listing?.categoryId
  let leaf =
    (Array.isArray(allCategories) && id && allCategories.find((c) => String(c.id) === String(id))) ||
    (Array.isArray(allCategories) && slug && allCategories.find((c) => String(c.slug).toLowerCase() === slug)) ||
    null
  if (!leaf && row) {
    leaf = {
      id: row.id,
      slug: row.slug,
      name: row.name,
      parentId: row.parentId ?? row.parent_id,
      nameI18n: row.nameI18n ?? row.name_i18n,
    }
  }
  if (!leaf) {
    return slug ? getCategoryName(slug, lang, row?.name) || row?.name || slug : ''
  }
  const pid = leaf.parentId ?? leaf.parent_id
  if (!pid) return resolveCategoryDisplayName(leaf, lang, getCategoryName)
  const parent = (allCategories || []).find((c) => String(c.id) === String(pid))
  if (!parent) return resolveCategoryDisplayName(leaf, lang, getCategoryName)
  const a = resolveCategoryDisplayName(parent, lang, getCategoryName)
  const b = resolveCategoryDisplayName(leaf, lang, getCategoryName)
  if (a && b && a !== b) return `${a} • ${b}`
  return b || a
}
