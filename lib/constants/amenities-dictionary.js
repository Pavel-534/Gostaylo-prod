/**
 * SSOT amenity dictionary for partner wizard + search filters.
 * slug — canonical storage key in listings.metadata.amenities.
 */
export const AMENITIES_DICTIONARY = [
  { slug: 'wifi', i18nKey: 'amenity.wifi', categories: ['property'] },
  { slug: 'pool', i18nKey: 'amenity.pool', categories: ['property'] },
  { slug: 'parking', i18nKey: 'amenity.parking', categories: ['property', 'vehicle'] },
  { slug: 'ac', i18nKey: 'amenity.ac', categories: ['property', 'vehicle'] },
  { slug: 'kitchen', i18nKey: 'amenity.kitchen', categories: ['property'] },
  { slug: 'laundry', i18nKey: 'amenity.laundry', categories: ['property'] },
  { slug: 'security', i18nKey: 'amenity.security', categories: ['property'] },
  { slug: 'garden', i18nKey: 'amenity.garden', categories: ['property'] },
  { slug: 'terrace', i18nKey: 'amenity.terrace', categories: ['property'] },
  { slug: 'bbq', i18nKey: 'amenity.bbq', categories: ['property'] },
  { slug: 'gym', i18nKey: 'amenity.gym', categories: ['property'] },
  { slug: 'sauna', i18nKey: 'amenity.sauna', categories: ['property'] },
  { slug: 'transfer', i18nKey: 'amenity.transfer', categories: ['tour'] },
  { slug: 'food', i18nKey: 'amenity.food', categories: ['tour'] },
  { slug: 'guide', i18nKey: 'amenity.guide', categories: ['tour'] },
  { slug: 'tickets', i18nKey: 'amenity.tickets', categories: ['tour'] },
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
