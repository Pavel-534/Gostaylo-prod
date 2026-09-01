/**
 * Stage 202.29 — QWERTY ↔ ЙЦУКЕН query variants for geo typeahead (wrong keyboard layout).
 */

/** @type {Record<string, string>} */
const EN_TO_RU = {
  '`': 'ё',
  q: 'й',
  w: 'ц',
  e: 'у',
  r: 'к',
  t: 'е',
  y: 'н',
  u: 'г',
  i: 'ш',
  o: 'щ',
  p: 'з',
  '[': 'х',
  ']': 'ъ',
  a: 'ф',
  s: 'ы',
  d: 'в',
  f: 'а',
  g: 'п',
  h: 'р',
  j: 'о',
  k: 'л',
  l: 'д',
  ';': 'ж',
  "'": 'э',
  z: 'я',
  x: 'ч',
  c: 'с',
  v: 'м',
  b: 'и',
  n: 'т',
  m: 'ь',
  ',': 'б',
  '.': 'ю',
  '/': '.',
}

/** @type {Record<string, string>} */
const RU_TO_EN = Object.fromEntries(Object.entries(EN_TO_RU).map(([en, ru]) => [ru, en]))

/**
 * @param {string} input
 * @param {Record<string, string>} map
 * @returns {string}
 */
function mapKeyboardLayout(input, map) {
  return String(input || '')
    .split('')
    .map((ch) => {
      const lower = ch.toLowerCase()
      const mapped = map[lower]
      if (!mapped) return ch
      return ch === lower ? mapped : mapped.toUpperCase()
    })
    .join('')
}

/**
 * @param {string} query
 * @returns {string[]}
 */
export function getKeyboardLayoutQueryVariants(query) {
  const raw = String(query || '').trim()
  if (!raw) return []

  const enToRu = mapKeyboardLayout(raw, EN_TO_RU)
  const ruToEn = mapKeyboardLayout(raw, RU_TO_EN)
  const variants = new Set([raw])
  if (enToRu !== raw) variants.add(enToRu)
  if (ruToEn !== raw) variants.add(ruToEn)
  return [...variants]
}

/**
 * @param {string|null|undefined} text
 * @returns {string}
 */
export function normalizeGeoSearchKey(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ё/g, 'е')
}

/**
 * @param {string} haystack
 * @param {string} query
 * @returns {boolean}
 */
export function haystackMatchesGeoQuery(haystack, query) {
  const hay = normalizeGeoSearchKey(haystack)
  if (!hay) return false
  for (const variant of getKeyboardLayoutQueryVariants(query)) {
    const needle = normalizeGeoSearchKey(variant)
    if (!needle) continue
    if (hay.includes(needle)) return true
  }
  return false
}

/**
 * Prefer Cyrillic swapped query for Nominatim when user typed Latin on RU UI.
 * @param {string} query
 * @param {string} [lang]
 * @returns {string}
 */
export function pickGeocodeSearchQuery(query, lang = 'ru') {
  const q = String(query || '').trim()
  if (!q) return q
  const l = String(lang || 'ru').toLowerCase()
  if (!l.startsWith('ru')) return q

  const enToRu = mapKeyboardLayout(q, EN_TO_RU)
  const hasCyrillic = /[\u0400-\u04FF]/.test(q)
  const swappedHasCyrillic = /[\u0400-\u04FF]/.test(enToRu)
  if (!hasCyrillic && swappedHasCyrillic && enToRu !== q) {
    return enToRu
  }
  return q
}
