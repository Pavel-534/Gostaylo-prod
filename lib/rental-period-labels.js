/**
 * Подписи периода аренды: ночи (жильё) vs сутки/дни (транспорт).
 */

/**
 * @param {number} n — число ночей (разница дат), для отображения как «N суток» / «N days»
 * @param {'night' | 'day'} mode
 * @param {string} language
 */
export function formatRentalSpanLabel(n, mode, language) {
  const nights = Math.max(0, Math.floor(Number(n) || 0))
  if (nights < 1) return ''

  if (mode === 'day') {
    if (language === 'ru') {
      const mod10 = nights % 10
      const mod100 = nights % 100
      if (mod10 === 1 && mod100 !== 11) return `${nights} сутки`
      return `${nights} суток`
    }
    if (language === 'zh') return `${nights} 天`
    if (language === 'th') return `${nights} วัน`
    return nights === 1 ? `1 day` : `${nights} days`
  }

  if (language === 'ru') {
    if (nights === 1) return '1 ночь'
    if (nights < 5) return `${nights} ночи`
    return `${nights} ночей`
  }
  if (language === 'zh') return `${nights} 晚`
  if (language === 'th') return `${nights} คืน`
  return nights === 1 ? '1 night' : `${nights} nights`
}
