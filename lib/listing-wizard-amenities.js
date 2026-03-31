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

export const AMENITY_SLUGS = [
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
