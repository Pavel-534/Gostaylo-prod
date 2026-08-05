/**
 * Title, description, canonical для /listings (Metadata API).
 */
import { normalizeListingCategorySlugForSearch } from '@/lib/listing-category-slug'
import { nextSearchParamsRecordToURLSearchParams } from '@/lib/search/listings-page-url'
import { getSiteDisplayName } from '@/lib/site-url'
import { getCategoryName, t } from '@/lib/translations'
import { getCategoryDisplayName } from '@/lib/category-display-name'
import { effectiveCategoryWizardProfileRaw } from '@/lib/config/category-hierarchy'
import { resolveCatalogSeoProfileKey, buildCatalogSeoFromProfile } from '@/lib/seo/listings-catalog-seo-templates'

/** @deprecated Используйте {@link getSiteDisplayName}; оставлено для внешних импортов. */
export const LISTINGS_SEO_BRAND = getSiteDisplayName()

/** В canonical не попадают «шумные» фильтры (карта, цена, metadata), чтобы снизить дубли. */
const CANONICAL_PARAM_KEYS = ['category', 'where', 'location', 'city', 'guests', 'checkIn', 'checkOut', 'q']

export function buildListingsCanonicalPath(searchParamsRecord) {
  const src = nextSearchParamsRecordToURLSearchParams(searchParamsRecord)
  const out = new URLSearchParams()
  for (const k of CANONICAL_PARAM_KEYS) {
    const v = src.get(k)
    if (v == null || v === '' || String(v).toLowerCase() === 'all') continue
    if (k === 'guests' && String(v) === '2') continue
    out.set(k, v)
  }
  const sorted = new URLSearchParams([...out.entries()].sort((a, b) => a[0].localeCompare(b[0])))
  const qs = sorted.toString()
  return qs ? `/listings/?${qs}` : '/listings/'
}

export function buildListingsAbsoluteCanonical(baseUrl, searchParamsRecord) {
  const path = buildListingsCanonicalPath(searchParamsRecord)
  return `${String(baseUrl).replace(/\/$/, '')}${path}`
}

function pickWhere(sp) {
  const w = sp.get('where')?.trim() || sp.get('location')?.trim() || sp.get('city')?.trim() || ''
  if (!w || w.toLowerCase() === 'all') return null
  return w
}

function titlesRu(category, where) {
  const brand = getSiteDisplayName()
  const place = where || 'по всему миру'
  if (category === 'vehicles') {
    return {
      title: where
        ? `Аренда байков и авто в ${where} | ${brand}`
        : `Аренда байков и авто | ${brand}`,
      description: where
        ? `Снять байк или авто в районе ${where}. Актуальные объявления на ${brand}.`
        : `Аренда мотобайков, скутеров и автомобилей. Сравните цены на ${brand}.`,
    }
  }
  if (category === 'property') {
    return {
      title: where
        ? `Аренда жилья в ${where} | ${brand}`
        : `Аренда жилья | ${brand}`,
      description: where
        ? `Виллы и апартаменты в районе ${where}. Бронирование на ${brand}.`
        : `Подбор жилья: виллы, кондо, апартаменты. Фильтры по району и датам на ${brand}.`,
    }
  }
  if (category === 'tours') {
    return {
      title: where ? `Экскурсии и туры в ${where} | ${brand}` : `Экскурсии и туры | ${brand}`,
      description: `Туры и развлечения${where ? ` (${where})` : ''}. Бронирование на ${brand}.`,
    }
  }
  if (category === 'yachts') {
    return {
      title: where ? `Аренда яхт и катеров в ${where} | ${brand}` : `Аренда яхт и катеров | ${brand}`,
      description: `Яхты и морские прогулки${where ? ` в ${where}` : ''}. Проверенные предложения на ${brand}.`,
    }
  }
  return {
    title: where ? `Аренда — ${place} | ${brand}` : `Аренда: жильё, транспорт, туры | ${brand}`,
    description: `Каталог аренды${where ? ` (${where})` : ''}: жильё, транспорт, туры. Удобный поиск на ${brand}.`,
  }
}

