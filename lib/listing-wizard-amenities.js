/**
 * Slug'и удобств (как в мастере) + нормализация легаси-подписей (Wi-Fi → wifi).
 */

export const LEGACY_AMENITY_MAP = {
  'Wi-Fi': 'wifi',
  'wi-fi': 'wifi',
  Pool: 'pool',
  Parking: 'parking',
  AC: 'ac',
  Kitchen: 'kitchen',
  Laundry: 'laundry',
  Security: 'security',
  Garden: 'garden',
  Terrace: 'terrace',
  BBQ: 'bbq',
  Gym: 'gym',
  Sauna: 'sauna',
}

/** Удобства жилья: партнёрский редактор + фильтры поиска по недвижимости. */
export const PROPERTY_PARTNER_AMENITY_SLUGS = [
  'wifi',
  'pool',
  'parking',
  'ac',
  'kitchen',
  'laundry',
  'security',
  'garden',
  'terrace',
  'bbq',
  'gym',
  'sauna',
]

/** Включено в объявление тура (партнёрский редактор). */
export const TOUR_PARTNER_AMENITY_SLUGS = ['transfer', 'food', 'guide', 'tickets']

/** Все slug'и, которые нормализуем при сохранении (объединение жильё + туры). */
export const AMENITY_SLUGS = [...PROPERTY_PARTNER_AMENITY_SLUGS, ...TOUR_PARTNER_AMENITY_SLUGS]

/** Удобства жилья, не показываем в партнёрском редакторе для категории «транспорт». */
export const VEHICLE_PARTNER_AMENITY_SLUGS = ['parking', 'ac']

export function amenitySlugsForPartnerCategory(categorySlug) {
  const s = String(categorySlug || '').toLowerCase()
  if (s === 'vehicles' || s === 'transport' || s === 'vehicle') {
    return VEHICLE_PARTNER_AMENITY_SLUGS
  }
  if (s === 'tours') {
    return TOUR_PARTNER_AMENITY_SLUGS
  }
  return PROPERTY_PARTNER_AMENITY_SLUGS
}

export function filterAmenitiesForPartnerCategory(categorySlug, arr) {
  const allowed = new Set(amenitySlugsForPartnerCategory(categorySlug))
  if (!Array.isArray(arr)) return []
  return [...new Set(arr.map((x) => LEGACY_AMENITY_MAP[x] || String(x).toLowerCase()).filter((slug) => allowed.has(slug)))]
}

export function normalizeWizardAmenities(arr) {
  if (!Array.isArray(arr)) return []
  const allowed = new Set(AMENITY_SLUGS)
  return [
    ...new Set(
      arr
        .map((x) => LEGACY_AMENITY_MAP[x] || String(x).toLowerCase())
        .filter((s) => allowed.has(s)),
    ),
  ]
}
