/**
 * Хелпер: переупорядочивание POPULAR_DESTINATION_GROUPS под локацию пользователя.
 *
 * Маппинг страны (ISO-2) → group.id (popular-destinations):
 *   RU/BY/UA/KZ → 'russia'        (русскоязычный сегмент)
 *   TH/MY/VN/SG → 'thailand'      (азиатский сегмент)
 *   default      → 'world'         (глобальная аудитория)
 *
 * @param {Array} groups — POPULAR_DESTINATION_GROUPS
 * @param {string|null} userCountry — ISO-2 код страны юзера
 * @returns {Array} — те же группы в новом порядке (приоритетная — первой)
 */
export function reorderDestinationsByGeo(groups, userCountry) {
  if (!userCountry || !Array.isArray(groups) || groups.length === 0) return groups
  const cc = userCountry.toUpperCase()

  let priorityId = null
  if (['RU', 'BY', 'UA', 'KZ', 'AM', 'KG', 'TJ', 'UZ'].includes(cc)) priorityId = 'russia'
  else if (['TH', 'MY', 'VN', 'SG', 'LA', 'KH', 'ID'].includes(cc)) priorityId = 'thailand'
  else priorityId = 'world'

  const idx = groups.findIndex((g) => g.id === priorityId)
  if (idx <= 0) return groups // already first or not found
  // Move priority group to front
  return [groups[idx], ...groups.slice(0, idx), ...groups.slice(idx + 1)]
}