function titlesEn(category, where) {
  const brand = getSiteDisplayName()
  const place = where || 'worldwide'
  if (category === 'vehicles') {
    return {
      title: where
        ? `Scooter & car rental in ${where} | ${brand}`
        : `Scooter & car rental | ${brand}`,
      description: where
        ? `Rent a bike or car in ${where}. Live listings on ${brand}.`
        : `Motorbikes, scooters and cars for rent. Compare offers on ${brand}.`,
    }
  }
  if (category === 'property') {
    return {
      title: where ? `Villas & apartments in ${where} | ${brand}` : `Villas & apartments | ${brand}`,
      description: where
        ? `Holiday homes and condos in ${where}. Book on ${brand}.`
        : `Find villas, condos and apartments. Filter by area and dates on ${brand}.`,
    }
  }
  if (category === 'tours') {
    return {
      title: where ? `Tours & experiences in ${where} | ${brand}` : `Tours & experiences | ${brand}`,
      description: `Tours and activities${where ? ` in ${where}` : ''}. Book on ${brand}.`,
    }
  }
  if (category === 'yachts') {
    return {
      title: where ? `Yacht & boat charter in ${where} | ${brand}` : `Yacht & boat charter | ${brand}`,
      description: `Yachts and boat trips${where ? ` in ${where}` : ''}. Curated listings on ${brand}.`,
    }
  }
  return {
    title: where ? `Rentals — ${place} | ${brand}` : `Rentals: stays, transport, tours | ${brand}`,
    description: `Browse stays, transport and tours${where ? ` in ${where}` : ''}. Smart search on ${brand}.`,
  }
}

/**
 * @param {'ru'|'en'|'zh'|'th'} lang
 * @param {import('next').SearchParams | Record<string, string | string[] | undefined>} searchParamsRecord
 */
export function getListingsCatalogTitleAndDescription(lang, searchParamsRecord) {
  if (lang === 'zh' || lang === 'th') {
    return getListingsCatalogTitleAndDescription('en', searchParamsRecord)
  }

  const sp = nextSearchParamsRecordToURLSearchParams(searchParamsRecord)
  const category = normalizeListingCategorySlugForSearch(sp.get('category'))
  const where = pickWhere(sp)

  if (lang === 'ru') {
    return titlesRu(category, where)
  }
  return titlesEn(category, where)
}

/**
 * Stage 69.0–69.2 — metadata `/listings` с учётом иерархии, `name_i18n`, профиля визарда и (опционально) числа объявлений.
 * Шаблоны title/description — через **`t(langNorm)`** и слайс **`catalog-seo`** (см. **`buildCatalogSeoFromProfile`**).
 * @param {'ru'|'en'|'zh'|'th'} lang
 * @param {import('next').SearchParams | Record<string, string | string[] | undefined>} searchParamsRecord
 * @param {Array<{ id: string, slug: string, name: string, parent_id?: string | null, name_i18n?: object | null, wizard_profile?: string | null, description?: string | null }>} rows
 * @param {number | null} [listingCount] — ACTIVE в области категории (+ дети) и фильтра where; null = не подставлять в description
 */
export async function getListingsCatalogTitleAndDescriptionWithRows(lang, searchParamsRecord, rows, listingCount = null) {
  const langNorm = ['ru', 'en', 'zh', 'th'].includes(lang) ? lang : 'en'
  const sp = nextSearchParamsRecordToURLSearchParams(searchParamsRecord)
  const category = normalizeListingCategorySlugForSearch(sp.get('category'))
  const where = pickWhere(sp)

  if (!rows?.length || !category || category === 'all') {
    const tr = t(langNorm)
    const fallbackName = tr('catalogSeo_fallback_categoryName')
    return await buildCatalogSeoFromProfile(
      langNorm,
      where,
      fallbackName,
      'default',
      listingCount,
      tr,
    )
  }

  const flat = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    parentId: r.parent_id ?? null,
    parent_id: r.parent_id ?? null,
    nameI18n: r.name_i18n ?? null,
    name_i18n: r.name_i18n ?? null,
    wizardProfile: r.wizard_profile ?? r.wizardProfile ?? null,
    wizard_profile: r.wizard_profile ?? r.wizardProfile ?? null,
    description: r.description ?? null,
  }))

  const slug = String(category).toLowerCase()
  const cur = flat.find((c) => String(c.slug || '').toLowerCase() === slug)
  if (!cur) {
    const tr = t(langNorm)
    return await buildCatalogSeoFromProfile(
      langNorm,
      where,
      tr('catalogSeo_fallback_categoryName'),
      'default',
      listingCount,
      tr,
    )
  }

  const leafName = getCategoryDisplayName(cur, langNorm)
  const whereParsed = pickWhere(sp)
  const eff = effectiveCategoryWizardProfileRaw(slug, flat)
  const profileKey = resolveCatalogSeoProfileKey(eff, slug)
  const tr = t(langNorm)

  return await buildCatalogSeoFromProfile(langNorm, whereParsed, leafName, profileKey, listingCount, tr)
}
