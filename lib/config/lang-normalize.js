/**
 * Normalize UI language codes to the four supported buckets (ru/en/zh/th).
 * @param {unknown} lang
 * @returns {'ru' | 'en' | 'zh' | 'th'}
 */
export function normalizeUiLang(lang) {
  const s = String(lang || 'ru').toLowerCase()
  if (s.startsWith('zh')) return 'zh'
  if (s.startsWith('th')) return 'th'
  if (s.startsWith('en')) return 'en'
  return 'ru'
}
