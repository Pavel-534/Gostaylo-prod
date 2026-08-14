/**
 * Count + noun pluralization helpers (Stage 200.100).
 * RU: 1 / 2–4 / 5+ (with teens exception). EN: singular vs plural. ZH/TH: invariant.
 */

/**
 * @param {number} n
 * @returns {'one' | 'few' | 'many'}
 */
export function russianPluralCategory(n) {
  const abs = Math.abs(Math.floor(Number(n) || 0))
  const mod10 = abs % 10
  const mod100 = abs % 100
  if (mod10 === 1 && mod100 !== 11) return 'one'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'few'
  return 'many'
}

/**
 * pluralizeGuests — корректное склонение «гость» для разных языков.
 * RU: 1→гость, 2-4→гостя, 5+→гостей
 *
 * @param {number|string} count
 * @param {string} lang
 * @returns {string} только склоняемое слово (без числа)
 */
export function pluralizeGuests(count, lang = 'ru') {
  const n = Math.abs(parseInt(count, 10) || 0)
  if (lang === 'ru') {
    const cat = russianPluralCategory(n)
    if (cat === 'one') return 'гость'
    if (cat === 'few') return 'гостя'
    return 'гостей'
  }
  if (lang === 'en') return n === 1 ? 'guest' : 'guests'
  if (lang === 'zh') return '位客人'
  if (lang === 'th') return 'ผู้เข้าพัก'
  return 'guests'
}

/**
 * @param {number|string} count
 * @param {string} lang
 * @returns {string}
 */
export function pluralizeBedrooms(count, lang = 'ru') {
  const n = Math.abs(parseInt(count, 10) || 0)
  if (lang === 'ru') {
    const cat = russianPluralCategory(n)
    if (cat === 'one') return 'спальня'
    if (cat === 'few') return 'спальни'
    return 'спален'
  }
  if (lang === 'en') return n === 1 ? 'bedroom' : 'bedrooms'
  if (lang === 'zh') return '卧'
  if (lang === 'th') return 'ห้องนอน'
  return 'bedrooms'
}

/**
 * @param {number|string} count
 * @param {string} lang
 * @returns {string}
 */
export function pluralizeBathrooms(count, lang = 'ru') {
  const n = Math.abs(parseInt(count, 10) || 0)
  if (lang === 'ru') {
    const cat = russianPluralCategory(n)
    if (cat === 'one') return 'ванная'
    if (cat === 'few') return 'ванные'
    return 'ванных'
  }
  if (lang === 'en') return n === 1 ? 'bathroom' : 'bathrooms'
  if (lang === 'zh') return '间浴室'
  if (lang === 'th') return 'ห้องน้ำ'
  return 'bathrooms'
}

/**
 * @param {number|string} count
 * @param {string} lang
 * @returns {string} только склоняемое слово (без числа)
 */
export function pluralizeListings(count, lang = 'ru') {
  const n = Math.abs(parseInt(count, 10) || 0)
  if (lang === 'ru') {
    const cat = russianPluralCategory(n)
    if (cat === 'one') return 'объект'
    if (cat === 'few') return 'объекта'
    return 'объектов'
  }
  if (lang === 'en') return n === 1 ? 'listing' : 'listings'
  if (lang === 'zh') return '个'
  if (lang === 'th') return 'รายการ'
  return 'listings'
}

/**
 * «До N гостей» with correct guest noun.
 * @param {number|string} count
 * @param {string} lang
 * @returns {string}
 */
export function formatUpToGuestsLabel(count, lang = 'ru') {
  const n = Math.abs(parseInt(count, 10) || 0)
  if (lang === 'ru') {
    // After «до» Russian uses genitive: 1→гостя, 2+→гостей
    const cat = russianPluralCategory(n)
    const word = cat === 'one' ? 'гостя' : 'гостей'
    return `До ${n} ${word}`
  }
  const word = pluralizeGuests(n, lang)
  if (lang === 'en') return `Up to ${n} ${word}`
  if (lang === 'zh') return `最多${n}${word}`
  if (lang === 'th') return `สูงสุด ${n} ${word}`
  return `Up to ${n} ${word}`
}
