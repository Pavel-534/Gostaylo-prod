/**
 * Карта «канонический город → районы» для поиска.
 * Когда пользователь выбирает город (where=Phuket), показываем все листинги
 * с metadata.city = Phuket ИЛИ district из этого списка — не только ILIKE по слову «Phuket».
 *
 * Синхронизируйте с app/api/v2/search/locations (PHUKET_DISTRICTS) при изменении.
 */

/** Районы Пхукета (как в БД / форме партнёра) */
export const PHUKET_DISTRICTS = [
  'Rawai',
  'Chalong',
  'Kata',
  'Karon',
  'Patong',
  'Kamala',
  'Surin',
  'Bang Tao',
  'Nai Harn',
  'Panwa',
  'Mai Khao',
  'Nai Yang',
  'Phuket Town',
  'Cape Panwa',
  'Cherngtalay',
  'Thalang',
]

/**
 * @type {Record<string, string[]>}
 */
export const DISTRICTS_BY_CITY = {
  Phuket: [...PHUKET_DISTRICTS],
  // При росте каталога: Bangkok: [...], Pattaya: [...]
}

/**
 * Slug/code из Where UI → каноническое имя города для umbrella (`metadata.city`, `DISTRICTS_BY_CITY`).
 * Без новых таблиц — только статический словарь (в паре с `country-presets` phuket-city и т.д.).
 */
export function resolveCanonicalCityLabelForGeo(whereValue) {
  if (!whereValue || whereValue === 'all') return null
  const v = String(whereValue).trim()
  const lower = v.toLowerCase()
  /** @type {Record<string, string>} */
  const aliases = {
    'phuket-city': 'Phuket',
    phuket: 'Phuket',
  }
  if (aliases[lower]) return aliases[lower]
  if (Object.prototype.hasOwnProperty.call(DISTRICTS_BY_CITY, v)) return v
  return null
}

/**
 * @param {string} city
 * @returns {string[] | null} null если город не в карте — использовать прежнюю логику metadata + ilike
 */
export function getDistrictsForCity(city) {
  if (!city || city === 'all') return null
  const canon = resolveCanonicalCityLabelForGeo(city) || city
  const list = DISTRICTS_BY_CITY[canon]
  return list?.length ? [...list] : null
}
