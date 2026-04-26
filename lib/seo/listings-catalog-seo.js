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
  if (category === 'vehicles' && where) {
    return {
      title: `Аренда байков и авто на ${where}, Пхукет | ${getSiteDisplayName()}`,
      description: `Снять байк или авто в районе ${where} на Пхукете. Актуальные объявления, цены в батах на ${getSiteDisplayName()}.`,
    }
  }
  if (category === 'vehicles') {
    return {
      title: `Аренда байков и авто на Пхукете | ${getSiteDisplayName()}`,
      description: `Аренда мотобайков, скутеров и автомобилей на Пхукете. Сравните цены и забронируйте на ${getSiteDisplayName()}.`,
    }
  }
  if (category === 'property' && where) {
    return {
      title: `Аренда вилл и апартаментов в ${where}, Пхукет | ${getSiteDisplayName()}`,
      description: `Виллы и апартаменты в районе ${where}. Долгосрочная и посуточная аренда на Пхукете — ${getSiteDisplayName()}.`,
    }
  }
  if (category === 'property') {
    return {
      title: `Аренда вилл и апартаментов на Пхукете | ${getSiteDisplayName()}`,
      description: `Подбор жилья на Пхукете: виллы, кондо, апартаменты. Фильтры по району и датам на ${getSiteDisplayName()}.`,
    }
  }
  if (category === 'tours') {
    return {
      title: where
        ? `Экскурсии и туры в ${where}, Пхукет | ${getSiteDisplayName()}`
        : `Экскурсии и туры на Пхукете | ${getSiteDisplayName()}`,
      description: `Туры и развлечения на Пхукете${where ? ` (${where})` : ''}. Бронирование на ${getSiteDisplayName()}.`,
    }
  }
  if (category === 'yachts') {
    return {
      title: where
        ? `Аренда яхт и катеров в ${where}, Пхукет | ${getSiteDisplayName()}`
        : `Аренда яхт и катеров на Пхукете | ${getSiteDisplayName()}`,
      description: `Яхты и морские прогулки на Пхукете. Проверенные предложения на ${getSiteDisplayName()}.`,
    }
  }
  return {
    title: where
      ? `Аренда на Пхукете — ${where} | ${getSiteDisplayName()}`
      : `Аренда на Пхукете: виллы, транспорт, туры | ${getSiteDisplayName()}`,
    description: `Каталог аренды на Пхукете: жильё, байки, туры и яхты. Удобный поиск на ${getSiteDisplayName()}.`,
  }
}

function titlesEn(category, where) {
  if (category === 'vehicles' && where) {
    return {
      title: `Scooter & car rental in ${where}, Phuket | ${getSiteDisplayName()}`,
      description: `Rent a bike or car in ${where}, Phuket. Live listings and THB prices on ${getSiteDisplayName()}.`,
    }
  }
  if (category === 'vehicles') {
    return {
      title: `Scooter & car rental in Phuket | ${getSiteDisplayName()}`,
      description: `Motorbikes, scooters and cars for rent in Phuket. Compare offers on ${getSiteDisplayName()}.`,
    }
  }
  if (category === 'property' && where) {
    return {
      title: `Villas & apartments in ${where}, Phuket | ${getSiteDisplayName()}`,
      description: `Holiday homes and condos in ${where}. Short & long stays in Phuket — ${getSiteDisplayName()}.`,
    }
  }
  if (category === 'property') {
    return {
      title: `Villas & apartments in Phuket | ${getSiteDisplayName()}`,
      description: `Find villas, condos and apartments in Phuket. Filter by area and dates on ${getSiteDisplayName()}.`,
    }
  }
  if (category === 'tours') {
    return {
      title: where
        ? `Tours & experiences in ${where}, Phuket | ${getSiteDisplayName()}`
        : `Tours & experiences in Phuket | ${getSiteDisplayName()}`,
      description: `Phuket tours and activities${where ? ` in ${where}` : ''}. Book on ${getSiteDisplayName()}.`,
    }
  }
  if (category === 'yachts') {
    return {
      title: where
        ? `Yacht & boat charter in ${where}, Phuket | ${getSiteDisplayName()}`
        : `Yacht & boat charter in Phuket | ${getSiteDisplayName()}`,
      description: `Yachts and boat trips in Phuket. Curated listings on ${getSiteDisplayName()}.`,
    }
  }
  return {
    title: where
      ? `Phuket rentals — ${where} | ${getSiteDisplayName()}`
      : `Phuket rentals: villas, transport, tours | ${getSiteDisplayName()}`,
    description: `Browse villas, bikes, tours and yachts in Phuket. Smart search on ${getSiteDisplayName()}.`,
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
export function getListingsCatalogTitleAndDescriptionWithRows(lang, searchParamsRecord, rows, listingCount = null) {
  const langNorm = ['ru', 'en', 'zh', 'th'].includes(lang) ? lang : 'en'
  const sp = nextSearchParamsRecordToURLSearchParams(searchParamsRecord)
  const category = normalizeListingCategorySlugForSearch(sp.get('category'))
  const where = pickWhere(sp)

  if (!rows?.length || !category || category === 'all') {
    return langNorm === 'ru' ? titlesRu(category, where) : titlesEn(category, where)
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
    return langNorm === 'ru' ? titlesRu(category, where) : titlesEn(category, where)
  }

  const leafName = getCategoryDisplayName(cur, langNorm)
  const whereParsed = pickWhere(sp)
  const eff = effectiveCategoryWizardProfileRaw(slug, flat)
  const profileKey = resolveCatalogSeoProfileKey(eff, slug)
  const tr = t(langNorm)

  return buildCatalogSeoFromProfile(langNorm, whereParsed, leafName, profileKey, listingCount, tr)
}
