/**
 * pluralizeGuests — корректное склонение «гость» для разных языков.
 * RU: 1→гость, 2-4→гостя, 5+→гостей
 * EN: 1→guest, 2+→guests
 * ZH/TH: 单数 (без склонения)
 *
 * @param {number|string} count
 * @param {string} lang
 * @returns {string} только склоняемое слово (без числа)
 */
export function pluralizeGuests(count, lang = 'ru') {
  const n = Math.abs(parseInt(count, 10) || 0)
  if (lang === 'ru') {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return 'гость'
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'гостя'
    return 'гостей'
  }
  if (lang === 'en') return n === 1 ? 'guest' : 'guests'
  if (lang === 'zh') return '位客人'
  if (lang === 'th') return 'ผู้เข้าพัก'
  return 'guests'
}
