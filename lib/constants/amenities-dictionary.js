/**
 * SSOT amenity dictionary for partner wizard + search filters + Lucide icons.
 * slug — canonical storage key in listings.metadata.amenities.
 * iconName — export name from `lucide-react` (see `lib/listing/amenity-lucide-icon.jsx`).
 * i18nKey — логический ключ для UI (подписи сейчас в основном из `amenityTranslations` в `lib/translations/categories.js`).
 */
export const AMENITIES_DICTIONARY = [
  // Топ удобств жилья / транспорта (иконки — визуальный SSOT каталога)
  { slug: 'wifi', i18nKey: 'amenities.wifi', iconName: 'Wifi', categories: ['property'] },
  { slug: 'pool', i18nKey: 'amenities.pool', iconName: 'Waves', categories: ['property'] },
  { slug: 'parking', i18nKey: 'amenities.parking', iconName: 'ParkingCircle', categories: ['property', 'vehicle'] },
  { slug: 'ac', i18nKey: 'amenities.ac', iconName: 'Wind', categories: ['property', 'vehicle'] },
  { slug: 'kitchen', i18nKey: 'amenities.kitchen', iconName: 'UtensilsCrossed', categories: ['property'] },
  { slug: 'laundry', i18nKey: 'amenities.laundry', iconName: 'WashingMachine', categories: ['property'] },
  { slug: 'security', i18nKey: 'amenities.security', iconName: 'Shield', categories: ['property'] },
  { slug: 'garden', i18nKey: 'amenities.garden', iconName: 'Flower2', categories: ['property'] },
  { slug: 'terrace', i18nKey: 'amenities.terrace', iconName: 'SunMedium', categories: ['property'] },
  { slug: 'bbq', i18nKey: 'amenities.bbq', iconName: 'Flame', categories: ['property'] },
  { slug: 'gym', i18nKey: 'amenities.gym', iconName: 'Dumbbell', categories: ['property'] },
  { slug: 'sauna', i18nKey: 'amenities.sauna', iconName: 'ThermometerSun', categories: ['property'] },
  { slug: 'transfer', i18nKey: 'amenities.transfer', iconName: 'Bus', categories: ['tour'] },
  { slug: 'food', i18nKey: 'amenities.food', iconName: 'Soup', categories: ['tour'] },
  { slug: 'guide', i18nKey: 'amenities.guide', iconName: 'UserRound', categories: ['tour'] },
  { slug: 'tickets', i18nKey: 'amenities.tickets', iconName: 'Ticket', categories: ['tour'] },
]

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

export const AMENITY_DICTIONARY_BY_SLUG = new Map(
  AMENITIES_DICTIONARY.map((row) => [row.slug, row]),
)

export function normalizeAmenitySlug(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return null
  const lowered = String(LEGACY_AMENITY_MAP[value] || value).toLowerCase()
  return AMENITY_DICTIONARY_BY_SLUG.has(lowered) ? lowered : null
}
