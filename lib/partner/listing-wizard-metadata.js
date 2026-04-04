/**
 * Нормализация metadata объявления партнёра под пост-фильтры поиска (числа, коды языков).
 */
import { isTransportListingCategory } from '@/lib/listing-category-slug'

const HOUSING_SLUGS = new Set([
  'property',
  'villa',
  'apartment',
  'house',
  'condo',
  'studio',
  'penthouse',
  'accommodation',
])

const NANNY_LANG_IDS = new Set(['ru', 'en', 'th', 'zh'])

function parseNonNegativeInt(val, max = 99_999_999) {
  if (val === null || val === undefined || val === '') return undefined
  if (typeof val === 'number' && Number.isFinite(val)) {
    const n = Math.floor(val)
    return n >= 0 && n <= max ? n : undefined
  }
  const digits = String(val).replace(/\D/g, '')
  if (!digits) return undefined
  const n = parseInt(digits, 10)
  return Number.isFinite(n) && n >= 0 && n <= max ? n : undefined
}

function normalizeLanguages(raw) {
  if (raw == null) return []
  const arr = Array.isArray(raw)
    ? raw
    : String(raw)
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
  const out = []
  for (const x of arr) {
    const id = String(x).toLowerCase().trim()
    if (NANNY_LANG_IDS.has(id)) out.push(id)
  }
  return [...new Set(out)]
}

/**
 * @param {Record<string, unknown>} metadata
 * @param {string} categorySlug
 */
export function normalizePartnerListingMetadata(metadata = {}, categorySlug = '') {
  const out = { ...metadata }
  const slug = String(categorySlug || '').toLowerCase()

  const housingLike =
    HOUSING_SLUGS.has(slug) ||
    (slug &&
      slug !== 'tours' &&
      slug !== 'yachts' &&
      !isTransportListingCategory(slug) &&
      slug !== 'nanny' &&
      slug !== 'babysitter')

  if (housingLike) {
    const br = parseNonNegativeInt(out.bedrooms, 99)
    const bt = parseNonNegativeInt(out.bathrooms, 99)
    if (br !== undefined) out.bedrooms = br
    else delete out.bedrooms
    if (bt !== undefined) out.bathrooms = bt
    else delete out.bathrooms
    const mg = parseNonNegativeInt(out.max_guests, 999)
    if (mg !== undefined) out.max_guests = mg
    const area = parseNonNegativeInt(out.area, 99_999_999)
    if (area !== undefined) out.area = area
  }

  if (isTransportListingCategory(slug)) {
    delete out.bedrooms
    delete out.bathrooms
    delete out.max_guests
    delete out.area
    delete out.property_type
    delete out.amenities

    const tr = String(out.transmission || '').trim().toLowerCase()
    if (tr) out.transmission = tr
    else delete out.transmission

    const fu = String(out.fuel_type || '').trim().toLowerCase()
    if (fu) out.fuel_type = fu
    else delete out.fuel_type

    const cc = parseNonNegativeInt(out.engine_cc, 500_000)
    if (cc !== undefined && cc > 0) out.engine_cc = cc
    else delete out.engine_cc

    const y = parseNonNegativeInt(out.vehicle_year, 2100)
    if (y !== undefined && y >= 1950 && y <= 2100) out.vehicle_year = y
    else delete out.vehicle_year

    const seats = parseNonNegativeInt(out.seats, 99)
    if (seats !== undefined && seats > 0) out.seats = seats
    else delete out.seats
  }

  const rawDisc = out.discounts
  if (rawDisc != null && typeof rawDisc === 'object' && !Array.isArray(rawDisc)) {
    const next = { ...rawDisc }
    const w = parseNonNegativeInt(next.weekly, 100)
    if (w !== undefined && w > 0) next.weekly = w
    else delete next.weekly
    const m = parseNonNegativeInt(next.monthly, 100)
    if (m !== undefined && m > 0) next.monthly = m
    else delete next.monthly
    if (Object.keys(next).length) out.discounts = next
    else delete out.discounts
  }

  if (slug === 'nanny' || slug === 'babysitter') {
    const langs = normalizeLanguages(out.languages)
    if (langs.length) out.languages = langs
    else delete out.languages

    const ex = parseNonNegativeInt(
      out.experience_years ?? out.nanny_experience_min ?? out.experience ?? out.years_experience,
      80,
    )
    if (ex !== undefined) {
      out.experience_years = ex
    } else {
      delete out.experience_years
    }
    delete out.nanny_experience_min
    delete out.experience
    delete out.years_experience

    const spec = String(out.specialization || '').trim()
    if (spec) out.specialization = spec
    else delete out.specialization
  }

  return out
}

/**
 * Привести metadata с сервера к удобному виду для формы (языки, опыт, числа).
 * @param {Record<string, unknown>} raw
 */
export function partnerMetadataStateFromServer(raw = {}) {
  const meta = { ...raw }
  const allowed = new Set(['ru', 'en', 'th', 'zh'])
  if (Array.isArray(meta.languages)) {
    meta.languages = [
      ...new Set(
        meta.languages
          .map((x) => String(x).toLowerCase().trim())
          .filter((x) => allowed.has(x)),
      ),
    ]
  } else {
    meta.languages = []
  }

  const exp = meta.experience_years ?? meta.nanny_experience_min ?? meta.experience ?? meta.years_experience
  if (exp != null && exp !== '') {
    const n = parseNonNegativeInt(exp, 80)
    if (n !== undefined) meta.experience_years = n
    else delete meta.experience_years
  } else {
    delete meta.experience_years
  }
  delete meta.nanny_experience_min
  delete meta.experience
  delete meta.years_experience

  if (meta.transmission != null && String(meta.transmission).trim()) {
    meta.transmission = String(meta.transmission).trim().toLowerCase()
  } else {
    delete meta.transmission
  }
  if (meta.fuel_type != null && String(meta.fuel_type).trim()) {
    meta.fuel_type = String(meta.fuel_type).trim().toLowerCase()
  } else {
    delete meta.fuel_type
  }
  if (meta.engine_cc != null && meta.engine_cc !== '') {
    const cc = parseNonNegativeInt(meta.engine_cc, 500_000)
    if (cc !== undefined && cc > 0) meta.engine_cc = cc
    else delete meta.engine_cc
  } else {
    delete meta.engine_cc
  }

  if (meta.vehicle_year != null && meta.vehicle_year !== '') {
    const y = parseNonNegativeInt(meta.vehicle_year, 2100)
    if (y !== undefined && y >= 1950 && y <= 2100) meta.vehicle_year = y
    else delete meta.vehicle_year
  } else {
    delete meta.vehicle_year
  }

  if (meta.seats != null && meta.seats !== '') {
    const st = parseNonNegativeInt(meta.seats, 99)
    if (st !== undefined && st > 0) meta.seats = st
    else delete meta.seats
  } else {
    delete meta.seats
  }

  if (meta.specialization != null) {
    meta.specialization = String(meta.specialization)
  }

  return meta
}

export function isPartnerListingHousingCategory(categorySlug, categoryName = '') {
  const s = String(categorySlug || '').toLowerCase()
  const n = String(categoryName || '').toLowerCase()
  if (HOUSING_SLUGS.has(s)) return true
  if (s === 'tours' || s === 'yachts' || isTransportListingCategory(s) || s === 'nanny' || s === 'babysitter') {
    return false
  }
  if (s === 'property') return true
  if (
    n.includes('villa') ||
    n.includes('property') ||
    n.includes('недвижим') ||
    n.includes('апарт') ||
    n.includes('вилл') ||
    n.includes('жиль')
  ) {
    return true
  }
  return false
}
