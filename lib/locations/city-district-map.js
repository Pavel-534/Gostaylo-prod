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
 * @param {string} city
 * @returns {string[] | null} null если город не в карте — использовать прежнюю логику metadata + ilike
 */
export function getDistrictsForCity(city) {
  if (!city || city === 'all') return null
  const list = DISTRICTS_BY_CITY[city]
  return list?.length ? list : null
}
