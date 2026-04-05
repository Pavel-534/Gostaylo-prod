/**
 * Нормализация metadata объявления партнёра под пост-фильтры поиска (числа, коды языков).
 */
import { clampIntFromDigits } from '@/lib/listing-wizard-numeric'
import { isTransportListingCategory, isTourListingCategory } from '@/lib/listing-category-slug'
import { filterAmenitiesForPartnerCategory } from '@/lib/listing-wizard-amenities'

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

  if (isTourListingCategory(slug)) {
    delete out.discounts
    const tourAmenities = filterAmenitiesForPartnerCategory(slug, out.amenities)
    if (tourAmenities.length) out.amenities = tourAmenities
    else delete out.amenities

    const gMin = parseNonNegativeInt(out.group_size_min, 999)
    const gMax = parseNonNegativeInt(out.group_size_max, 999)
    if (gMin !== undefined && gMin >= 1) out.group_size_min = gMin
    else delete out.group_size_min
    if (gMax !== undefined && gMax >= 1) out.group_size_max = gMax
    else delete out.group_size_max
    if (
      out.group_size_min != null &&
      out.group_size_max != null &&
      out.group_size_max < out.group_size_min
    ) {
      out.group_size_max = out.group_size_min
    }
  }

  if (isTransportListingCategory(slug)) {
    delete out.bedrooms
    delete out.bathrooms
    delete out.max_guests
    delete out.area
    delete out.property_type

    const vehAmenities = filterAmenitiesForPartnerCategory(slug, out.amenities)
    if (vehAmenities.length) out.amenities = vehAmenities
    else delete out.amenities

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
    if (y !== undefined && y >= 1985 && y <= 2100) out.vehicle_year = y
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
 * Для туров: если в metadata ещё нет group_size_*, один раз подставить из колонок
 * min_booking_days / max_booking_days (старый UI ошибочно писал туда размер группы).
 * @param {Record<string, unknown>} metadata
 * @param {unknown} minBookingDays
 * @param {unknown} maxBookingDays
 */
export function mergeTourGroupMetadataFromListingColumns(metadata, minBookingDays, maxBookingDays) {
  const m =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? { ...metadata } : {}
  const hasGmin = m.group_size_min != null && m.group_size_min !== ''
  const hasGmax = m.group_size_max != null && m.group_size_max !== ''
  const colMin = clampIntFromDigits(minBookingDays ?? 1, 1, 999, 1)
  const colMax =
    maxBookingDays != null && maxBookingDays !== ''
      ? clampIntFromDigits(maxBookingDays, 1, 999, Math.max(colMin, 10))
      : null

  m.group_size_min = hasGmin ? clampIntFromDigits(m.group_size_min, 1, 999, 1) : colMin

  const defaultMax = colMax != null ? colMax : Math.max(m.group_size_min, 10)
  m.group_size_max = hasGmax
    ? clampIntFromDigits(m.group_size_max, 1, 999, 999)
    : defaultMax

  if (m.group_size_max < m.group_size_min) m.group_size_max = m.group_size_min
  return m
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
    if (y !== undefined && y >= 1985 && y <= 2100) meta.vehicle_year = y
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

  for (const key of ['group_size_min', 'group_size_max']) {
    if (meta[key] != null && meta[key] !== '') {
      const n = parseNonNegativeInt(meta[key], 999)
      if (n !== undefined && n >= 1) meta[key] = n
      else delete meta[key]
    } else {
      delete meta[key]
    }
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
