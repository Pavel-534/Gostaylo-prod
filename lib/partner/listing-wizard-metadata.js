/**
 * Нормализация metadata объявления партнёра под пост-фильтры поиска (числа, коды языков).
 */
import { clampIntFromDigits } from '@/lib/listing-wizard-numeric'
import { isTransportListingCategory, isTourListingCategory, isYachtLikeCategory } from '@/lib/listing-category-slug'
import { filterAmenitiesForPartnerCategory } from '@/lib/listing-wizard-amenities'
import { getAllowedWizardMetadataKeys, resolveWizardFormProfile } from '@/lib/config/category-form-schema'
import { inferListingServiceTypeFromRegistry } from '@/lib/config/category-behavior'
import { normalizeCategoryWizardProfileColumn } from '@/lib/config/category-wizard-profile-db'
import { PARTNER_LISTING_HOUSING_SLUGS } from '@/lib/partner/partner-listing-housing-category'

export { isPartnerListingHousingCategory } from '@/lib/partner/partner-listing-housing-category'

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

function normalizePremiumAirSeaFields(out) {
  if (out.crew_included === true || out.crew_included === 'true') out.crew_included = true
  else delete out.crew_included
  if (out.catering_available === true || out.catering_available === 'true') out.catering_available = true
  else delete out.catering_available
  const fr = String(out.flight_rules ?? '').trim().slice(0, 4000)
  if (fr) out.flight_rules = fr
  else delete out.flight_rules
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
 * @param {string} [categoryNameFallback] — для allowed keys (legacy имя категории).
 * @param {string | null | undefined} [wizardProfileFromDb] — `categories.wizard_profile` (SSOT)
 */
export function normalizePartnerListingMetadata(
  metadata = {},
  categorySlug = '',
  categoryNameFallback = '',
  wizardProfileFromDb,
) {
  const out = { ...metadata }
  const slug = String(categorySlug || '').toLowerCase()
  const nameFb = String(categoryNameFallback || '')
  const dbCol = normalizeCategoryWizardProfileColumn(wizardProfileFromDb)

  const svcType = inferListingServiceTypeFromRegistry(slug, wizardProfileFromDb)
  const housingLike =
    dbCol === 'stay' ||
    PARTNER_LISTING_HOUSING_SLUGS.has(slug) ||
    (slug &&
      slug !== 'tours' &&
      slug !== 'yachts' &&
      !isTransportListingCategory(slug) &&
      slug !== 'nanny' &&
      slug !== 'babysitter' &&
      svcType !== 'service' &&
      !isTourListingCategory(slug) &&
      !isYachtLikeCategory(slug) &&
      dbCol !== 'tour' &&
      dbCol !== 'yacht' &&
      dbCol !== 'transport' &&
      dbCol !== 'transport_helicopter')

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

  if (isTourListingCategory(slug) || dbCol === 'tour') {
    delete out.discounts
    const tourAmenities = filterAmenitiesForPartnerCategory(slug, out.amenities)
    if (tourAmenities.length) out.amenities = tourAmenities
    else delete out.amenities

    const dur = String(out.duration ?? '').trim().slice(0, 500)
    if (dur) out.duration = dur
    else delete out.duration

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

  if (isTransportListingCategory(slug) || dbCol === 'transport' || dbCol === 'transport_helicopter') {
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

    const fp = String(out.fuel_policy || '').trim().toLowerCase()
    if (fp && fp !== 'unset') out.fuel_policy = fp
    else delete out.fuel_policy

    const isHeli =
      slug === 'helicopter' || slug === 'helicopters' || dbCol === 'transport_helicopter'
    if (isHeli) normalizePremiumAirSeaFields(out)
  }

  if (isYachtLikeCategory(slug) || dbCol === 'yacht') {
    delete out.bedrooms
    delete out.bathrooms
    delete out.max_guests
    delete out.area
    delete out.property_type
    const yAmenities = filterAmenitiesForPartnerCategory(slug, out.amenities)
    if (yAmenities.length) out.amenities = yAmenities
    else delete out.amenities

    const pax = parseNonNegativeInt(out.passengers, 999)
    if (pax !== undefined && pax >= 1) out.passengers = pax
    else delete out.passengers

    const eng = String(out.engine || '').trim().slice(0, 500)
    if (eng) out.engine = eng
    else delete out.engine

    normalizePremiumAirSeaFields(out)
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

  const wizardProfile = resolveWizardFormProfile(slug, nameFb, wizardProfileFromDb)
  if (
    wizardProfile === 'nanny' ||
    wizardProfile === 'service_generic' ||
    wizardProfile === 'chef' ||
    wizardProfile === 'massage'
  ) {
    delete out.bedrooms
    delete out.bathrooms
    delete out.max_guests
    delete out.area
    delete out.property_type
    delete out.fuel_policy
    delete out.transmission
    delete out.fuel_type
    delete out.engine_cc
    delete out.vehicle_year
    delete out.seats

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

    const cert = String(out.certifications ?? '').trim().slice(0, 4000)
    if (cert) out.certifications = cert
    else delete out.certifications

    if (wizardProfile === 'nanny') {
      const spec = String(out.specialization || '').trim().slice(0, 500)
      if (spec) out.specialization = spec
      else delete out.specialization
      const ag = String(out.age_groups ?? '').trim().slice(0, 500)
      if (ag) out.age_groups = ag
      else delete out.age_groups
      if (out.live_in_option === true || out.live_in_option === 'true') out.live_in_option = true
      else delete out.live_in_option
    }

    if (wizardProfile === 'chef') {
      const cu = String(out.cuisine_types ?? '').trim().slice(0, 500)
      if (cu) out.cuisine_types = cu
      else delete out.cuisine_types
      const mp = parseNonNegativeInt(out.min_persons, 999)
      if (mp !== undefined && mp >= 1) out.min_persons = mp
      else delete out.min_persons
    }

    if (wizardProfile === 'massage') {
      const mt = String(out.massage_types ?? '').trim().slice(0, 2000)
      if (mt) out.massage_types = mt
      else delete out.massage_types
      if (out.home_visit === true || out.home_visit === 'true') out.home_visit = true
      else delete out.home_visit
    }
  }

  const IANA_TZ = /^[A-Za-z_]+\/[A-Za-z0-9_+\-]+$/
  if (out.timezone != null) {
    const tz = String(out.timezone).trim()
    if (IANA_TZ.test(tz)) out.timezone = tz
    else delete out.timezone
  } else {
    delete out.timezone
  }

  if (Array.isArray(out.check_in_photos)) {
    const urls = out.check_in_photos
      .map((u) => String(u || '').trim())
      .filter((u) => /^https?:\/\//i.test(u))
      .slice(0, 3)
    if (urls.length) out.check_in_photos = urls
    else delete out.check_in_photos
  } else if (out.check_in_photos != null) {
    delete out.check_in_photos
  }

  const allowed = getAllowedWizardMetadataKeys(slug, nameFb, wizardProfileFromDb)
  for (const key of Object.keys(out)) {
    if (!allowed.has(key)) delete out[key]
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

  if (meta.certifications != null) {
    const c = String(meta.certifications).trim().slice(0, 4000)
    if (c) meta.certifications = c
    else delete meta.certifications
  }
  if (meta.age_groups != null) {
    const ag = String(meta.age_groups).trim().slice(0, 500)
    if (ag) meta.age_groups = ag
    else delete meta.age_groups
  }
  if (meta.live_in_option === true || meta.live_in_option === 'true') meta.live_in_option = true
  else delete meta.live_in_option

  if (meta.cuisine_types != null) {
    const cu = String(meta.cuisine_types).trim().slice(0, 500)
    if (cu) meta.cuisine_types = cu
    else delete meta.cuisine_types
  }
  if (meta.min_persons != null && meta.min_persons !== '') {
    const mp = parseNonNegativeInt(meta.min_persons, 999)
    if (mp !== undefined && mp >= 1) meta.min_persons = mp
    else delete meta.min_persons
  } else {
    delete meta.min_persons
  }

  if (meta.massage_types != null) {
    const mt = String(meta.massage_types).trim().slice(0, 2000)
    if (mt) meta.massage_types = mt
    else delete meta.massage_types
  }
  if (meta.home_visit === true || meta.home_visit === 'true') meta.home_visit = true
  else delete meta.home_visit

  if (meta.crew_included === true || meta.crew_included === 'true') meta.crew_included = true
  else delete meta.crew_included
  if (meta.catering_available === true || meta.catering_available === 'true') meta.catering_available = true
  else delete meta.catering_available
  if (meta.flight_rules != null && String(meta.flight_rules).trim()) {
    meta.flight_rules = String(meta.flight_rules).trim().slice(0, 4000)
  } else {
    delete meta.flight_rules
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

  const tzRaw = meta.timezone != null ? String(meta.timezone).trim() : ''
  const IANA_TZ_RE = /^[A-Za-z_]+\/[A-Za-z0-9_+\-]+$/
  if (tzRaw && IANA_TZ_RE.test(tzRaw)) meta.timezone = tzRaw
  else delete meta.timezone

  if (Array.isArray(meta.check_in_photos)) {
    meta.check_in_photos = meta.check_in_photos
      .map((u) => String(u || '').trim())
      .filter((u) => /^https?:\/\//i.test(u))
      .slice(0, 3)
    if (meta.check_in_photos.length === 0) delete meta.check_in_photos
  } else if (meta.check_in_photos != null) {
    delete meta.check_in_photos
  }

  return meta
}
