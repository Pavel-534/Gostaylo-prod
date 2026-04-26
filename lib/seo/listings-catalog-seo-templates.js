/**
 * Stage 69.1–69.2 — профиль каталога для SEO `/listings`.
 * Шаблоны — i18n SSOT: ключи `catalogSeo_{profile}_{title|description}` в `lib/translations/slices/catalog-seo.js`.
 * Перевод: `tr(key)` (= `t(lang)(key)` / `getUIText`); `{brand}` — в `getUIText`; затем `{categoryName}`, `{location}`, `{count}`.
 */

import { normalizeCategoryWizardProfileColumn } from '@/lib/config/category-wizard-profile-db'
import { getUIText, t } from '@/lib/translations'

/**
 * @typedef {'stay'|'transport'|'service'|'nanny'|'chef'|'tour'|'default'} CatalogSeoProfileKey
 */

/**
 * @param {string | null | undefined} wizardRaw
 * @param {string} slug
 * @returns {CatalogSeoProfileKey}
 */
export function resolveCatalogSeoProfileKey(wizardRaw, slug) {
  const col = normalizeCategoryWizardProfileColumn(wizardRaw)
  if (col === 'nanny') return 'nanny'
  if (col === 'chef') return 'chef'
  if (col === 'stay') return 'stay'
  if (col === 'transport' || col === 'transport_helicopter' || col === 'yacht') return 'transport'
  if (col === 'tour') return 'tour'
  if (col === 'massage' || col === 'service_generic') return 'service'

  const s = String(slug || '').toLowerCase().trim()
  if (s === 'property' || s === 'properties' || s === 'housing') return 'stay'
  if (
    s === 'vehicles' ||
    s === 'vehicle' ||
    s === 'yachts' ||
    s === 'yacht' ||
    s === 'helicopter' ||
    s === 'helicopters'
  )
    return 'transport'
  if (s === 'tours' || s === 'tour') return 'tour'
  if (s === 'nanny' || s === 'nannies') return 'nanny'
  if (s === 'chef' || s === 'chefs') return 'chef'
  return 'default'
}

/**
 * @param {string} str
 * @param {Record<string, string | number>} vars
 */
export function interpolateCatalogSeoTemplate(str, vars) {
  if (typeof str !== 'string') return ''
  return Object.entries(vars).reduce((acc, [k, v]) => {
    const safe = v == null ? '' : String(v)
    return acc.replace(new RegExp(`\\{${k}\\}`, 'g'), safe)
  }, str)
}

/**
 * @param {'ru'|'en'|'zh'|'th'} lang
 * @param {string | null | undefined} whereRaw
 * @param {(key: string, ctx?: object) => string} tr
 */
function buildPlaceStrings(lang, whereRaw, tr) {
  const w =
    whereRaw && String(whereRaw).trim() && String(whereRaw).toLowerCase() !== 'all'
      ? String(whereRaw).trim()
      : ''
  if (!w) {
    return {
      locationTitle: tr('catalogSeo_place_title_default'),
      locationDesc: tr('catalogSeo_place_desc_default'),
    }
  }
  return {
    locationTitle: interpolateCatalogSeoTemplate(tr('catalogSeo_place_title_where'), { where: w }),
    locationDesc: interpolateCatalogSeoTemplate(tr('catalogSeo_place_desc_where'), { where: w }),
  }
}

/**
 * @param {'ru'|'en'|'zh'|'th'} lang
 * @param {number | null | undefined} totalCount
 * @param {(key: string, ctx?: object) => string} tr
 */
function buildCountPrefix(lang, totalCount, tr) {
  if (totalCount == null || !Number.isFinite(Number(totalCount))) return ''
  const n = Math.floor(Number(totalCount))
  if (n === 0) return tr('catalogSeo_count_zero')
  if (lang === 'ru') {
    const x = Math.abs(n) % 100
    const x1 = x % 10
    let key = 'catalogSeo_count_ru_many'
    if (x > 10 && x < 20) key = 'catalogSeo_count_ru_many'
    else if (x1 === 1) key = 'catalogSeo_count_ru_one'
    else if (x1 >= 2 && x1 <= 4) key = 'catalogSeo_count_ru_few'
    return interpolateCatalogSeoTemplate(tr(key), { count: n })
  }
  if (lang === 'en') {
    const key = n === 1 ? 'catalogSeo_count_en_one' : 'catalogSeo_count_en_other'
    return interpolateCatalogSeoTemplate(tr(key), { count: n })
  }
  if (lang === 'zh') {
    return interpolateCatalogSeoTemplate(tr('catalogSeo_count_zh'), { count: n })
  }
  if (lang === 'th') {
    return interpolateCatalogSeoTemplate(tr('catalogSeo_count_th'), { count: n })
  }
  return interpolateCatalogSeoTemplate(tr('catalogSeo_count_en_other'), { count: n })
}

/**
 * @param {'ru'|'en'|'zh'|'th'} lang
 * @param {CatalogSeoProfileKey} profileKey
 * @param {'title'|'description'} kind
 * @param {(key: string, ctx?: object) => string} tr
 */
function resolveSeoTemplateKey(lang, profileKey, kind, tr) {
  const key = `catalogSeo_${profileKey}_${kind}`
  if (tr(key) !== key) return key
  return `catalogSeo_default_${kind}`
}

/**
 * @param {'ru'|'en'|'zh'|'th'} lang
 * @param {string | null | undefined} where
 * @param {string} categoryName
 * @param {CatalogSeoProfileKey} profileKey
 * @param {number | null | undefined} totalCount
 * @param {(key: string, ctx?: object) => string} [tr] — из `getListingsCatalogTitleAndDescriptionWithRows`: `t(lang)`
 */
export function buildCatalogSeoFromProfile(lang, where, categoryName, profileKey, totalCount, tr = t(lang)) {
  const name =
    (categoryName && String(categoryName).trim()) ||
    tr('catalogSeo_fallback_categoryName') ||
    'Listings'

  const { locationTitle, locationDesc } = buildPlaceStrings(lang, where, tr)
  const countPrefix = buildCountPrefix(lang, totalCount, tr)

  const titleKey = resolveSeoTemplateKey(lang, profileKey, 'title', tr)
  const descKey = resolveSeoTemplateKey(lang, profileKey, 'description', tr)
  const titleTpl = getUIText(titleKey, lang)
  const descTpl = getUIText(descKey, lang)

  const title = interpolateCatalogSeoTemplate(titleTpl, {
    categoryName: name,
    location: locationTitle,
    count: '',
  })

  let description = interpolateCatalogSeoTemplate(descTpl, {
    categoryName: name,
    location: locationDesc,
    count: countPrefix,
  })

  if (description.length > 165 && countPrefix) {
    const short = interpolateCatalogSeoTemplate(descTpl, {
      categoryName: name,
      location: locationDesc,
      count: '',
    })
      .slice(0, 160)
      .trim()
    description = `${countPrefix}${short}`.slice(0, 165)
  }

  return { title, description }
}
