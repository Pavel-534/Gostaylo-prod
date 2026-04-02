/**
 * Заглушки PostalAddress для LodgingBusiness (Rich Results), когда в БД нет точного адреса.
 * Индексы — ориентиры по районам Пхукета; общий fallback — 83100.
 */

const PHUKET_DEFAULT_POSTAL = '83100'

/** @type {Record<string, string>} ключ — нормализованное имя района (латиница) */
const DISTRICT_POSTAL = {
  rawai: '83130',
  chalong: '83130',
  'nai harn': '83130',
  kata: '83100',
  karon: '83100',
  patong: '83150',
  kamala: '83120',
  surin: '83110',
  'bang tao': '83110',
  'bangtao': '83110',
  panwa: '83000',
  'mai khao': '83110',
  'nai yang': '83110',
  'phuket town': '83000',
  phuket: PHUKET_DEFAULT_POSTAL,
}

function normalizeDistrictKey(district) {
  if (district == null) return ''
  return String(district)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * @param {string | null | undefined} district
 * @returns {string} 5-digit-style postal для Таиланда
 */
export function phuketPostalCodeForDistrict(district) {
  const key = normalizeDistrictKey(district)
  if (!key) return PHUKET_DEFAULT_POSTAL
  if (DISTRICT_POSTAL[key]) return DISTRICT_POSTAL[key]
  const compact = key.replace(/\s+/g, '')
  for (const [k, code] of Object.entries(DISTRICT_POSTAL)) {
    if (k.replace(/\s+/g, '') === compact) return code
  }
  return PHUKET_DEFAULT_POSTAL
}

/**
 * @param {{ address?: string | null, district?: string | null }} listing
 * @returns {string} streetAddress для Schema.org (без раскрытия точного дома)
 */
export function lodgingStreetAddressStub(listing) {
  const raw = listing?.address != null ? String(listing.address).trim() : ''
  if (raw.length >= 3) return raw.slice(0, 200)
  const d = listing?.district != null ? String(listing.district).trim() : ''
  if (d) return `Near ${d}, Phuket, Thailand`
  return 'Phuket, Thailand'
}
